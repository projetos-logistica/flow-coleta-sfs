import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { registrarHistorico } from "@/hooks/use-coletas";
import { findHeader, formatDate, type Pedido } from "@/lib/coletas";
import { aguardar, comRetentativas, mensagemAmigavel } from "@/lib/rede";

// Uma única chamada RPC processa o lote inteiro no banco, então poucos
// lotes grandes substituem dezenas de requisições sequenciais do navegador.
const TAMANHO_LOTE = 250;
// Filtros com arrays de IDs viajam na URL: lotes pequenos evitam 414 URI Too Long.
const TAMANHO_LOTE_IDS = 200;
const INTERVALO_ENTRE_LOTES_MS = 200;
const TENTATIVAS_POR_LOTE = 4;
const INTERVALO_RETENTATIVA_MS = 1500;

export type ProgressoImportacao = { enviados: number; total: number; etapa: string };

export type ResumoImportacao = {
  novos: number;
  mantidos: number;
  coletados: number;
};

function lerArquivo(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) throw new Error("Planilha vazia.");
        const ws = wb.Sheets[sheetName];
        if (!ws) throw new Error("Planilha vazia.");
        resolve(XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, unknown>[]);
      } catch {
        reject(new Error("Não consegui ler esse arquivo. Verifique se é um .xlsx, .xls ou .csv válido."));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

export async function importarPlanilha(
  file: File,
  atuais: Pedido[],
  usuario: string,
  onProgresso?: (p: ProgressoImportacao) => void,
): Promise<ResumoImportacao> {
  const rows = await lerArquivo(file);
  if (rows.length === 0) throw new Error("A planilha parece estar vazia.");

  const firstRow = rows[0];
  if (!firstRow) throw new Error("Planilha vazia.");
  const headers = Object.keys(firstRow);
  const col = {
    data: findHeader(headers, (n) => n.includes("data") && n.includes("pedido")),
    numero: findHeader(headers, (n) => n.includes("numero") && n.includes("pedido")),
    loja: findHeader(headers, (n) => n.includes("loja")),
    transportadora: findHeader(headers, (n) => n.includes("transportadora")),
    origem: findHeader(headers, (n) => n.includes("origem")),
    marca: findHeader(headers, (n) => n.includes("marca")),
    uf: findHeader(headers, (n) => n.includes("uf")),
    escala: findHeader(headers, (n) => n.includes("escala")),
  };

  if (!col.numero) {
    throw new Error('Não encontrei a coluna "Número do Pedido" no arquivo importado.');
  }

  const porId = new Map(atuais.map((p) => [p.numero_pedido, p]));
  const vistos = new Set<string>();
  const upserts: Record<string, unknown>[] = [];
  const eventos: {
    numero_pedido: string;
    campo: string;
    valor_anterior: string;
    valor_novo: string;
  }[] = [];
  let novos = 0;
  let mantidos = 0;
  const importadoEm = new Date().toISOString();


  for (const row of rows) {
    const id = String(row[col.numero] ?? "").trim();
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    const existente = porId.get(id);
    const base = {
      numero_pedido: id,
      data_pedido: col.data ? formatDate(row[col.data]) : (existente?.data_pedido ?? ""),
      nome_loja: col.loja ? String(row[col.loja] ?? "") : (existente?.nome_loja ?? ""),
      transportadora: col.transportadora
        ? String(row[col.transportadora] ?? "")
        : (existente?.transportadora ?? ""),
      origem: col.origem ? String(row[col.origem] ?? "") : (existente?.origem ?? ""),
      marca: col.marca ? String(row[col.marca] ?? "").trim() : (existente?.marca ?? ""),
      uf_destino: col.uf ? String(row[col.uf] ?? "").trim() : (existente?.uf_destino ?? ""),
      escala_coleta: col.escala
        ? String(row[col.escala] ?? "").trim()
        : (existente?.escala_coleta ?? ""),
      status_coleta: "Pendente",
      // Preservados na importação; sempre enviados para evitar nulos no upsert em lote.
      status_contato: existente?.status_contato ?? "",
      situacao: existente?.situacao ?? "AGUARDANDO",
      situacao_updated_at: existente?.situacao_updated_at ?? null,
      coletado_at: null,
      data_coleta: null,
      importado_at: importadoEm,
      updated_at: importadoEm,
      importado_por: usuario,
    };


    if (existente) {
      mantidos++;
      if (existente.status_coleta !== "Pendente") {
        eventos.push({
          numero_pedido: id,
          campo: "Status Coleta",
          valor_anterior: existente.status_coleta,
          valor_novo: "Pendente",
        });
      }
      // Status Contato e Situação nunca são alterados pela importação.
      upserts.push(base);
    } else {
      novos++;
      upserts.push(base);
    }

  }

  const agora = new Date().toISOString();
  const sumidos = atuais.filter(
    (p) => !vistos.has(p.numero_pedido) && p.status_coleta !== "Coletado",
  );
  for (const p of sumidos) {
    eventos.push({
      numero_pedido: p.numero_pedido,
      campo: "Status Coleta",
      valor_anterior: p.status_coleta,
      valor_novo: "Coletado",
    });
  }

  // ─── Etapa 2: Upsert dos pedidos presentes na planilha ───
  // O progresso representa somente as linhas válidas e únicas lidas da planilha.
  const totalPlanilha = upserts.length;
  let enviados = 0;
  const reportar = (etapa: string) =>
    onProgresso?.({ enviados: Math.min(enviados, totalPlanilha), total: totalPlanilha, etapa });
  reportar("Enviando pedidos");

  // Envio adaptativo: se um lote falhar mesmo após as tentativas (rede instável,
  // proxy corporativo cortando requisições grandes), divide ao meio e tenta de novo,
  // até o mínimo de TAMANHO_MIN_LOTE pedidos.
  const TAMANHO_MIN_LOTE = 25;
  const enviarLote = async (lote: Record<string, unknown>[]): Promise<void> => {
    try {
      await comRetentativas(async () => {
        // Se a rede "pendurar" a requisição, desiste em 45s e tenta de novo
        // em vez de ficar esperando indefinidamente.
        const { error } = await supabase
          .rpc("importar_pedidos_bulk", { p_pedidos: lote as unknown as never })
          .abortSignal(AbortSignal.timeout(45000));
        if (error) throw error;
      }, {
        tentativas: lote.length > TAMANHO_MIN_LOTE ? 2 : TENTATIVAS_POR_LOTE,
        esperaBase: INTERVALO_RETENTATIVA_MS,
        esperaProgressiva: true,
      });
      enviados += lote.length;
      reportar("Enviando pedidos");
    } catch (e) {
      if (lote.length <= TAMANHO_MIN_LOTE) throw e;
      const meio = Math.ceil(lote.length / 2);
      await aguardar(INTERVALO_RETENTATIVA_MS);
      await enviarLote(lote.slice(0, meio));
      await aguardar(INTERVALO_ENTRE_LOTES_MS);
      await enviarLote(lote.slice(meio));
    }
  };

  for (let i = 0; i < upserts.length; i += TAMANHO_LOTE) {
    const lote = upserts.slice(i, i + TAMANHO_LOTE);
    try {
      await enviarLote(lote);
    } catch (e) {
      throw new Error(
        mensagemAmigavel(
          e,
          `A conexão caiu repetidamente durante o envio (${enviados} de ${totalPlanilha} pedidos já salvos). Pode importar a mesma planilha de novo — nada será duplicado`,
        ),
      );
    }
    if (i + TAMANHO_LOTE < upserts.length) {
      await aguardar(INTERVALO_ENTRE_LOTES_MS);
    }
  }

  // ─── Etapa 3: Marcar como Coletados pedidos ausentes desta carga ───
  // Estratégia por timestamp: qualquer pedido Pendente cujo importado_at seja
  // ANTERIOR ao início desta carga não estava no arquivo → foi coletado.
  // Isso evita passar arrays de milhares de IDs na URL (Failed to Fetch).
  let coletadosCount = 0;
  try {
    reportar("Atualizando pedidos ausentes");
    const { data, error } = await supabase.rpc("marcar_coletados_por_timestamp", {
      p_antes_de: importadoEm,
      p_coletado_at: agora,
    });
    if (error) {
      console.warn("Falha ao marcar coletados por timestamp, tentando fallback por IDs:", error.message);
      // Fallback: tenta lotes de IDs caso a RPC não exista ainda
      const idsSumidos = sumidos.map((p) => p.numero_pedido);
      for (let i = 0; i < idsSumidos.length; i += TAMANHO_LOTE_IDS) {
        const lote = idsSumidos.slice(i, i + TAMANHO_LOTE_IDS);
        try {
          await comRetentativas(async () => {
            const { error: e2 } = await supabase.rpc("marcar_coletados_bulk", {
              p_numeros: lote,
              p_coletado_at: agora,
            });
            if (e2) throw e2;
          }, { tentativas: TENTATIVAS_POR_LOTE, esperaBase: INTERVALO_RETENTATIVA_MS, esperaProgressiva: true });
        } catch (e3) {
          console.warn(mensagemAmigavel(e3, "Falha parcial no fallback de coletados"));
        }
        reportar("Atualizando pedidos ausentes (fallback)");
        if (i + TAMANHO_LOTE_IDS < idsSumidos.length) await aguardar(INTERVALO_ENTRE_LOTES_MS);
      }
      coletadosCount = sumidos.length;
    } else {
      coletadosCount = typeof data === "number" ? data : sumidos.length;
    }
  } catch (e) {
    console.warn(mensagemAmigavel(e, "Falha ao marcar pedidos ausentes como coletados (não-crítico)"));
  }

  // ─── Etapa 4: Registrar histórico de auditoria ───
  // Falha no histórico não cancela a importação.
  try {
    reportar("Registrando histórico");
    await registrarHistorico(usuario, eventos);
  } catch (e) {
    console.warn(mensagemAmigavel(e, "Falha ao registrar o histórico"));
  }

  return { novos, mantidos, coletados: coletadosCount };
}


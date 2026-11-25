import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  businessDaysSince,
  FIELD_LABELS,
  type EditableField,
  type EventoHistorico,
  type Pedido,
} from "@/lib/coletas";
import { comRetentativas } from "@/lib/rede";

const PEDIDOS_KEY = ["pedidos"];

// ─── Aviso de alteração entre computadores (broadcast, sem carga no banco) ───
type Ouvinte = () => void;
const ouvintes = new Set<Ouvinte>();
let canalSync: ReturnType<typeof supabase.channel> | null = null;
function obterCanal() {
  if (canalSync || typeof window === "undefined") return canalSync;
  canalSync = supabase
    .channel("pedidos-sync", { config: { broadcast: { self: false } } })
    .on("broadcast", { event: "alterado" }, () => ouvintes.forEach((f) => f()))
    .subscribe();
  return canalSync;
}
function ouvirAlteracoes(f: Ouvinte) {
  obterCanal();
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}
/** Avisa os outros painéis abertos que os pedidos mudaram. */
export function avisarAlteracao() {
  const canal = obterCanal();
  canal?.send({ type: "broadcast", event: "alterado", payload: {} }).catch(() => undefined);
}

type HistoricoInput = {
  numero_pedido: string;
  campo: string;
  valor_anterior: string;
  valor_novo: string;
};

/** Divide uma lista em lotes para evitar URLs/payloads grandes demais. */
export function emLotes<T>(itens: T[], tamanho: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) lotes.push(itens.slice(i, i + tamanho));
  return lotes;
}

export async function registrarHistorico(usuario: string, eventos: HistoricoInput[]) {
  if (eventos.length === 0) return;
  for (const lote of emLotes(eventos, 200)) {
    await comRetentativas(async () => {
      const { error } = await supabase.rpc("registrar_historico_bulk", {
        p_eventos: lote.map((e) => ({ ...e, usuario: usuario || "Anônimo" })) as unknown as never,
      });
      if (error) throw error;
    });
  }
}

const PEDIDOS_COLS =
  "numero_pedido,romaneio,data_pedido,nome_loja,transportadora,origem,uf_origem,marca,uf_destino,escala_coleta,status_coleta,status_contato,situacao,coletado_at,data_coleta,importado_at,situacao_updated_at,data_alteracao_situacao,created_at,updated_at,importado_por,editado_por";

/** Busca sequencial via cursor (sem OFFSET alto e sem Promise.all paralelo) apenas dos pedidos Pendentes. */
export async function fetchPedidos(): Promise<Pedido[]> {
  const PAGE = 1000;
  const todos: Pedido[] = [];
  let lastId = "";

  while (true) {
    let q = supabase
      .from("pedidos")
      .select(PEDIDOS_COLS)
      .eq("status_coleta", "Pendente")
      .order("numero_pedido", { ascending: true })
      .limit(PAGE);

    if (lastId) {
      q = q.gt("numero_pedido", lastId);
    }

    const { data, error } = await q.abortSignal(AbortSignal.timeout(20000));
    if (error) throw error;

    const lote = (data ?? []).map((row) => ({
      ...row,
      romaneio: row.romaneio ?? null,
      uf_origem: row.uf_origem ?? null,
    })) as Pedido[];

    if (lote.length === 0) break;
    todos.push(...lote);
    lastId = lote[lote.length - 1]!.numero_pedido;
    if (lote.length < PAGE) break;
  }

  return todos;
}

/** Contagem leve de pedidos Coletados sem trafegar linhas. */
export async function fetchColetadosCount(): Promise<number> {
  const { count, error } = await comRetentativas(async () =>
    await supabase
      .from("pedidos")
      .select("numero_pedido", { count: "exact", head: true })
      .eq("status_coleta", "Coletado"),
  );
  if (error) throw error;
  return count ?? 0;
}

/** Remove pedidos coletados há 2+ dias úteis, registrando no histórico. */
export async function limparColetadosExpirados(pedidos: Pedido[], usuario: string) {
  const now = new Date();
  const expirados = pedidos.filter(
    (p) =>
      p.status_coleta === "Coletado" &&
      p.coletado_at &&
      businessDaysSince(new Date(p.coletado_at), now) >= 2,
  );
  if (expirados.length === 0) return 0;
  for (const lote of emLotes(expirados.map((p) => p.numero_pedido), 200)) {
    const { error } = await supabase.from("pedidos").delete().in("numero_pedido", lote);
    if (error) throw error;
  }
  await registrarHistorico(
    usuario,
    expirados.map((p) => ({
      numero_pedido: p.numero_pedido,
      campo: "Registro",
      valor_anterior: "Coletado",
      valor_novo: "Excluído automaticamente (2 dias úteis coletado)",
    })),
  );
  return expirados.length;
}

/** Move para COBRAR MOVIMENTAÇÃO pedidos em AG. MOVIMENTAÇÃO há mais de 48h. */
export async function aplicarRegra48hMovimentacao(pedidos: Pedido[], usuario: string) {
  const limite = Date.now() - 48 * 60 * 60 * 1000;
  const alvos = pedidos.filter(
    (p) =>
      p.status_coleta === "Pendente" &&
      String(p.situacao ?? "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") ===
        "AG. MOVIMENTACAO" &&
      (p.data_alteracao_situacao || p.situacao_updated_at) &&
      new Date(p.data_alteracao_situacao || p.situacao_updated_at || "").getTime() < limite,
  );
  if (alvos.length === 0) return 0;
  const agora = new Date().toISOString();
  for (const lote of emLotes(alvos.map((p) => p.numero_pedido), 50)) {
    const { data, error } = await supabase
      .from("pedidos")
      .update({
        situacao: "COBRAR MOVIMENTAÇÃO",
        editado_por: "Automação (48h)",
        situacao_updated_at: agora,
        data_alteracao_situacao: agora,
      })
      .in("numero_pedido", lote)
      .select("numero_pedido");
    if (error) {
      console.error("Erro na automação 48h de movimentação:", error);
    }
  }
  await registrarHistorico(
    "Automação (48h)",
    alvos.map((p) => ({
      numero_pedido: p.numero_pedido,
      campo: FIELD_LABELS.situacao,
      valor_anterior: p.situacao,
      valor_novo: "COBRAR MOVIMENTAÇÃO (automático após 48h)",
    })),
  ).catch(() => undefined);
  return alvos.length;
}

export type AplicarStatusResultado = {
  total: number;
  sucessos: string[];
  falhas: string[];
};

export type AplicarStatusInput = {
  pedidos: Pedido[];
  field: EditableField;
  value: string;
  onProgress?: (processados: number, total: number, loteAtual: number, totalLotes: number) => void;
};

export type AplicarAmbosInput = {
  pedidos: Pedido[];
  contato: string;
  situacao: string;
  onProgress?: (processados: number, total: number, loteAtual: number, totalLotes: number) => void;
};

export function usePedidos(usuario: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: PEDIDOS_KEY,
    queryFn: fetchPedidos,
    refetchInterval: 300000,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  const coletadosCountQuery = useQuery({
    queryKey: ["pedidos-coletados-count"],
    queryFn: fetchColetadosCount,
    refetchInterval: 300000,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  // Sincronização entre computadores via aviso leve (broadcast): não pesa no
  // banco, ao contrário de escutar cada linha alterada da tabela.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = ouvirAlteracoes(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => queryClient.invalidateQueries({ queryKey: PEDIDOS_KEY }), 1500);
    });
    return () => {
      if (timer) clearTimeout(timer);
      off();
    };
  }, [queryClient]);

  // Higiene automática da base.
  useEffect(() => {
    if (!query.data || query.data.length === 0) return;
    limparColetadosExpirados(query.data, usuario)
      .then((n) => {
        if (n > 0) {
          queryClient.invalidateQueries({ queryKey: PEDIDOS_KEY });
          avisarAlteracao();
        }
      })
      .catch(() => undefined);
  }, [query.data, usuario, queryClient]);

  const aplicarStatus = useMutation({
    mutationFn: async ({
      pedidos,
      field,
      value,
      onProgress,
    }: AplicarStatusInput): Promise<AplicarStatusResultado> => {
      // Cancela queries em andamento para evitar race conditions no cache durante updates em lote
      await queryClient.cancelQueries({ queryKey: PEDIDOS_KEY });

      const alvos = pedidos.filter((p) => p[field] !== value);
      if (alvos.length === 0) {
        return { total: 0, sucessos: [], falhas: [] };
      }

      const patch: Partial<Pedido> = { [field]: value, editado_por: usuario };
      if (field === "status_coleta") {
        const agora = new Date().toISOString();
        patch.coletado_at = value === "Coletado" ? agora : null;
        patch.data_coleta = value === "Coletado" ? agora : null;
      }
      if (field === "situacao") {
        const agora = new Date().toISOString();
        patch.situacao_updated_at = agora;
        patch.data_alteracao_situacao = agora;
      }

      // Fracionamento obrigatório em blocos de até 20 pedidos com pausa de 150ms e timeout de 20s
      const lotes = emLotes(alvos, 20);
      const salvosComSucesso: string[] = [];
      const falhas: string[] = [];

      for (let i = 0; i < lotes.length; i++) {
        const lote = lotes[i] ?? [];
        if (onProgress) {
          onProgress(salvosComSucesso.length, alvos.length, i + 1, lotes.length);
        }

        // Até 2 tentativas automáticas com timeout de 20s por lote
        let loteSalvo = false;
        let ultimoErro: unknown;

        for (let tentativa = 1; tentativa <= 2; tentativa++) {
          try {
            const { data, error } = await supabase
              .from("pedidos")
              .update(patch)
              .in(
                "numero_pedido",
                lote.map((p) => p.numero_pedido),
              )
              .select("numero_pedido")
              .abortSignal(AbortSignal.timeout(20000));

            if (error) throw error;
            if (!data || data.length === 0) {
              throw new Error("Nenhum pedido foi atualizado pelo banco de dados.");
            }
            loteSalvo = true;
            break;
          } catch (err) {
            ultimoErro = err;
            if (tentativa < 2) {
              await new Promise((r) => setTimeout(r, 800));
            }
          }
        }

        if (loteSalvo) {
          salvosComSucesso.push(...lote.map((p) => p.numero_pedido));
          if (i < lotes.length - 1) {
            await new Promise((r) => setTimeout(r, 150));
          }
        } else {
          // Lote falhou: marca este lote e os restantes como falhas e aborta
          const restantes = lotes.slice(i).flat().map((p) => p.numero_pedido);
          falhas.push(...restantes);
          console.error("Falha definitiva no lote de pedidos:", ultimoErro);
          break;
        }
      }

      // Registra no histórico apenas os pedidos que foram efetivamente salvos no banco
      if (salvosComSucesso.length > 0) {
        const pedidosSalvos = alvos.filter((p) => salvosComSucesso.includes(p.numero_pedido));
        await registrarHistorico(
          usuario,
          pedidosSalvos.map((p) => ({
            numero_pedido: p.numero_pedido,
            campo: FIELD_LABELS[field],
            valor_anterior: p[field] || "(vazio)",
            valor_novo: value,
          })),
        ).catch((err) => {
          console.warn("Falha ao registrar histórico de auditoria:", err);
        });
      }

      return {
        total: alvos.length,
        sucessos: salvosComSucesso,
        falhas,
      };
    },
    onSuccess: (resultado) => {
      if (resultado.sucessos.length > 0) {
        avisarAlteracao();
        return queryClient.invalidateQueries({ queryKey: PEDIDOS_KEY });
      }
      return undefined;
    },
  });

  const aplicarAmbos = useMutation({
    mutationFn: async ({
      pedidos,
      contato,
      situacao,
      onProgress,
    }: AplicarAmbosInput): Promise<AplicarStatusResultado> => {
      // Cancela queries em andamento para evitar race conditions no cache durante updates em lote
      await queryClient.cancelQueries({ queryKey: PEDIDOS_KEY });

      const alvos = pedidos.filter(
        (p) => p.status_contato !== contato || p.situacao !== situacao,
      );
      if (alvos.length === 0) {
        return { total: 0, sucessos: [], falhas: [] };
      }

      const agora = new Date().toISOString();
      const patch: Partial<Pedido> = {
        status_contato: contato,
        situacao: situacao,
        editado_por: usuario,
        situacao_updated_at: agora,
        data_alteracao_situacao: agora,
      };

      // Fracionamento obrigatório em blocos de até 20 pedidos com pausa de 150ms e timeout de 20s
      const lotes = emLotes(alvos, 20);
      const salvosComSucesso: string[] = [];
      const falhas: string[] = [];

      for (let i = 0; i < lotes.length; i++) {
        const lote = lotes[i] ?? [];
        if (onProgress) {
          onProgress(salvosComSucesso.length, alvos.length, i + 1, lotes.length);
        }

        // Até 2 tentativas automáticas com timeout de 20s por lote
        let loteSalvo = false;
        let ultimoErro: unknown;

        for (let tentativa = 1; tentativa <= 2; tentativa++) {
          try {
            const { data, error } = await supabase
              .from("pedidos")
              .update(patch)
              .in(
                "numero_pedido",
                lote.map((p) => p.numero_pedido),
              )
              .select("numero_pedido")
              .abortSignal(AbortSignal.timeout(20000));

            if (error) throw error;
            if (!data || data.length === 0) {
              throw new Error("Nenhum pedido foi atualizado pelo banco de dados.");
            }
            loteSalvo = true;
            break;
          } catch (err) {
            ultimoErro = err;
            if (tentativa < 2) {
              await new Promise((r) => setTimeout(r, 800));
            }
          }
        }

        if (loteSalvo) {
          salvosComSucesso.push(...lote.map((p) => p.numero_pedido));
          if (i < lotes.length - 1) {
            await new Promise((r) => setTimeout(r, 150));
          }
        } else {
          // Lote falhou: marca este lote e os restantes como falhas e aborta
          const restantes = lotes.slice(i).flat().map((p) => p.numero_pedido);
          falhas.push(...restantes);
          console.error("Falha definitiva no lote de pedidos (aplicar ambos):", ultimoErro);
          break;
        }
      }

      // Registra no histórico apenas os pedidos que foram efetivamente salvos no banco
      if (salvosComSucesso.length > 0) {
        const pedidosSalvos = alvos.filter((p) => salvosComSucesso.includes(p.numero_pedido));
        const eventosHistorico: { numero_pedido: string; campo: string; valor_anterior: string; valor_novo: string }[] = [];

        for (const p of pedidosSalvos) {
          if (p.status_contato !== contato) {
            eventosHistorico.push({
              numero_pedido: p.numero_pedido,
              campo: FIELD_LABELS.status_contato,
              valor_anterior: p.status_contato || "(vazio)",
              valor_novo: contato,
            });
          }
          if (p.situacao !== situacao) {
            eventosHistorico.push({
              numero_pedido: p.numero_pedido,
              campo: FIELD_LABELS.situacao,
              valor_anterior: p.situacao || "(vazio)",
              valor_novo: situacao,
            });
          }
        }

        if (eventosHistorico.length > 0) {
          await registrarHistorico(usuario, eventosHistorico).catch((err) => {
            console.warn("Falha ao registrar histórico de auditoria:", err);
          });
        }
      }

      return {
        total: alvos.length,
        sucessos: salvosComSucesso,
        falhas,
      };
    },
    onSuccess: (resultado) => {
      if (resultado.sucessos.length > 0) {
        avisarAlteracao();
        return queryClient.invalidateQueries({ queryKey: PEDIDOS_KEY });
      }
      return undefined;
    },
  });

  const limparBase = useMutation({
    mutationFn: async (pedidos: Pedido[]) => {
      const { error } = await supabase.from("pedidos").delete().neq("numero_pedido", "");
      if (error) throw error;
      await registrarHistorico(
        usuario,
        pedidos.map((p) => ({
          numero_pedido: p.numero_pedido,
          campo: "Registro",
          valor_anterior: p.status_coleta,
          valor_novo: "Removido (limpeza manual da base)",
        })),
      );
    },
    onSuccess: () => {
      avisarAlteracao();
      return queryClient.invalidateQueries({ queryKey: PEDIDOS_KEY });
    },
  });

  return { query, coletadosCount: coletadosCountQuery.data ?? 0, aplicarStatus, aplicarAmbos, limparBase, invalidate: () => {
    avisarAlteracao();
    queryClient.invalidateQueries({ queryKey: ["pedidos-coletados-count"] });
    return queryClient.invalidateQueries({ queryKey: PEDIDOS_KEY });
  } };
}

export async function fetchHistorico(): Promise<EventoHistorico[]> {
  const PAGE = 1000;
  const todos: EventoHistorico[] = [];
  for (let from = 0; from < 50000; from += PAGE) {
    const { data, error } = await comRetentativas(async () => await supabase
      .from("historico_alteracoes")
      .select("*")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1));
    if (error) throw error;
    const lote = (data ?? []) as EventoHistorico[];
    todos.push(...lote);
    if (lote.length < PAGE) break;
  }
  return todos;
}

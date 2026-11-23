import { useMemo, useRef, useState } from "react";
import {
  Pedido,
  isEscalaNoPrazo,
  type EditableField,
  SITUACAO_OPTIONS,
  DISPLAY_ORDER,
  FIELD_LABELS,
} from "@/lib/coletas";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Clock,
  Download,
  FilterX,
  Layers,
  MapPin,
  Search,
  Store,
  Tag,
  Truck,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useFilters } from "@/contexts/filters-context";

export type AgingFaixaKey =
  | "no_prazo"
  | "1_2_dias"
  | "3_4_dias"
  | "5_6_dias"
  | "7_10_dias"
  | "11_mais";

export type SortColumn = "smart" | "nome" | "total" | "tratados" | AgingFaixaKey;

export const FAIXA_CONFIG: Record<
  AgingFaixaKey,
  {
    label: string;
    sublabel: string;
    bgHeader: string;
    textHeader: string;
    cellActive: string;
    badgeStyle: string;
  }
> = {
  no_prazo: {
    label: "No Prazo",
    sublabel: "Vence hoje, -1, -2d...",
    bgHeader: "bg-emerald-50/80",
    textHeader: "text-emerald-800",
    cellActive: "ring-2 ring-emerald-500 bg-emerald-100/70",
    badgeStyle: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  "1_2_dias": {
    label: "1 a 2 dias",
    sublabel: "Atenção suave",
    bgHeader: "bg-amber-50/80",
    textHeader: "text-amber-800",
    cellActive: "ring-2 ring-amber-500 bg-amber-100/70",
    badgeStyle: "bg-amber-50 text-amber-700 border-amber-200",
  },
  "3_4_dias": {
    label: "3 a 4 dias",
    sublabel: "Alerta",
    bgHeader: "bg-orange-50/80",
    textHeader: "text-orange-800",
    cellActive: "ring-2 ring-orange-500 bg-orange-100/70",
    badgeStyle: "bg-orange-50 text-orange-700 border-orange-200",
  },
  "5_6_dias": {
    label: "5 a 6 dias",
    sublabel: "Atraso moderado",
    bgHeader: "bg-orange-100/80",
    textHeader: "text-orange-950 font-semibold",
    cellActive: "ring-2 ring-orange-600 bg-orange-200/80",
    badgeStyle: "bg-orange-100 text-orange-900 border-orange-300 font-semibold",
  },
  "7_10_dias": {
    label: "7 a 10 dias",
    sublabel: "Atraso grave",
    bgHeader: "bg-rose-50/90",
    textHeader: "text-rose-800 font-bold",
    cellActive: "ring-2 ring-rose-500 bg-rose-100/80",
    badgeStyle: "bg-rose-50 text-rose-700 border-rose-300 font-bold",
  },
  "11_mais": {
    label: "11 dias ou mais",
    sublabel: "Crítico",
    bgHeader: "bg-purple-100/90",
    textHeader: "text-purple-950 font-extrabold",
    cellActive: "ring-2 ring-purple-600 bg-purple-200/90",
    badgeStyle: "bg-purple-100 text-purple-950 border-purple-300 font-extrabold",
  },
};

/** Classifica com precisão a string escala_coleta em uma das faixas operacionais */
export function classificarFaixa(escala?: string | null): AgingFaixaKey {
  const v = String(escala ?? "").trim().toLowerCase();
  if (!v || isEscalaNoPrazo(v)) return "no_prazo";
  if (v.includes("11") || v.includes("mais")) return "11_mais";
  if (
    v.includes("7 a 10") ||
    v.includes("7 a 8") ||
    v.includes("9 a 10") ||
    v.includes("7 a") ||
    v.includes("9 a") ||
    v.includes("8 a") ||
    v.includes("10")
  ) {
    return "7_10_dias";
  }
  if (v.includes("5 a 6") || v.includes("5 a") || v.includes("6 a")) return "5_6_dias";
  if (v.includes("3 a 4") || v.includes("3 a") || v.includes("4 a")) return "3_4_dias";
  if (v.includes("1 a 2") || v.includes("1 a") || v.includes("2 a")) return "1_2_dias";
  return "1_2_dias";
}

export interface StoreAgingRow {
  nome_loja: string;
  total: number;
  no_prazo: number;
  dias_1_2: number;
  dias_3_4: number;
  dias_5_6: number;
  dias_7_10: number;
  dias_11_mais: number;
  pedidosTratados: number;
}

interface AgingBacklogViewProps {
  pedidos: Pedido[];
  usuario: string;
  onVoltarPainel: () => void;
  onNavigate: (tela: "painel" | "aging" | "usuarios") => void;
  onChangeField?: (pedido: Pedido, field: EditableField, value: string) => void;
}

export function AgingBacklogView({
  pedidos,
  usuario: _usuario,
  onVoltarPainel,
  onNavigate: _onNavigate,
  onChangeField: _onChangeField,
}: AgingBacklogViewProps) {
  // ─── Filtros Compartilhados (via Contexto Global) ───
  const {
    filtroMarca,
    setFiltroMarca,
    filtroOrigem,
    setFiltroOrigem,
    filtroTransportadora,
    setFiltroTransportadora,
    filtroSituacao,
    setFiltroSituacao,
    buscaTags,
    setBuscaTags,
    buscaTexto,
    setBuscaTexto,
  } = useFilters();

  const [isFocused, setIsFocused] = useState(false);
  const [lojaSelecionada, setLojaSelecionada] = useState<string | null>(null);

  // ─── Ordenação da Matriz ───
  const [ordenarPor, setOrdenarPor] = useState<SortColumn>("smart");
  const [ordemDesc, setOrdemDesc] = useState(true);

  // Refs de busca
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 1. Apenas pedidos com status_coleta === 'Pendente'
  const pedidosPendentes = useMemo(() => {
    return pedidos.filter((p) => p.status_coleta === "Pendente");
  }, [pedidos]);

  // Opções para os filtros rápidos
  const marcasDisponiveis = useMemo(
    () =>
      [...new Set(pedidosPendentes.map((p) => (p.marca ?? "").trim()).filter(Boolean))].sort(),
    [pedidosPendentes],
  );
  const origensDisponiveis = useMemo(
    () => [...new Set(pedidosPendentes.map((p) => p.origem).filter(Boolean))].sort(),
    [pedidosPendentes],
  );
  const transportadorasDisponiveis = useMemo(
    () =>
      [...new Set(pedidosPendentes.map((p) => p.transportadora).filter(Boolean))].sort(),
    [pedidosPendentes],
  );
  const situacoesDisponiveis = useMemo(() => {
    return Array.from(SITUACAO_OPTIONS);
  }, []);

  // 2. Aplicação dos filtros rápidos sobre os pendentes
  const pendentesFiltrados = useMemo(() => {
    const termosTexto = buscaTexto
      .split(/[,\n\r;\s\t]+/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const todosTermos = Array.from(
      new Set([
        ...buscaTags.map((t) => t.trim().toLowerCase()).filter(Boolean),
        ...termosTexto,
      ]),
    );

    return pedidosPendentes.filter((p) => {
      if (filtroMarca.length > 0 && !filtroMarca.includes((p.marca ?? "").trim()))
        return false;
      if (filtroOrigem.length > 0 && !filtroOrigem.includes(p.origem))
        return false;
      if (
        filtroTransportadora.length > 0 &&
        !filtroTransportadora.includes(p.transportadora)
      )
        return false;
      if (filtroSituacao.length > 0 && !filtroSituacao.includes(p.situacao))
        return false;

      if (todosTermos.length > 0) {
        const conteudo = `${p.numero_pedido} ${p.nome_loja} ${p.transportadora} ${p.marca} ${p.origem} ${p.uf_origem ?? ""} ${p.situacao} ${p.romaneio ?? ""}`.toLowerCase();
        const bateu = todosTermos.some((termo) => conteudo.includes(termo));
        if (!bateu) return false;
      }

      return true;
    });
  }, [pedidosPendentes, filtroMarca, filtroOrigem, filtroTransportadora, filtroSituacao, buscaTags, buscaTexto]);

  // 3. Construção da Matriz de Envelhecimento por Loja
  const matrizLojas = useMemo(() => {
    const mapa = new Map<string, StoreAgingRow>();

    pendentesFiltrados.forEach((p) => {
      const nome = p.nome_loja?.trim() || "NÃO INFORMADA";
      let row = mapa.get(nome);
      if (!row) {
        row = {
          nome_loja: nome,
          total: 0,
          no_prazo: 0,
          dias_1_2: 0,
          dias_3_4: 0,
          dias_5_6: 0,
          dias_7_10: 0,
          dias_11_mais: 0,
          pedidosTratados: 0,
        };
        mapa.set(nome, row);
      }

      row.total += 1;
      const faixa = classificarFaixa(p.escala_coleta);
      if (faixa === "no_prazo") row.no_prazo += 1;
      else if (faixa === "1_2_dias") row.dias_1_2 += 1;
      else if (faixa === "3_4_dias") row.dias_3_4 += 1;
      else if (faixa === "5_6_dias") row.dias_5_6 += 1;
      else if (faixa === "7_10_dias") row.dias_7_10 += 1;
      else if (faixa === "11_mais") row.dias_11_mais += 1;

      // Conta como tratado apenas se estiver em atraso (fora de "no_prazo") e com situação diferente de "AG. TRATATIVA" e "AGUARDANDO"
      if (
        faixa !== "no_prazo" &&
        Boolean(p.situacao) &&
        p.situacao.trim().toUpperCase() !== "AG. TRATATIVA" &&
        p.situacao.trim().toUpperCase() !== "AGUARDANDO"
      ) {
        row.pedidosTratados += 1;
      }
    });

    const lista = Array.from(mapa.values());

    // Ordenação da Matriz conforme coluna clicada
    lista.sort((a, b) => {
      if (ordenarPor === "smart") {
        // Ordenação inteligente: prioriza 11+ dias, depois 7-10, depois 5-6, 3-4 e total
        if (b.dias_11_mais !== a.dias_11_mais)
          return ordemDesc ? b.dias_11_mais - a.dias_11_mais : a.dias_11_mais - b.dias_11_mais;
        if (b.dias_7_10 !== a.dias_7_10)
          return ordemDesc ? b.dias_7_10 - a.dias_7_10 : a.dias_7_10 - b.dias_7_10;
        if (b.dias_5_6 !== a.dias_5_6)
          return ordemDesc ? b.dias_5_6 - a.dias_5_6 : a.dias_5_6 - b.dias_5_6;
        if (b.dias_3_4 !== a.dias_3_4)
          return ordemDesc ? b.dias_3_4 - a.dias_3_4 : a.dias_3_4 - b.dias_3_4;
        return ordemDesc ? b.total - a.total : a.total - b.total;
      }

      if (ordenarPor === "nome") {
        return ordemDesc
          ? b.nome_loja.localeCompare(a.nome_loja)
          : a.nome_loja.localeCompare(b.nome_loja);
      }

      if (ordenarPor === "total") {
        const diff = b.total - a.total;
        if (diff !== 0) return ordemDesc ? diff : -diff;
        return a.nome_loja.localeCompare(b.nome_loja);
      }

      if (ordenarPor === "tratados") {
        const diff = b.pedidosTratados - a.pedidosTratados;
        if (diff !== 0) return ordemDesc ? diff : -diff;
        return a.nome_loja.localeCompare(b.nome_loja);
      }

      // Faixas de envelhecimento específicas
      const getVal = (r: StoreAgingRow, f: AgingFaixaKey) => {
        switch (f) {
          case "no_prazo":
            return r.no_prazo;
          case "1_2_dias":
            return r.dias_1_2;
          case "3_4_dias":
            return r.dias_3_4;
          case "5_6_dias":
            return r.dias_5_6;
          case "7_10_dias":
            return r.dias_7_10;
          case "11_mais":
            return r.dias_11_mais;
        }
      };

      const valA = getVal(a, ordenarPor);
      const valB = getVal(b, ordenarPor);
      if (valA !== valB) {
        return ordemDesc ? valB - valA : valA - valB;
      }
      return b.total - a.total;
    });

    return lista;
  }, [pendentesFiltrados, ordenarPor, ordemDesc]);

  // Totais Gerais das Colunas da Matriz
  const totaisGerais = useMemo(() => {
    return matrizLojas.reduce(
      (acc, r) => {
        acc.total += r.total;
        acc.no_prazo += r.no_prazo;
        acc.dias_1_2 += r.dias_1_2;
        acc.dias_3_4 += r.dias_3_4;
        acc.dias_5_6 += r.dias_5_6;
        acc.dias_7_10 += r.dias_7_10;
        acc.dias_11_mais += r.dias_11_mais;
        acc.pedidosTratados += r.pedidosTratados;
        return acc;
      },
      {
        total: 0,
        no_prazo: 0,
        dias_1_2: 0,
        dias_3_4: 0,
        dias_5_6: 0,
        dias_7_10: 0,
        dias_11_mais: 0,
        pedidosTratados: 0,
      },
    );
  }, [matrizLojas]);

  // Função para lidar com clique no cabeçalho (Ciclo de 3 estados: 1º DESC -> 2º ASC -> 3º Restaura Smart)
  function handleHeaderSort(col: SortColumn) {
    if (ordenarPor === col) {
      if (ordemDesc) {
        // 2º clique: Alterna para ASC (ordem crescente)
        setOrdemDesc(false);
      } else {
        // 3º clique: Desmarca a ordenação ativa e retorna para a criticidade padrão inicial (Smart)
        setOrdenarPor("smart");
        setOrdemDesc(true);
      }
    } else {
      // 1º clique: Ativa a coluna com ordem decrescente (DESC)
      setOrdenarPor(col);
      setOrdemDesc(true);
    }
  }

  // Tags Search Handlers
  function adicionarTags(novas: string[]) {
    const limpos = novas.map((t) => t.trim()).filter((t) => t.length > 0);
    if (limpos.length === 0) return;
    setBuscaTags((prev) => Array.from(new Set([...prev, ...limpos])));
  }

  function removerTag(tag: string) {
    setBuscaTags((prev) => prev.filter((t) => t !== tag));
  }

  function processarTexto(texto: string) {
    const partes = texto.split(/[,\n\r;\s\t]+/).filter(Boolean);
    if (partes.length > 0) {
      adicionarTags(partes);
      setBuscaTexto("");
    }
  }

  const isCompact = !isFocused && buscaTags.length > 3;
  const tagsVisiveis = isCompact ? buscaTags.slice(0, 3) : buscaTags;
  const totalOcultos = buscaTags.length - 3;

  const temFiltrosRapidosAtivos =
    filtroMarca.length > 0 ||
    filtroOrigem.length > 0 ||
    filtroTransportadora.length > 0 ||
    filtroSituacao.length > 0 ||
    buscaTags.length > 0 ||
    !!buscaTexto;

  function limparTodosFiltros() {
    setFiltroMarca([]);
    setFiltroOrigem([]);
    setFiltroTransportadora([]);
    setFiltroSituacao([]);
    setBuscaTags([]);
    setBuscaTexto("");
    setLojaSelecionada(null);
  }

  // Exportação da Matriz Aging para Excel (Formato Analítico Detalhado de Pedidos)
  function exportarMatrizExcel() {
    const pedidosParaExportar = lojaSelecionada
      ? pendentesFiltrados.filter(
          (p) => (p.nome_loja?.trim() || "NÃO INFORMADA") === lojaSelecionada,
        )
      : pendentesFiltrados;

    if (pedidosParaExportar.length === 0) {
      toast.error("Não há pedidos pendentes para exportar.");
      return;
    }

    const linhas = pedidosParaExportar.map((p) => {
      const row: Record<string, string> = {};
      DISPLAY_ORDER.forEach((f) => (row[FIELD_LABELS[f]] = String(p[f] ?? "")));
      row["Data Coleta"] = p.coletado_at
        ? new Date(p.coletado_at).toLocaleString("pt-BR")
        : "";
      row["Data Importação"] = p.importado_at
        ? new Date(p.importado_at).toLocaleString("pt-BR")
        : "";
      row["Importado por"] = p.importado_por ?? "";
      row["Editado por"] = p.editado_por ?? "";
      row["Primeira Importação"] = p.created_at
        ? new Date(p.created_at).toLocaleString("pt-BR")
        : "";
      row["Data Alteração Situação"] = (p.data_alteracao_situacao || p.situacao_updated_at)
        ? new Date(p.data_alteracao_situacao || p.situacao_updated_at || "").toLocaleString("pt-BR")
        : "";

      return row;
    });

    const wb = XLSX.utils.book_new();
    const nomeAba = lojaSelecionada
      ? `Pedidos_${lojaSelecionada.slice(0, 20).replace(/[/\\?*[\]]/g, "_")}`
      : "Pedidos_Pendentes";
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), nomeAba);

    const now = new Date();
    const ts =
      now.toISOString().slice(0, 10) +
      "_" +
      now.getHours().toString().padStart(2, "0") +
      "h" +
      now.getMinutes().toString().padStart(2, "0");
    const sufixoLoja = lojaSelecionada
      ? `_${lojaSelecionada.replace(/[^a-zA-Z0-9_-]/g, "_")}`
      : "";
    XLSX.writeFile(wb, `Aging_Pedidos_Pendentes${sufixoLoja}_${ts}.xlsx`);
    toast.success(
      `${linhas.length} pedido(s) analítico(s) exportado(s) com sucesso!`,
    );
  }

  // Ícone de ordenação da coluna
  function renderSortIndicator(col: SortColumn) {
    if (ordenarPor === col) {
      return ordemDesc ? (
        <ArrowDown className="size-3.5 inline ml-1 text-indigo-600 dark:text-indigo-400 stroke-[2.5]" />
      ) : (
        <ArrowUp className="size-3.5 inline ml-1 text-indigo-600 dark:text-indigo-400 stroke-[2.5]" />
      );
    }
    return <ArrowUpDown className="size-3 inline ml-1 text-slate-400 opacity-40 group-hover:opacity-80 transition" />;
  }

  return (
    <div className="flex flex-col min-w-0 w-full bg-slate-100 text-slate-800">
      {/* Topbar do Painel Aging */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onVoltarPainel}
              className="inline-flex md:hidden items-center gap-1 rounded-lg border border-slate-200 p-1.5 text-xs text-slate-600 hover:bg-slate-50 mr-1"
              title="Voltar ao painel operacional"
            >
              <ArrowLeft className="size-4" />
            </button>
            <div className="flex items-center gap-2">
              <Clock className="size-5 text-amber-500" />
              <h1 className="text-lg font-bold tracking-tight text-slate-900">
                Painel de Coletas <span className="font-normal text-slate-400">|</span> Aging de Backlog
              </h1>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Matriz analítica de envelhecimento de pedidos pendentes por loja e escala de coleta
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onVoltarPainel}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
          >
            <ArrowLeft className="size-3.5 text-slate-500" />
            Painel operacional
          </button>

          <div className="inline-flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200/80 px-3 py-1.5 text-xs font-semibold text-amber-800">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex size-2 rounded-full bg-amber-500"></span>
            </span>
            <span>{pendentesFiltrados.length.toLocaleString("pt-BR")} pendentes no backlog</span>
          </div>
        </div>
      </header>

      {/* Conteúdo com Scroll */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-4">
        {/* 1. BARRA DE BUSCA EM MASSA E FILTROS RÁPIDOS */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Campo de Busca em Massa com Tags/Chips (Suporte a Excel) */}
            <div
              ref={containerRef}
              onClick={() => {
                setIsFocused(true);
                inputRef.current?.focus();
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={(e) => {
                if (!containerRef.current?.contains(e.relatedTarget as Node)) {
                  setIsFocused(false);
                }
              }}
              className={cn(
                "relative flex flex-1 items-start gap-2 min-w-0 rounded-xl border bg-slate-50/50 px-3 py-1.5 shadow-2xs transition-all cursor-text",
                isFocused
                  ? "border-indigo-500 bg-white ring-2 ring-indigo-500/20"
                  : "border-slate-200 hover:border-slate-300",
              )}
            >
              <Search className="size-4 shrink-0 text-slate-400 mt-1" />

              <div
                className={cn(
                  "flex flex-1 flex-wrap items-center gap-1.5 min-w-0 transition-all duration-200",
                  isFocused ? "max-h-32 overflow-y-auto pr-1" : "max-h-8 overflow-hidden",
                )}
              >
                {tagsVisiveis.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-500/30"
                  >
                    <span className="max-w-[140px] truncate">{tag}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removerTag(tag);
                      }}
                      className="rounded-full p-0.5 hover:bg-indigo-200/80 text-indigo-600"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}

                {isCompact && totalOcultos > 0 && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFocused(true);
                      inputRef.current?.focus();
                    }}
                    className="cursor-pointer rounded-md bg-slate-200/80 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-300"
                  >
                    +{totalOcultos}
                  </span>
                )}

                <input
                  ref={inputRef}
                  type="text"
                  value={buscaTexto}
                  onChange={(e) => setBuscaTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "," || e.key === ";") {
                      e.preventDefault();
                      if (buscaTexto.trim()) {
                        processarTexto(buscaTexto);
                      }
                    } else if (
                      e.key === "Backspace" &&
                      !buscaTexto &&
                      buscaTags.length > 0
                    ) {
                      removerTag(buscaTags[buscaTags.length - 1]!);
                    }
                  }}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData("text");
                    if (pasted && /[,\n\r;\s\t]/.test(pasted.trim())) {
                      e.preventDefault();
                      processarTexto(pasted);
                    }
                  }}
                  placeholder={
                    buscaTags.length === 0
                      ? "Colar lista de pedidos do Excel ou buscar por pedido, loja..."
                      : "Adicionar mais..."
                  }
                  className="flex-1 min-w-[200px] border-none bg-transparent p-0.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                />
              </div>

              {(buscaTags.length > 0 || buscaTexto) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setBuscaTags([]);
                    setBuscaTexto("");
                  }}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  title="Limpar busca"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Filtros Rápidos (Marca, Origem, Transportadora) */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Filtro: Marca */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition cursor-pointer",
                      filtroMarca.length > 0
                        ? "border-indigo-200 bg-indigo-50 text-indigo-700 font-semibold"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    <Tag className="size-3.5 text-slate-400" />
                    Marca
                    {filtroMarca.length > 0 && (
                      <span className="rounded-full bg-indigo-200/80 px-1.5 py-0.2 text-[10px] font-bold text-indigo-900">
                        {filtroMarca.length}
                      </span>
                    )}
                    <ChevronDown className="size-3 text-slate-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 max-h-64 overflow-y-auto bg-white border border-slate-200 p-1 shadow-lg rounded-xl">
                  <DropdownMenuLabel className="text-xs text-slate-500 font-bold px-2 py-1">
                    Filtrar por Marca
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {marcasDisponiveis.map((m) => (
                    <DropdownMenuCheckboxItem
                      key={m}
                      checked={filtroMarca.includes(m)}
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={() =>
                        setFiltroMarca((prev) =>
                          prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
                        )
                      }
                      className="text-xs text-slate-700 cursor-pointer"
                    >
                      {m}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Filtro: Origem */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition cursor-pointer",
                      filtroOrigem.length > 0
                        ? "border-indigo-200 bg-indigo-50 text-indigo-700 font-semibold"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    <MapPin className="size-3.5 text-slate-400" />
                    Origem
                    {filtroOrigem.length > 0 && (
                      <span className="rounded-full bg-indigo-200/80 px-1.5 py-0.2 text-[10px] font-bold text-indigo-900">
                        {filtroOrigem.length}
                      </span>
                    )}
                    <ChevronDown className="size-3 text-slate-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 max-h-64 overflow-y-auto bg-white border border-slate-200 p-1 shadow-lg rounded-xl">
                  <DropdownMenuLabel className="text-xs text-slate-500 font-bold px-2 py-1">
                    Filtrar por Origem
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {origensDisponiveis.map((o) => (
                    <DropdownMenuCheckboxItem
                      key={o}
                      checked={filtroOrigem.includes(o)}
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={() =>
                        setFiltroOrigem((prev) =>
                          prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o],
                        )
                      }
                      className="text-xs text-slate-700 cursor-pointer"
                    >
                      {o}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Filtro: Transportadora */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition cursor-pointer",
                      filtroTransportadora.length > 0
                        ? "border-indigo-200 bg-indigo-50 text-indigo-700 font-semibold"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    <Truck className="size-3.5 text-slate-400" />
                    Transportadora
                    {filtroTransportadora.length > 0 && (
                      <span className="rounded-full bg-indigo-200/80 px-1.5 py-0.2 text-[10px] font-bold text-indigo-900">
                        {filtroTransportadora.length}
                      </span>
                    )}
                    <ChevronDown className="size-3 text-slate-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 max-h-64 overflow-y-auto bg-white border border-slate-200 p-1 shadow-lg rounded-xl">
                  <DropdownMenuLabel className="text-xs text-slate-500 font-bold px-2 py-1">
                    Filtrar por Transportadora
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {transportadorasDisponiveis.map((t) => (
                    <DropdownMenuCheckboxItem
                      key={t}
                      checked={filtroTransportadora.includes(t)}
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={() =>
                        setFiltroTransportadora((prev) =>
                          prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
                        )
                      }
                      className="text-xs text-slate-700 cursor-pointer"
                    >
                      {t}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Filtro: Situação */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition cursor-pointer",
                      filtroSituacao.length > 0
                        ? "border-amber-200 bg-amber-50 text-amber-800 font-semibold"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    <Layers className="size-3.5 text-slate-400" />
                    Situação
                    {filtroSituacao.length > 0 && (
                      <span className="rounded-full bg-amber-200/90 px-1.5 py-0.2 text-[10px] font-bold text-amber-950">
                        {filtroSituacao.length}
                      </span>
                    )}
                    <ChevronDown className="size-3 text-slate-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 max-h-64 overflow-y-auto bg-white border border-slate-200 p-1 shadow-lg rounded-xl">
                  <DropdownMenuLabel className="text-xs text-slate-500 font-bold px-2 py-1">
                    Filtrar por Situação
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {situacoesDisponiveis.map((s) => (
                    <DropdownMenuCheckboxItem
                      key={s}
                      checked={filtroSituacao.includes(s)}
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={() =>
                        setFiltroSituacao((prev) =>
                          prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
                        )
                      }
                      className="text-xs text-slate-700 cursor-pointer"
                    >
                      {s}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Limpar Todos os Filtros */}
              {temFiltrosRapidosAtivos && (
                <button
                  type="button"
                  onClick={limparTodosFiltros}
                  className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1 transition cursor-pointer"
                >
                  <FilterX className="size-3.5" />
                  Limpar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 2. MATRIZ AGING FULL-WIDTH (100% DA LARGURA) */}
        <div className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Header da Matriz Aging */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-900 px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20">
                <Store className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold tracking-tight">Matriz Aging</h2>
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
                    {matrizLojas.length} lojas
                  </span>
                  {lojaSelecionada && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 border border-amber-400/40 px-3 py-0.5 text-xs font-bold text-amber-300">
                      Loja Selecionada: {lojaSelecionada}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLojaSelecionada(null);
                        }}
                        className="rounded-full hover:bg-white/20 p-0.5 cursor-pointer"
                        title="Limpar seleção de loja"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Distribuição detalhada de pedidos pendentes por loja e tempo de envelhecimento
                </p>
              </div>
            </div>

            {/* Ações e Ordenação da Matriz */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 bg-slate-800/90 rounded-xl p-1 border border-slate-700 text-xs">
                <span className="text-[11px] text-slate-400 pl-2 pr-1 font-medium">Critério:</span>
                <button
                  type="button"
                  onClick={() => {
                    setOrdenarPor("smart");
                    setOrdemDesc(true);
                  }}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5",
                    ordenarPor === "smart"
                      ? "bg-amber-400 text-slate-950 font-bold shadow-xs"
                      : "text-slate-300 hover:bg-white/10 hover:text-white",
                  )}
                  title={
                    ordenarPor === "smart"
                      ? "Ordenação padrão por criticidade ativa (pedidos com 11+ dias primeiro)"
                      : "Clique para limpar a ordenação da coluna e restaurar a Criticidade Smart"
                  }
                >
                  <span>⚡ Criticidade (Smart)</span>
                  {ordenarPor !== "smart" && (
                    <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-amber-300 font-normal">
                      Restaurar
                    </span>
                  )}
                </button>
              </div>

              {/* Botão de Exportação para Excel */}
              <button
                type="button"
                onClick={exportarMatrizExcel}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 text-xs font-semibold text-slate-200 shadow-xs hover:bg-slate-700 hover:text-white transition cursor-pointer"
                title="Exportar dados da Matriz Aging para planilha Excel"
              >
                <Download className="size-3.5 text-amber-400" />
                <span>Exportar (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* Dica de interação */}
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-2 flex items-center justify-between text-xs text-slate-500">
            <span>
              💡 Clique nos cabeçalhos para alternar a ordenação: <strong>1º Decrescente</strong> → <strong>2º Crescente</strong> → <strong>3º Restaurar Criticidade (Smart)</strong>.
            </span>
            <span className="text-[11px] font-medium text-slate-400">
              {matrizLojas.length} registros
            </span>
          </div>

          {/* Tabela Matriz Full-Width */}
          <div className="max-h-[calc(100vh-340px)] overflow-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 text-slate-700 shadow-2xs select-none">
                <tr>
                  {/* Coluna Loja */}
                  <th
                    onClick={() => handleHeaderSort("nome")}
                    className="py-3 px-4 font-bold bg-slate-100 min-w-[240px] cursor-pointer hover:bg-slate-200/80 transition group"
                    title="Clique para ordenar por Loja"
                  >
                    <div className="flex items-center gap-1">
                      <span>Loja</span>
                      {renderSortIndicator("nome")}
                    </div>
                  </th>

                  {/* Coluna Total */}
                  <th
                    onClick={() => handleHeaderSort("total")}
                    className="py-3 px-3 font-bold text-center bg-slate-200/70 min-w-[110px] cursor-pointer hover:bg-slate-300/80 transition group"
                    title="Clique para ordenar por Total Pendente"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Total Pendente</span>
                      {renderSortIndicator("total")}
                    </div>
                  </th>

                  {/* Coluna No Prazo (OK) */}
                  <th
                    onClick={() => handleHeaderSort("no_prazo")}
                    className={cn(
                      "py-3 px-3 font-bold text-center min-w-[105px] cursor-pointer hover:brightness-95 transition group",
                      FAIXA_CONFIG.no_prazo.bgHeader,
                      FAIXA_CONFIG.no_prazo.textHeader,
                    )}
                    title="Clique para ordenar por pedidos No Prazo"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>No Prazo (OK)</span>
                      {renderSortIndicator("no_prazo")}
                    </div>
                  </th>

                  {/* Coluna 1 a 2 dias */}
                  <th
                    onClick={() => handleHeaderSort("1_2_dias")}
                    className={cn(
                      "py-3 px-3 font-bold text-center min-w-[100px] cursor-pointer hover:brightness-95 transition group",
                      FAIXA_CONFIG["1_2_dias"].bgHeader,
                      FAIXA_CONFIG["1_2_dias"].textHeader,
                    )}
                    title="Clique para ordenar por 1 a 2 dias"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>1 a 2 dias</span>
                      {renderSortIndicator("1_2_dias")}
                    </div>
                  </th>

                  {/* Coluna 3 a 4 dias */}
                  <th
                    onClick={() => handleHeaderSort("3_4_dias")}
                    className={cn(
                      "py-3 px-3 font-bold text-center min-w-[100px] cursor-pointer hover:brightness-95 transition group",
                      FAIXA_CONFIG["3_4_dias"].bgHeader,
                      FAIXA_CONFIG["3_4_dias"].textHeader,
                    )}
                    title="Clique para ordenar por 3 a 4 dias"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>3 a 4 dias</span>
                      {renderSortIndicator("3_4_dias")}
                    </div>
                  </th>

                  {/* Coluna 5 a 6 dias */}
                  <th
                    onClick={() => handleHeaderSort("5_6_dias")}
                    className={cn(
                      "py-3 px-3 font-bold text-center min-w-[100px] cursor-pointer hover:brightness-95 transition group",
                      FAIXA_CONFIG["5_6_dias"].bgHeader,
                      FAIXA_CONFIG["5_6_dias"].textHeader,
                    )}
                    title="Clique para ordenar por 5 a 6 dias"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>5 a 6 dias</span>
                      {renderSortIndicator("5_6_dias")}
                    </div>
                  </th>

                  {/* Coluna 7 a 10 dias */}
                  <th
                    onClick={() => handleHeaderSort("7_10_dias")}
                    className={cn(
                      "py-3 px-3 font-bold text-center min-w-[105px] cursor-pointer hover:brightness-95 transition group",
                      FAIXA_CONFIG["7_10_dias"].bgHeader,
                      FAIXA_CONFIG["7_10_dias"].textHeader,
                    )}
                    title="Clique para ordenar por 7 a 10 dias"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>7 a 10 dias</span>
                      {renderSortIndicator("7_10_dias")}
                    </div>
                  </th>

                  {/* Coluna 11 dias ou mais */}
                  <th
                    onClick={() => handleHeaderSort("11_mais")}
                    className={cn(
                      "py-3 px-3 font-bold text-center min-w-[120px] cursor-pointer hover:brightness-95 transition group",
                      FAIXA_CONFIG["11_mais"].bgHeader,
                      FAIXA_CONFIG["11_mais"].textHeader,
                    )}
                    title="Clique para ordenar por 11 dias ou mais"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>11 dias ou mais</span>
                      {renderSortIndicator("11_mais")}
                    </div>
                  </th>

                  {/* Coluna Pedidos Tratados */}
                  <th
                    onClick={() => handleHeaderSort("tratados")}
                    className="py-3 px-3 font-bold text-center min-w-[130px] cursor-pointer hover:brightness-95 transition group bg-sky-50/80 text-sky-800"
                    title="Pedidos em atraso com situação diferente de AG. TRATATIVA"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Pedidos Tratados</span>
                      {renderSortIndicator("tratados")}
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {/* Linha Consolidada ⚡ TOTAL GERAL (Sempre Fixa no topo, nunca reordenada) */}
                <tr className="bg-slate-100/90 font-bold border-b-2 border-slate-300 text-slate-900 sticky top-11 z-10 shadow-xs backdrop-blur-xs">
                  <td className="py-3 px-4 uppercase text-xs tracking-wider text-slate-800 bg-slate-200/90 font-extrabold">
                    ⚡ TOTAL GERAL CONSOLIDADO
                  </td>
                  <td className="py-3 px-3 text-center tabular-nums text-sm font-extrabold bg-slate-300/80 text-slate-950">
                    {totaisGerais.total.toLocaleString("pt-BR")}
                  </td>
                  <td className="py-3 px-3 text-center tabular-nums bg-emerald-50/90">
                    <span className="inline-block rounded-md px-2.5 py-0.5 text-xs font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300/60">
                      {totaisGerais.no_prazo.toLocaleString("pt-BR")}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center tabular-nums bg-amber-50/90">
                    <span className="inline-block rounded-md px-2.5 py-0.5 text-xs font-bold text-amber-800 bg-amber-100/90 border border-amber-300/60">
                      {totaisGerais.dias_1_2.toLocaleString("pt-BR")}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center tabular-nums bg-orange-50/90">
                    <span className="inline-block rounded-md px-2.5 py-0.5 text-xs font-bold text-orange-800 bg-orange-100/90 border border-orange-300/60">
                      {totaisGerais.dias_3_4.toLocaleString("pt-BR")}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center tabular-nums bg-orange-100/90">
                    <span className="inline-block rounded-md px-2.5 py-0.5 text-xs font-extrabold text-orange-950 bg-orange-200/90 border border-orange-400/60">
                      {totaisGerais.dias_5_6.toLocaleString("pt-BR")}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center tabular-nums bg-rose-50/90">
                    <span className="inline-block rounded-md px-2.5 py-0.5 text-xs font-extrabold text-rose-800 bg-rose-100/90 border border-rose-300/70">
                      {totaisGerais.dias_7_10.toLocaleString("pt-BR")}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center tabular-nums bg-purple-100/90">
                    <span className="inline-block rounded-md px-3 py-0.5 text-xs font-black text-purple-950 bg-purple-200/90 border border-purple-400/80">
                      {totaisGerais.dias_11_mais.toLocaleString("pt-BR")}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center tabular-nums bg-sky-50/90">
                    <span className="inline-block rounded-md px-3 py-0.5 text-xs font-black text-sky-900 bg-sky-100 border border-sky-300">
                      {totaisGerais.pedidosTratados.toLocaleString("pt-BR")}
                    </span>
                  </td>
                </tr>

                {/* Linhas de Cada Loja */}
                {matrizLojas.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 text-sm">
                      Nenhuma loja encontrada para os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  matrizLojas.map((row) => {
                    const isSelected = lojaSelecionada === row.nome_loja;
                    return (
                      <tr
                        key={row.nome_loja}
                        onClick={() =>
                          setLojaSelecionada((prev) =>
                            prev === row.nome_loja ? null : row.nome_loja,
                          )
                        }
                        className={cn(
                          "transition-colors cursor-pointer select-none",
                          isSelected
                            ? "bg-amber-50 hover:bg-amber-100/80 ring-1 ring-inset ring-amber-300"
                            : "hover:bg-slate-50/90",
                        )}
                        title="Clique para selecionar e exportar apenas os pedidos desta loja"
                      >
                        {/* Nome da Loja */}
                        <td className="py-3 px-4 font-semibold text-slate-800 text-sm">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "size-2 rounded-full transition",
                                isSelected ? "bg-amber-500 ring-2 ring-amber-200" : "bg-transparent",
                              )}
                            />
                            <span className="truncate block">{row.nome_loja}</span>
                          </div>
                        </td>

                        {/* Total */}
                        <td className="py-3 px-3 text-center tabular-nums font-bold text-slate-900 bg-slate-50/50 text-sm">
                          {row.total.toLocaleString("pt-BR")}
                        </td>

                        {/* No Prazo */}
                        <td className="py-3 px-3 text-center tabular-nums">
                          {row.no_prazo > 0 ? (
                            <span className="inline-block rounded-md px-2.5 py-0.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
                              {row.no_prazo.toLocaleString("pt-BR")}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-light">—</span>
                          )}
                        </td>

                        {/* 1 a 2 dias */}
                        <td className="py-3 px-3 text-center tabular-nums">
                          {row.dias_1_2 > 0 ? (
                            <span className="inline-block rounded-md px-2.5 py-0.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200">
                              {row.dias_1_2.toLocaleString("pt-BR")}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-light">—</span>
                          )}
                        </td>

                        {/* 3 a 4 dias */}
                        <td className="py-3 px-3 text-center tabular-nums">
                          {row.dias_3_4 > 0 ? (
                            <span className="inline-block rounded-md px-2.5 py-0.5 text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200">
                              {row.dias_3_4.toLocaleString("pt-BR")}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-light">—</span>
                          )}
                        </td>

                        {/* 5 a 6 dias */}
                        <td className="py-3 px-3 text-center tabular-nums">
                          {row.dias_5_6 > 0 ? (
                            <span className="inline-block rounded-md px-2.5 py-0.5 text-xs font-bold text-orange-950 bg-orange-100 border border-orange-300">
                              {row.dias_5_6.toLocaleString("pt-BR")}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-light">—</span>
                          )}
                        </td>

                        {/* 7 a 10 dias */}
                        <td className="py-3 px-3 text-center tabular-nums">
                          {row.dias_7_10 > 0 ? (
                            <span className="inline-block rounded-md px-2.5 py-0.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-300">
                              {row.dias_7_10.toLocaleString("pt-BR")}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-light">—</span>
                          )}
                        </td>

                        {/* 11 dias ou mais */}
                        <td className="py-3 px-3 text-center tabular-nums">
                          {row.dias_11_mais > 0 ? (
                            <span className="inline-block rounded-md px-2.5 py-0.5 text-xs font-extrabold text-purple-950 bg-purple-100 border border-purple-300">
                              {row.dias_11_mais.toLocaleString("pt-BR")}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-light">—</span>
                          )}
                        </td>

                        {/* Pedidos Tratados */}
                        <td className="py-3 px-3 text-center tabular-nums">
                          {row.pedidosTratados > 0 ? (
                            <span className="inline-block rounded-md px-2.5 py-0.5 text-xs font-bold text-sky-800 bg-sky-100 border border-sky-300">
                              {row.pedidosTratados.toLocaleString("pt-BR")}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-light">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

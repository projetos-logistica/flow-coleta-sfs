import { useMemo, useRef, useState } from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import {
  Pedido,
  isEscalaNoPrazo,
  legendaSituacao,
  type EditableField,
} from "@/lib/coletas";
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { toast } from "sonner";

export type AgingFaixaKey =
  | "no_prazo"
  | "1_2_dias"
  | "3_4_dias"
  | "5_6_dias"
  | "7_10_dias"
  | "11_mais";

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
    bgHeader: "bg-emerald-50/70",
    textHeader: "text-emerald-800",
    cellActive: "ring-2 ring-emerald-500 bg-emerald-100/60",
    badgeStyle: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  "1_2_dias": {
    label: "1 a 2 dias",
    sublabel: "Atenção suave",
    bgHeader: "bg-amber-50/70",
    textHeader: "text-amber-800",
    cellActive: "ring-2 ring-amber-500 bg-amber-100/60",
    badgeStyle: "bg-amber-50 text-amber-700 border-amber-200",
  },
  "3_4_dias": {
    label: "3 a 4 dias",
    sublabel: "Alerta",
    bgHeader: "bg-orange-50/70",
    textHeader: "text-orange-800",
    cellActive: "ring-2 ring-orange-500 bg-orange-100/60",
    badgeStyle: "bg-orange-50 text-orange-700 border-orange-200",
  },
  "5_6_dias": {
    label: "5 a 6 dias",
    sublabel: "Atraso moderado",
    bgHeader: "bg-orange-100/70",
    textHeader: "text-orange-950 font-semibold",
    cellActive: "ring-2 ring-orange-600 bg-orange-200/70",
    badgeStyle: "bg-orange-100 text-orange-900 border-orange-300 font-semibold",
  },
  "7_10_dias": {
    label: "7 a 10 dias",
    sublabel: "Atraso grave",
    bgHeader: "bg-rose-50/80",
    textHeader: "text-rose-800 font-bold",
    cellActive: "ring-2 ring-rose-500 bg-rose-100/70",
    badgeStyle: "bg-rose-50 text-rose-700 border-rose-300 font-bold",
  },
  "11_mais": {
    label: "11 dias ou mais",
    sublabel: "Crítico",
    bgHeader: "bg-purple-100/80",
    textHeader: "text-purple-950 font-extrabold",
    cellActive: "ring-2 ring-purple-600 bg-purple-200/80",
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
  usuario,
  onVoltarPainel,
  onNavigate,
  onChangeField,
}: AgingBacklogViewProps) {
  // ─── Filtros Rápidos ───
  const [filtroMarca, setFiltroMarca] = useState<string[]>([]);
  const [filtroOrigem, setFiltroOrigem] = useState<string[]>([]);
  const [filtroTransportadora, setFiltroTransportadora] = useState<string[]>([]);
  const [buscaTags, setBuscaTags] = useState<string[]>([]);
  const [buscaTexto, setBuscaTexto] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  // ─── Seleção Interativa de Loja e Faixa (Drill-down) ───
  const [selectedLoja, setSelectedLoja] = useState<string | null>(null);
  const [selectedFaixa, setSelectedFaixa] = useState<AgingFaixaKey | null>(null);

  // ─── Paginação da Tabela de Drill-down ───
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);

  // ─── Ordenação da Matriz ───
  const [ordenarPor, setOrdenarPor] = useState<
    "smart" | "total" | "nome" | AgingFaixaKey
  >("smart");
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

      if (todosTermos.length > 0) {
        const conteudo = `${p.numero_pedido} ${p.nome_loja} ${p.transportadora} ${p.marca} ${p.origem} ${p.situacao}`.toLowerCase();
        const bateu = todosTermos.some((termo) => conteudo.includes(termo));
        if (!bateu) return false;
      }

      return true;
    });
  }, [pedidosPendentes, filtroMarca, filtroOrigem, filtroTransportadora, buscaTags, buscaTexto]);

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
    });

    const lista = Array.from(mapa.values());

    // Ordenação da Matriz
    lista.sort((a, b) => {
      if (ordenarPor === "smart") {
        // Ordenação inteligente: prioriza 11+ dias, depois 7-10, depois 5-6, 3-4 e total
        if (b.dias_11_mais !== a.dias_11_mais)
          return b.dias_11_mais - a.dias_11_mais;
        if (b.dias_7_10 !== a.dias_7_10) return b.dias_7_10 - a.dias_7_10;
        if (b.dias_5_6 !== a.dias_5_6) return b.dias_5_6 - a.dias_5_6;
        if (b.dias_3_4 !== a.dias_3_4) return b.dias_3_4 - a.dias_3_4;
        return b.total - a.total;
      }
      if (ordenarPor === "total") {
        return ordemDesc ? b.total - a.total : a.total - b.total;
      }
      if (ordenarPor === "nome") {
        return ordemDesc
          ? a.nome_loja.localeCompare(b.nome_loja)
          : b.nome_loja.localeCompare(a.nome_loja);
      }
      if (ordenarPor === "11_mais") {
        return ordemDesc
          ? b.dias_11_mais - a.dias_11_mais
          : a.dias_11_mais - b.dias_11_mais;
      }
      if (ordenarPor === "7_10_dias") {
        return ordemDesc
          ? b.dias_7_10 - a.dias_7_10
          : a.dias_7_10 - b.dias_7_10;
      }
      if (ordenarPor === "5_6_dias") {
        return ordemDesc ? b.dias_5_6 - a.dias_5_6 : a.dias_5_6 - b.dias_5_6;
      }
      if (ordenarPor === "3_4_dias") {
        return ordemDesc ? b.dias_3_4 - a.dias_3_4 : a.dias_3_4 - b.dias_3_4;
      }
      if (ordenarPor === "1_2_dias") {
        return ordemDesc ? b.dias_1_2 - a.dias_1_2 : a.dias_1_2 - b.dias_1_2;
      }
      if (ordenarPor === "no_prazo") {
        return ordemDesc ? b.no_prazo - a.no_prazo : a.no_prazo - b.no_prazo;
      }
      return 0;
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
      },
    );
  }, [matrizLojas]);

  // 4. Lista Detalhada de Pedidos (Drill-down filtrada pela loja / faixa selecionada)
  const pedidosDrillDown = useMemo(() => {
    return pendentesFiltrados
      .filter((p) => {
        if (selectedLoja && p.nome_loja?.trim() !== selectedLoja.trim())
          return false;
        if (selectedFaixa && classificarFaixa(p.escala_coleta) !== selectedFaixa)
          return false;
        return true;
      })
      .sort((a, b) => {
        // Ordena por criticidade da escala e depois data
        const getPesoFaixa = (escala?: string) => {
          const f = classificarFaixa(escala);
          switch (f) {
            case "11_mais":
              return 6;
            case "7_10_dias":
              return 5;
            case "5_6_dias":
              return 4;
            case "3_4_dias":
              return 3;
            case "1_2_dias":
              return 2;
            case "no_prazo":
              return 1;
            default:
              return 0;
          }
        };
        const pesoA = getPesoFaixa(a.escala_coleta);
        const pesoB = getPesoFaixa(b.escala_coleta);
        if (pesoA !== pesoB) return pesoB - pesoA;

        // Desempate por data mais antiga
        const toIso = (d?: string) => {
          if (!d) return "9999-99-99";
          const p = d.split("/");
          return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : d;
        };
        return toIso(a.data_pedido).localeCompare(toIso(b.data_pedido));
      });
  }, [pendentesFiltrados, selectedLoja, selectedFaixa]);

  // Paginação do Drill-down
  const totalPaginas = Math.max(1, Math.ceil(pedidosDrillDown.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const paginadosDrillDown = useMemo(() => {
    return pedidosDrillDown.slice(
      (paginaAtual - 1) * porPagina,
      paginaAtual * porPagina,
    );
  }, [pedidosDrillDown, paginaAtual, porPagina]);

  // Handlers para Interatividade da Matriz
  function handleSelectLoja(lojaNome: string) {
    if (selectedLoja === lojaNome && selectedFaixa === null) {
      setSelectedLoja(null);
    } else {
      setSelectedLoja(lojaNome);
      setSelectedFaixa(null);
    }
    setPagina(1);
  }

  function handleSelectCelula(lojaNome: string, faixa: AgingFaixaKey, count: number) {
    if (count === 0) return;
    if (selectedLoja === lojaNome && selectedFaixa === faixa) {
      setSelectedLoja(null);
      setSelectedFaixa(null);
    } else {
      setSelectedLoja(lojaNome);
      setSelectedFaixa(faixa);
    }
    setPagina(1);
  }

  function handleSelectFaixaGlobal(faixa: AgingFaixaKey) {
    if (selectedFaixa === faixa && selectedLoja === null) {
      setSelectedFaixa(null);
    } else {
      setSelectedLoja(null);
      setSelectedFaixa(faixa);
    }
    setPagina(1);
  }

  function limparSelecaoMatriz() {
    setSelectedLoja(null);
    setSelectedFaixa(null);
    setPagina(1);
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
    buscaTags.length > 0 ||
    !!buscaTexto;

  function limparTodosFiltros() {
    setFiltroMarca([]);
    setFiltroOrigem([]);
    setFiltroTransportadora([]);
    setBuscaTags([]);
    setBuscaTexto("");
    setSelectedLoja(null);
    setSelectedFaixa(null);
    setPagina(1);
  }

  // Exportação para Excel
  function exportarDrillDown() {
    if (pedidosDrillDown.length === 0) {
      toast.error("Não há pedidos para exportar.");
      return;
    }
    const linhas = pedidosDrillDown.map((p) => ({
      "Data do Pedido": p.data_pedido,
      "Número do Pedido": p.numero_pedido,
      "Nome da Loja": p.nome_loja,
      "Transportadora": p.transportadora,
      "Origem": p.origem,
      "Marca": p.marca,
      "UF Destino": p.uf_destino,
      "Escala Coleta": p.escala_coleta,
      "Status Coleta": p.status_coleta,
      "Situação": p.situacao,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), "Aging_Backlog");
    const ts = new Date().toISOString().slice(0, 10);
    const sulfix = selectedLoja ? `_${selectedLoja.replace(/\s+/g, "_")}` : "";
    XLSX.writeFile(wb, `Aging_Backlog${sulfix}_${ts}.xlsx`);
    toast.success("Planilha gerada com sucesso!");
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-100 text-slate-800">
      {/* Sidebar Fixa no desktop */}
      <AdminSidebar
        telaAtual="aging"
        onSelectTela={(tela) => {
          if (tela === "painel") onVoltarPainel();
          else onNavigate(tela);
        }}
        className="hidden md:flex shrink-0 border-r border-slate-800/20"
      />

      {/* Área Principal */}
      <div className="flex-1 flex flex-col min-w-0">
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
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6">
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

          {/* 2. MATRIZ DE ENVELHECIMENTO POR LOJA (PAINEL SUPERIOR) */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
              <div>
                <div className="flex items-center gap-2">
                  <Store className="size-4 text-amber-400" />
                  <h2 className="text-base font-bold">Matriz de Envelhecimento por Loja</h2>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-300">
                    {matrizLojas.length} lojas
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Clique na loja para filtrar todos os pedidos, ou diretamente em uma célula de faixa para isolar uma urgência específica.
                </p>
              </div>

              {/* Botão de Ordenação Inteligente */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Ordenação:</span>
                <button
                  type="button"
                  onClick={() => {
                    setOrdenarPor("smart");
                    setOrdemDesc(true);
                  }}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer",
                    ordenarPor === "smart"
                      ? "bg-amber-400 text-slate-950 font-bold"
                      : "bg-white/10 text-slate-300 hover:bg-white/20",
                  )}
                >
                  ⚡ Maior Criticidade (Smart)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrdenarPor("total");
                    setOrdemDesc(!ordemDesc);
                  }}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer",
                    ordenarPor === "total"
                      ? "bg-amber-400 text-slate-950 font-bold"
                      : "bg-white/10 text-slate-300 hover:bg-white/20",
                  )}
                >
                  📦 Total Volume
                </button>
              </div>
            </div>

            {/* Tabela Matriz */}
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-slate-700 shadow-2xs">
                  <tr>
                    <th className="py-3 px-4 font-bold bg-slate-100 min-w-[220px]">
                      Loja
                    </th>
                    <th className="py-3 px-3 font-bold text-center bg-slate-200/60 min-w-[90px]">
                      Total Pendente
                    </th>
                    <th className={cn("py-3 px-3 font-bold text-center min-w-[95px]", FAIXA_CONFIG.no_prazo.bgHeader, FAIXA_CONFIG.no_prazo.textHeader)}>
                      No Prazo
                    </th>
                    <th className={cn("py-3 px-3 font-bold text-center min-w-[95px]", FAIXA_CONFIG["1_2_dias"].bgHeader, FAIXA_CONFIG["1_2_dias"].textHeader)}>
                      1 a 2 dias
                    </th>
                    <th className={cn("py-3 px-3 font-bold text-center min-w-[95px]", FAIXA_CONFIG["3_4_dias"].bgHeader, FAIXA_CONFIG["3_4_dias"].textHeader)}>
                      3 a 4 dias
                    </th>
                    <th className={cn("py-3 px-3 font-bold text-center min-w-[95px]", FAIXA_CONFIG["5_6_dias"].bgHeader, FAIXA_CONFIG["5_6_dias"].textHeader)}>
                      5 a 6 dias
                    </th>
                    <th className={cn("py-3 px-3 font-bold text-center min-w-[95px]", FAIXA_CONFIG["7_10_dias"].bgHeader, FAIXA_CONFIG["7_10_dias"].textHeader)}>
                      7 a 10 dias
                    </th>
                    <th className={cn("py-3 px-3 font-bold text-center min-w-[110px]", FAIXA_CONFIG["11_mais"].bgHeader, FAIXA_CONFIG["11_mais"].textHeader)}>
                      11 dias ou mais
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {/* Linha de Totais Gerais (Resumo Superior) */}
                  <tr className="bg-slate-50 font-bold border-b-2 border-slate-200 text-slate-900 sticky top-10 z-10">
                    <td className="py-2.5 px-4 uppercase text-[11px] tracking-wider text-slate-700 bg-slate-100">
                      ⚡ TOTAL GERAL CONSOLIDADO
                    </td>
                    <td className="py-2.5 px-3 text-center tabular-nums text-sm bg-slate-200/80">
                      {totaisGerais.total.toLocaleString("pt-BR")}
                    </td>
                    <td
                      onClick={() => handleSelectFaixaGlobal("no_prazo")}
                      className={cn(
                        "py-2.5 px-3 text-center tabular-nums cursor-pointer transition hover:bg-emerald-100",
                        selectedFaixa === "no_prazo" && selectedLoja === null
                          ? FAIXA_CONFIG.no_prazo.cellActive
                          : "",
                      )}
                      title="Clique para filtrar todos 'No Prazo'"
                    >
                      <span className="inline-block rounded-md px-2 py-0.5 text-xs text-emerald-800 bg-emerald-100/70">
                        {totaisGerais.no_prazo.toLocaleString("pt-BR")}
                      </span>
                    </td>
                    <td
                      onClick={() => handleSelectFaixaGlobal("1_2_dias")}
                      className={cn(
                        "py-2.5 px-3 text-center tabular-nums cursor-pointer transition hover:bg-amber-100",
                        selectedFaixa === "1_2_dias" && selectedLoja === null
                          ? FAIXA_CONFIG["1_2_dias"].cellActive
                          : "",
                      )}
                      title="Clique para filtrar todos '1 a 2 dias'"
                    >
                      <span className="inline-block rounded-md px-2 py-0.5 text-xs text-amber-800 bg-amber-100/70">
                        {totaisGerais.dias_1_2.toLocaleString("pt-BR")}
                      </span>
                    </td>
                    <td
                      onClick={() => handleSelectFaixaGlobal("3_4_dias")}
                      className={cn(
                        "py-2.5 px-3 text-center tabular-nums cursor-pointer transition hover:bg-orange-100",
                        selectedFaixa === "3_4_dias" && selectedLoja === null
                          ? FAIXA_CONFIG["3_4_dias"].cellActive
                          : "",
                      )}
                      title="Clique para filtrar todos '3 a 4 dias'"
                    >
                      <span className="inline-block rounded-md px-2 py-0.5 text-xs text-orange-800 bg-orange-100/70">
                        {totaisGerais.dias_3_4.toLocaleString("pt-BR")}
                      </span>
                    </td>
                    <td
                      onClick={() => handleSelectFaixaGlobal("5_6_dias")}
                      className={cn(
                        "py-2.5 px-3 text-center tabular-nums cursor-pointer transition hover:bg-orange-200",
                        selectedFaixa === "5_6_dias" && selectedLoja === null
                          ? FAIXA_CONFIG["5_6_dias"].cellActive
                          : "",
                      )}
                      title="Clique para filtrar todos '5 a 6 dias'"
                    >
                      <span className="inline-block rounded-md px-2 py-0.5 text-xs text-orange-950 font-bold bg-orange-200/70">
                        {totaisGerais.dias_5_6.toLocaleString("pt-BR")}
                      </span>
                    </td>
                    <td
                      onClick={() => handleSelectFaixaGlobal("7_10_dias")}
                      className={cn(
                        "py-2.5 px-3 text-center tabular-nums cursor-pointer transition hover:bg-rose-100",
                        selectedFaixa === "7_10_dias" && selectedLoja === null
                          ? FAIXA_CONFIG["7_10_dias"].cellActive
                          : "",
                      )}
                      title="Clique para filtrar todos '7 a 10 dias'"
                    >
                      <span className="inline-block rounded-md px-2 py-0.5 text-xs text-rose-800 font-bold bg-rose-100/80">
                        {totaisGerais.dias_7_10.toLocaleString("pt-BR")}
                      </span>
                    </td>
                    <td
                      onClick={() => handleSelectFaixaGlobal("11_mais")}
                      className={cn(
                        "py-2.5 px-3 text-center tabular-nums cursor-pointer transition hover:bg-purple-200",
                        selectedFaixa === "11_mais" && selectedLoja === null
                          ? FAIXA_CONFIG["11_mais"].cellActive
                          : "",
                      )}
                      title="Clique para filtrar todos '11 dias ou mais'"
                    >
                      <span className="inline-block rounded-md px-2 py-0.5 text-xs text-purple-950 font-extrabold bg-purple-200/90">
                        {totaisGerais.dias_11_mais.toLocaleString("pt-BR")}
                      </span>
                    </td>
                  </tr>

                  {/* Linhas de Cada Loja */}
                  {matrizLojas.map((row) => {
                    const isLojaSelected = selectedLoja === row.nome_loja;

                    return (
                      <tr
                        key={row.nome_loja}
                        className={cn(
                          "transition-colors hover:bg-slate-50",
                          isLojaSelected && "bg-indigo-50/40",
                        )}
                      >
                        {/* Nome da Loja (Clicável para filtrar a loja inteira) */}
                        <td
                          onClick={() => handleSelectLoja(row.nome_loja)}
                          className="py-2.5 px-4 font-semibold text-slate-800 cursor-pointer hover:text-indigo-600 transition"
                          title="Clique para filtrar apenas esta loja"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{row.nome_loja}</span>
                            {isLojaSelected && selectedFaixa === null && (
                              <span className="rounded-full bg-indigo-600 px-1.5 py-0.2 text-[9px] font-bold text-white">
                                Selecionada
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Total Pendente */}
                        <td
                          onClick={() => handleSelectLoja(row.nome_loja)}
                          className="py-2.5 px-3 text-center tabular-nums font-bold text-slate-900 cursor-pointer hover:bg-slate-100"
                        >
                          {row.total.toLocaleString("pt-BR")}
                        </td>

                        {/* Célula: No Prazo */}
                        <td
                          onClick={() => handleSelectCelula(row.nome_loja, "no_prazo", row.no_prazo)}
                          className={cn(
                            "py-2.5 px-3 text-center tabular-nums cursor-pointer transition",
                            row.no_prazo > 0 ? "hover:bg-emerald-50" : "text-slate-300",
                            isLojaSelected && selectedFaixa === "no_prazo" && FAIXA_CONFIG.no_prazo.cellActive,
                          )}
                        >
                          {row.no_prazo > 0 ? (
                            <span className="inline-block rounded-md px-2 py-0.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100">
                              {row.no_prazo.toLocaleString("pt-BR")}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>

                        {/* Célula: 1 a 2 dias */}
                        <td
                          onClick={() => handleSelectCelula(row.nome_loja, "1_2_dias", row.dias_1_2)}
                          className={cn(
                            "py-2.5 px-3 text-center tabular-nums cursor-pointer transition",
                            row.dias_1_2 > 0 ? "hover:bg-amber-50" : "text-slate-300",
                            isLojaSelected && selectedFaixa === "1_2_dias" && FAIXA_CONFIG["1_2_dias"].cellActive,
                          )}
                        >
                          {row.dias_1_2 > 0 ? (
                            <span className="inline-block rounded-md px-2 py-0.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200">
                              {row.dias_1_2.toLocaleString("pt-BR")}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>

                        {/* Célula: 3 a 4 dias */}
                        <td
                          onClick={() => handleSelectCelula(row.nome_loja, "3_4_dias", row.dias_3_4)}
                          className={cn(
                            "py-2.5 px-3 text-center tabular-nums cursor-pointer transition",
                            row.dias_3_4 > 0 ? "hover:bg-orange-50" : "text-slate-300",
                            isLojaSelected && selectedFaixa === "3_4_dias" && FAIXA_CONFIG["3_4_dias"].cellActive,
                          )}
                        >
                          {row.dias_3_4 > 0 ? (
                            <span className="inline-block rounded-md px-2 py-0.5 text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200">
                              {row.dias_3_4.toLocaleString("pt-BR")}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>

                        {/* Célula: 5 a 6 dias */}
                        <td
                          onClick={() => handleSelectCelula(row.nome_loja, "5_6_dias", row.dias_5_6)}
                          className={cn(
                            "py-2.5 px-3 text-center tabular-nums cursor-pointer transition",
                            row.dias_5_6 > 0 ? "hover:bg-orange-100" : "text-slate-300",
                            isLojaSelected && selectedFaixa === "5_6_dias" && FAIXA_CONFIG["5_6_dias"].cellActive,
                          )}
                        >
                          {row.dias_5_6 > 0 ? (
                            <span className="inline-block rounded-md px-2 py-0.5 text-xs font-bold text-orange-950 bg-orange-100 border border-orange-300">
                              {row.dias_5_6.toLocaleString("pt-BR")}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>

                        {/* Célula: 7 a 10 dias */}
                        <td
                          onClick={() => handleSelectCelula(row.nome_loja, "7_10_dias", row.dias_7_10)}
                          className={cn(
                            "py-2.5 px-3 text-center tabular-nums cursor-pointer transition",
                            row.dias_7_10 > 0 ? "hover:bg-rose-50" : "text-slate-300",
                            isLojaSelected && selectedFaixa === "7_10_dias" && FAIXA_CONFIG["7_10_dias"].cellActive,
                          )}
                        >
                          {row.dias_7_10 > 0 ? (
                            <span className="inline-block rounded-md px-2 py-0.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-300">
                              {row.dias_7_10.toLocaleString("pt-BR")}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>

                        {/* Célula: 11 dias ou mais */}
                        <td
                          onClick={() => handleSelectCelula(row.nome_loja, "11_mais", row.dias_11_mais)}
                          className={cn(
                            "py-2.5 px-3 text-center tabular-nums cursor-pointer transition",
                            row.dias_11_mais > 0 ? "hover:bg-purple-100" : "text-slate-300",
                            isLojaSelected && selectedFaixa === "11_mais" && FAIXA_CONFIG["11_mais"].cellActive,
                          )}
                        >
                          {row.dias_11_mais > 0 ? (
                            <span className="inline-block rounded-md px-2.5 py-0.5 text-xs font-extrabold text-purple-950 bg-purple-100 border border-purple-300">
                              {row.dias_11_mais.toLocaleString("pt-BR")}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. LISTA DETALHADA DE PEDIDOS (DRILL-DOWN) */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Header do Drill-down com Banner de Filtro Ativo e Exportação */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Layers className="size-4 text-indigo-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Lista Detalhada de Pedidos
                </h3>

                {/* Badge Dinâmico de Filtro Ativo na Matriz */}
                {selectedLoja || selectedFaixa ? (
                  <div className="flex items-center gap-2 rounded-xl bg-indigo-50 border border-indigo-200/80 px-2.5 py-1 text-xs text-indigo-900 font-medium">
                    <span>
                      Filtrando por:{" "}
                      {selectedLoja && <strong>{selectedLoja}</strong>}
                      {selectedLoja && selectedFaixa && " › "}
                      {selectedFaixa && (
                        <span className="font-semibold text-indigo-700">
                          {FAIXA_CONFIG[selectedFaixa].label}
                        </span>
                      )}
                      {" ("}
                      {pedidosDrillDown.length} pedidos{")"}
                    </span>
                    <button
                      type="button"
                      onClick={limparSelecaoMatriz}
                      className="rounded-full p-0.5 hover:bg-indigo-200 text-indigo-700 cursor-pointer"
                      title="Limpar filtro de loja/faixa"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-slate-500 font-medium">
                    ({pedidosDrillDown.length.toLocaleString("pt-BR")} pedidos pendentes exibidos)
                  </span>
                )}
              </div>

              {/* Ações da Tabela Detalhada */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportarDrillDown}
                  className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 cursor-pointer"
                >
                  <Download className="size-3.5 text-slate-500" />
                  Exportar (.xlsx)
                </button>
              </div>
            </div>

            {/* Tabela de Pedidos */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/50 text-slate-600">
                  <tr>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Data do Pedido</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Número do Pedido</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Nome da Loja</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Transportadora</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Origem</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Marca</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">UF Destino</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Escala Coleta</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Status Coleta</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginadosDrillDown.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-xs text-slate-400">
                        Nenhum pedido encontrado para a seleção atual.
                      </td>
                    </tr>
                  ) : (
                    paginadosDrillDown.map((p) => {
                      const faixa = classificarFaixa(p.escala_coleta);
                      const config = FAIXA_CONFIG[faixa];

                      return (
                        <tr
                          key={p.numero_pedido}
                          className="hover:bg-slate-50/80 transition-colors"
                        >
                          <td className="py-3 px-4 text-slate-700 tabular-nums whitespace-nowrap">
                            {p.data_pedido}
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                            {p.numero_pedido}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-800 whitespace-nowrap">
                            {p.nome_loja}
                          </td>
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                            {p.transportadora}
                          </td>
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                            {p.origem}
                          </td>
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                            {p.marca}
                          </td>
                          <td className="py-3 px-4 text-slate-700 font-semibold whitespace-nowrap">
                            {p.uf_destino}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] border",
                                config.badgeStyle,
                              )}
                            >
                              {p.escala_coleta}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                              {p.status_coleta}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <TooltipProvider delayDuration={300}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 cursor-default">
                                    {p.situacao}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs text-xs">
                                  {legendaSituacao(p.situacao) ?? p.situacao}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginação da Tabela de Drill-down */}
            {pedidosDrillDown.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span>Itens por página:</span>
                  <select
                    value={porPagina}
                    onChange={(e) => {
                      setPorPagina(Number(e.target.value));
                      setPagina(1);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 shadow-2xs focus:border-indigo-500 focus:outline-none"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span>
                    Exibindo {(paginaAtual - 1) * porPagina + 1} a{" "}
                    {Math.min(paginaAtual * porPagina, pedidosDrillDown.length)} de{" "}
                    {pedidosDrillDown.length.toLocaleString("pt-BR")}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={paginaAtual <= 1}
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                    className="inline-flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-2xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Página anterior"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <span className="px-2 font-medium">
                    Página {paginaAtual} de {totalPaginas}
                  </span>
                  <button
                    type="button"
                    disabled={paginaAtual >= totalPaginas}
                    onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                    className="inline-flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-2xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Próxima página"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

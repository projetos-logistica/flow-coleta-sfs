import { createContext, useContext, useState, type ReactNode, useCallback } from "react";

interface FiltersState {
  // Filtros globais (barra de topo)
  filtroDataInicio: string;
  filtroDataFim: string;
  filtroMarca: string[];
  filtroOrigem: string[];
  filtroTransportadora: string[];
  filtroEscala: string[];
  filtroLoja: string[];

  // Busca em massa e contato (compartilhados entre painel e aging)
  buscaTags: string[];
  buscaTexto: string;
  filtroContato: string;

  // Setters
  setFiltroDataInicio: (v: string) => void;
  setFiltroDataFim: (v: string) => void;
  setFiltroMarca: React.Dispatch<React.SetStateAction<string[]>>;
  setFiltroOrigem: React.Dispatch<React.SetStateAction<string[]>>;
  setFiltroTransportadora: React.Dispatch<React.SetStateAction<string[]>>;
  setFiltroEscala: React.Dispatch<React.SetStateAction<string[]>>;
  setFiltroLoja: React.Dispatch<React.SetStateAction<string[]>>;
  setBuscaTags: React.Dispatch<React.SetStateAction<string[]>>;
  setBuscaTexto: (v: string) => void;
  setFiltroContato: (v: string) => void;

  limparFiltrosGlobais: () => void;
}

const FiltersContext = createContext<FiltersState | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [filtroMarca, setFiltroMarca] = useState<string[]>([]);
  const [filtroOrigem, setFiltroOrigem] = useState<string[]>([]);
  const [filtroTransportadora, setFiltroTransportadora] = useState<string[]>([]);
  const [filtroEscala, setFiltroEscala] = useState<string[]>([]);
  const [filtroLoja, setFiltroLoja] = useState<string[]>([]);
  const [buscaTags, setBuscaTags] = useState<string[]>([]);
  const [buscaTexto, setBuscaTexto] = useState("");
  const [filtroContato, setFiltroContato] = useState("");

  const limparFiltrosGlobais = useCallback(() => {
    setFiltroDataInicio("");
    setFiltroDataFim("");
    setFiltroMarca([]);
    setFiltroOrigem([]);
    setFiltroTransportadora([]);
    setFiltroEscala([]);
    setFiltroLoja([]);
    setBuscaTags([]);
    setBuscaTexto("");
    setFiltroContato("");
  }, []);

  return (
    <FiltersContext.Provider
      value={{
        filtroDataInicio,
        filtroDataFim,
        filtroMarca,
        filtroOrigem,
        filtroTransportadora,
        filtroEscala,
        filtroLoja,
        buscaTags,
        buscaTexto,
        filtroContato,
        setFiltroDataInicio,
        setFiltroDataFim,
        setFiltroMarca,
        setFiltroOrigem,
        setFiltroTransportadora,
        setFiltroEscala,
        setFiltroLoja,
        setBuscaTags,
        setBuscaTexto,
        setFiltroContato,
        limparFiltrosGlobais,
      }}
    >
      {children}
    </FiltersContext.Provider>
  );
}

export function useFilters() {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error("useFilters must be used within FiltersProvider");
  return ctx;
}

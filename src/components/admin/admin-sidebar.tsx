import lightLogo from "@/assets/logo-azzas-white.asset.json";
import { LayoutDashboard, Clock, Users, History, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminSidebarProps {
  telaAtual: "painel" | "aging" | "usuarios";
  onSelectTela: (tela: "painel" | "aging" | "usuarios") => void;
  onClose?: () => void;
  className?: string;
}

export function AdminSidebar({
  telaAtual,
  onSelectTela,
  onClose,
  className,
}: AdminSidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-full w-64 flex-col justify-between bg-[#0b1727] text-slate-300 p-4 select-none",
        className,
      )}
    >
      <div>
        {/* Logo AZZAS 2154 */}
        <div className="mb-8 flex items-center justify-between px-2 pt-2">
          <img
            src={lightLogo.url}
            alt="AZZAS 2154"
            className="h-7 w-auto object-contain brightness-110"
          />
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition lg:hidden"
              title="Fechar menu"
            >
              <ChevronLeft className="size-5" />
            </button>
          )}
        </div>

        {/* Grupo: Visão Geral */}
        <div className="mb-6">
          <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Visão geral
          </p>
          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => {
                onSelectTela("painel");
                onClose?.();
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition cursor-pointer",
                telaAtual === "painel"
                  ? "bg-blue-600/30 text-white font-semibold shadow-xs"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
              )}
            >
              <LayoutDashboard className="size-4 shrink-0 text-slate-400" />
              <span>Painel operacional</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectTela("aging");
                onClose?.();
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition cursor-pointer",
                telaAtual === "aging"
                  ? "bg-blue-600/30 text-white font-semibold shadow-xs"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
              )}
            >
              <Clock className="size-4 shrink-0 text-amber-400" />
              <span>Aging de Backlog</span>
            </button>
          </nav>
        </div>

        {/* Grupo: Administração */}
        <div className="mb-6">
          <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Administração
          </p>
          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => {
                onSelectTela("usuarios");
                onClose?.();
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition",
                telaAtual === "usuarios"
                  ? "bg-blue-600/30 text-white font-semibold shadow-xs"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
              )}
            >
              <Users className="size-4 shrink-0 text-blue-400" />
              <span>Usuários e aprovações</span>
            </button>

            <button
              type="button"
              disabled
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 opacity-60 cursor-not-allowed"
            >
              <History className="size-4 shrink-0 text-slate-500" />
              <span>Histórico de publicações</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Rodapé da Sidebar */}
      <div className="border-t border-white/10 pt-3 px-2">
        <button
          type="button"
          onClick={() => {
            if (onClose) onClose();
            else onSelectTela(telaAtual === "painel" ? "usuarios" : "painel");
          }}
          className="flex size-8 items-center justify-center rounded-full bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition"
          title="Recolher / Alternar"
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>
    </aside>
  );
}

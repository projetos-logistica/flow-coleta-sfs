import { useState } from "react";
import {
  LayoutDashboard,
  Clock,
  Users,
  History,
  Pin,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface AdminSidebarProps {
  telaAtual: "painel" | "aging" | "usuarios" | "historico";
  onSelectTela: (tela: "painel" | "aging" | "usuarios" | "historico") => void;
  isAdmin?: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
  className?: string;
}

export function AdminSidebar({
  telaAtual,
  onSelectTela,
  isAdmin = false,
  isPinned = false,
  onTogglePin,
  className,
}: AdminSidebarProps) {
  const [isHovered, setIsHovered] = useState(false);

  const isExpanded = isPinned || isHovered;

  const navItems = [
    {
      id: "painel" as const,
      label: "Painel operacional",
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: "aging" as const,
      label: "Aging de Backlog",
      icon: Clock,
      badge: "Novo",
    },
    {
      id: "usuarios" as const,
      label: "Usuários e aprovações",
      icon: Users,
      badge: null,
    },
  ];

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "fixed left-0 top-0 bottom-0 z-50 flex flex-col justify-between select-none",
          "bg-[#0F172A] border-r border-slate-800 text-slate-300 transition-all duration-300 ease-in-out",
          isExpanded ? "w-64 shadow-2xl" : "w-16 shadow-md",
          className,
        )}
      >
        {/* Topo: Marca AZZAS 2154 & Botão de Trava/Fixar */}
        <div>
          <div className="flex h-16 items-center justify-between px-3 border-b border-slate-800/80">
            {isExpanded ? (
              <div className="flex items-center justify-between w-full">
                {/* Logo Expandido AZZAS 2154 */}
                <div className="flex items-baseline gap-1.5 px-2 select-none">
                  <span className="text-xl font-black tracking-tight text-white">AZZAS</span>
                  <span className="text-xs font-bold tracking-widest text-indigo-400">2154</span>
                </div>

                {/* Botão de Fixar/Desafixar no topo */}
                {onTogglePin && (
                  <button
                    type="button"
                    onClick={onTogglePin}
                    className={cn(
                      "inline-flex size-8 items-center justify-center rounded-lg transition cursor-pointer",
                      isPinned
                        ? "bg-indigo-600/30 text-indigo-400 hover:bg-indigo-600/40"
                        : "text-slate-400 hover:bg-slate-800 hover:text-white",
                    )}
                    title={isPinned ? "Desafixar barra lateral" : "Fixar barra lateral aberta"}
                  >
                    <Pin className={cn("size-4 transition-transform", isPinned && "rotate-45 text-indigo-400")} />
                  </button>
                )}
              </div>
            ) : (
              /* Logo Compacto AZZAS 2154 (Monograma AZ 2154) */
              <div className="flex flex-col items-center justify-center w-full py-1 leading-none select-none">
                <span className="text-base font-black tracking-tighter text-white">AZ</span>
                <span className="text-[9px] font-bold text-indigo-400">2154</span>
              </div>
            )}
          </div>

          {/* Navegação Principal */}
          <div className="p-2 space-y-1.5 mt-2">
            {isExpanded && (
              <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Módulos
              </p>
            )}

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = telaAtual === item.id;

              const buttonContent = (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTela(item.id)}
                  className={cn(
                    "flex items-center rounded-xl transition-all duration-200 cursor-pointer font-medium text-xs",
                    isExpanded
                      ? "w-full gap-3 px-3 py-2.5 text-left"
                      : "size-11 mx-auto justify-center",
                    isActive
                      ? "bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/70",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-5 shrink-0 transition-colors",
                      isActive ? "text-white" : "text-slate-400 group-hover:text-white",
                    )}
                  />

                  {isExpanded && (
                    <span className="truncate flex-1 font-medium text-slate-100">
                      {item.label}
                    </span>
                  )}

                  {isExpanded && item.badge && (
                    <span className="rounded-full bg-indigo-500/30 px-1.5 py-0.5 text-[9px] font-bold text-indigo-300">
                      {item.badge}
                    </span>
                  )}
                </button>
              );

              if (!isExpanded) {
                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
                    <TooltipContent side="right" className="bg-slate-900 text-white text-xs border-slate-700">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return buttonContent;
            })}

            {/* Ação: Histórico de Alterações (Exclusivo para ADMs) */}
            {isAdmin && (
              <>
                <div className="my-3 border-t border-slate-800/80 px-2" />
                {(() => {
                  const isActive = telaAtual === "historico";
                  const historyButton = (
                    <button
                      type="button"
                      onClick={() => onSelectTela("historico")}
                      className={cn(
                        "flex items-center rounded-xl transition-all duration-200 cursor-pointer text-xs font-medium",
                        isExpanded
                          ? "w-full gap-3 px-3 py-2.5 text-left"
                          : "size-11 mx-auto justify-center",
                        isActive
                          ? "bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30"
                          : "text-slate-400 hover:text-white hover:bg-slate-800/70",
                      )}
                    >
                      <History
                        className={cn(
                          "size-5 shrink-0 transition-colors",
                          isActive ? "text-white" : "text-slate-400",
                        )}
                      />
                      {isExpanded && (
                        <span className="truncate flex-1">Histórico de alterações</span>
                      )}
                    </button>
                  );

                  if (!isExpanded) {
                    return (
                      <Tooltip>
                        <TooltipTrigger asChild>{historyButton}</TooltipTrigger>
                        <TooltipContent side="right" className="bg-slate-900 text-white text-xs border-slate-700">
                          Histórico de alterações
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return historyButton;
                })()}
              </>
            )}
          </div>
        </div>

        {/* Rodapé: Botão de Alternar/Travar fixação */}
        <div className="p-2 border-t border-slate-800/80">
          {onTogglePin ? (
            <button
              type="button"
              onClick={onTogglePin}
              className={cn(
                "flex items-center rounded-xl transition-all duration-200 cursor-pointer text-xs font-medium",
                isExpanded
                  ? "w-full gap-3 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800/70"
                  : "size-11 mx-auto justify-center text-slate-400 hover:text-white hover:bg-slate-800/70",
              )}
              title={isPinned ? "Desafixar barra lateral" : "Fixar barra lateral aberta"}
            >
              {isPinned ? (
                <>
                  <ChevronLeft className="size-4 shrink-0 text-indigo-400" />
                  {isExpanded && <span className="truncate">Recolher / Desafixar</span>}
                </>
              ) : (
                <>
                  <ChevronRight className="size-4 shrink-0" />
                  {isExpanded && <span className="truncate">Fixar barra aberta</span>}
                </>
              )}
            </button>
          ) : (
            <div className="h-4" />
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}

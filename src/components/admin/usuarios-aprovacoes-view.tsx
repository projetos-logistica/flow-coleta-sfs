import { useState } from "react";
import { AdminSidebar } from "./admin-sidebar";
import { NovoUsuarioModal } from "./novo-usuario-modal";
import { useRbac } from "@/lib/rbac";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, LogOut, ShieldCheck, UserCheck, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface UsuariosAprovacoesViewProps {
  usuarioIdent: string;
  onVoltarPainel: () => void;
  onNavigate?: (tela: "painel" | "aging" | "usuarios") => void;
}

export function UsuariosAprovacoesView({
  usuarioIdent,
  onVoltarPainel,
  onNavigate,
}: UsuariosAprovacoesViewProps) {
  const {
    users,
    isAdmin,
    currentUserInfo,
    alterarPerfil,
    alterarSituacao,
    aprovarComPerfil,
    adicionarUsuario,
  } = useRbac(usuarioIdent);

  const [modalNovoAberto, setModalNovoAberto] = useState(false);

  // Normalização do e-mail/identificador atual
  const emailAtual = currentUserInfo.email.toLowerCase();
  const userAtual = emailAtual.split("@")[0];

  function isCurrentUserRow(userEmail: string) {
    const e = userEmail.toLowerCase();
    return e === emailAtual || e.split("@")[0] === userAtual;
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-100 text-slate-800">
      {/* Sidebar Fixa no desktop */}
      <AdminSidebar
        telaAtual="usuarios"
        onSelectTela={(tela) => {
          if (tela === "painel") onVoltarPainel();
          else if (onNavigate) onNavigate(tela);
        }}
        className="hidden md:flex shrink-0 border-r border-slate-800/20"
      />

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar do Módulo de Administração */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4 shadow-2xs">
          <div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onVoltarPainel}
                className="inline-flex md:hidden items-center gap-1 rounded-lg border border-slate-200 p-1.5 text-xs text-slate-600 hover:bg-slate-50 mr-1"
                title="Voltar ao painel"
              >
                <ArrowLeft className="size-4" />
              </button>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">
                Painel de Coletas <span className="font-normal text-slate-400">|</span> Usuários e aprovações
              </h1>
            </div>
            <p className="text-xs text-slate-500">Área administrativa de gestão de acessos e permissões (RBAC)</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onVoltarPainel}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
            >
              <ArrowLeft className="size-3.5 text-slate-500" />
              Painel operacional
            </button>

            <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs text-slate-700">
              <span className="font-medium">{currentUserInfo.email}</span>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                {isAdmin ? "administrador" : "visualizador"}
              </span>
            </div>

            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.replace("/auth");
              }}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition"
              title="Encerrar sessão"
            >
              <LogOut className="size-3.5" />
              Sair
            </button>
          </div>
        </header>

        {/* Corpo da Tela de Usuários */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl space-y-4">
            {/* Bloco Título / Header Escuro (Idêntico ao Layout do Print 2) */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0b1727] px-6 py-4 text-white">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Controle de acesso
                  </p>
                  <h2 className="text-lg font-bold">Cadastros</h2>
                </div>

                <div className="flex items-center gap-4">
                  <p className="hidden sm:block text-xs text-slate-300">
                    Novos cadastros só acessam o painel após aprovação
                  </p>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setModalNovoAberto(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-500 transition active:scale-95 cursor-pointer"
                    >
                      <UserPlus className="size-4" />
                      Novo Usuário
                    </button>
                  )}
                </div>
              </div>

              {/* Tabela de Usuários */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-600">
                    <tr>
                      <th className="py-3 px-4 font-semibold">E-mail</th>
                      <th className="py-3 px-4 font-semibold">Nome</th>
                      <th className="py-3 px-4 font-semibold">Cadastro</th>
                      <th className="py-3 px-4 font-semibold">Situação</th>
                      <th className="py-3 px-4 font-semibold">Perfil</th>
                      <th className="py-3 px-4 font-semibold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {users.map((u) => {
                      const isSelf = isCurrentUserRow(u.email);
                      const isApproved = u.situacao === "aprovado";

                      return (
                        <tr
                          key={u.id}
                          className="hover:bg-slate-50/80 transition-colors"
                        >
                          {/* Coluna 1: E-mail */}
                          <td className="py-3.5 px-4 font-medium text-slate-900">
                            {u.email}
                            {isSelf && (
                              <span className="ml-1 text-[11px] font-normal text-slate-400">
                                (você)
                              </span>
                            )}
                          </td>

                          {/* Coluna 2: Nome */}
                          <td className="py-3.5 px-4 text-slate-600 font-medium">
                            {u.nome}
                          </td>

                          {/* Coluna 3: Data de Cadastro */}
                          <td className="py-3.5 px-4 text-slate-500 tabular-nums">
                            {u.cadastro}
                          </td>

                          {/* Coluna 4: Situação (Badge Aprovado ou Rejeitado) */}
                          <td className="py-3.5 px-4">
                            {isApproved ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-600/20 ring-inset">
                                <span className="size-1.5 rounded-full bg-emerald-500" />
                                Aprovado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 ring-1 ring-rose-600/20 ring-inset">
                                <span className="size-1.5 rounded-full bg-rose-500" />
                                Rejeitado
                              </span>
                            )}
                          </td>

                          {/* Coluna 5: Perfil */}
                          <td className="py-3.5 px-4 text-slate-700 font-medium">
                            {isApproved ? (
                              u.perfil === "admin" ? (
                                <span className="font-semibold text-slate-900">
                                  Administrador
                                </span>
                              ) : (
                                <span className="text-slate-600">
                                  Visualizador
                                </span>
                              )
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* Coluna 6: Ações */}
                          <td className="py-3.5 px-4 text-right">
                            {isSelf ? (
                              <span className="text-[11px] text-slate-400 italic">
                                Não é possível alterar o próprio acesso
                              </span>
                            ) : isAdmin ? (
                              <div className="flex items-center justify-end gap-2">
                                {isApproved ? (
                                  <>
                                    {/* Alternar Cargo */}
                                    {u.perfil === "admin" ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          alterarPerfil(u.id, "user");
                                          toast.success(`Acesso de ${u.nome} alterado para Visualizador.`);
                                        }}
                                        className="rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-medium text-xs px-3 py-1.5 shadow-2xs transition active:scale-95 cursor-pointer"
                                      >
                                        Tornar visualizador
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          alterarPerfil(u.id, "admin");
                                          toast.success(`Acesso de ${u.nome} promovido para Administrador.`);
                                        }}
                                        className="rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-medium text-xs px-3 py-1.5 shadow-2xs transition active:scale-95 cursor-pointer"
                                      >
                                        Tornar administrador
                                      </button>
                                    )}

                                    {/* Revogar Acesso */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        alterarSituacao(u.id, "rejeitado");
                                        toast.warning(`Acesso de ${u.nome} revogado.`);
                                      }}
                                      className="rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 text-slate-700 font-medium text-xs px-2.5 py-1.5 transition active:scale-95 cursor-pointer"
                                    >
                                      Revogar acesso
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {/* Ações para Rejeitado */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        aprovarComPerfil(u.id, "user");
                                        toast.success(`${u.nome} aprovado como Visualizador.`);
                                      }}
                                      className="rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-medium text-xs px-3 py-1.5 shadow-2xs transition active:scale-95 cursor-pointer"
                                    >
                                      Aprovar como visualizador
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        aprovarComPerfil(u.id, "admin");
                                        toast.success(`${u.nome} aprovado como Administrador.`);
                                      }}
                                      className="rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-medium text-xs px-2.5 py-1.5 shadow-2xs transition active:scale-95 cursor-pointer"
                                    >
                                      Aprovar como administrador
                                    </button>
                                  </>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400">
                                Somente consulta
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Modal para adicionar novo usuário */}
      <NovoUsuarioModal
        open={modalNovoAberto}
        onOpenChange={setModalNovoAberto}
        onAdicionar={adicionarUsuario}
      />
    </div>
  );
}

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { restaurarBackupImportacao } from "@/lib/importacao";
import { useRbac } from "@/lib/rbac";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  History,
  Loader2,
  RotateCcw,
  ShieldAlert,
  User,
} from "lucide-react";
import { toast } from "sonner";

interface BackupRegistro {
  id: string;
  created_at: string;
  criado_por: string;
  nome_arquivo: string;
  total_pedidos: number;
  dados_snapshot: Record<string, unknown>[];
}

interface HistoricoImportacoesViewProps {
  usuarioIdent: string;
  onVoltarPainel: () => void;
  onExportarHistorico: () => void;
}

function formatarDataHoraPtBr(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const data = d.toLocaleDateString("pt-BR");
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${data} às ${hora}`;
}

export function HistoricoImportacoesView({
  usuarioIdent,
  onVoltarPainel,
  onExportarHistorico,
}: HistoricoImportacoesViewProps) {
  const { isAdmin } = useRbac(usuarioIdent);
  const queryClient = useQueryClient();

  const [backups, setBackups] = useState<BackupRegistro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [backupSelecionado, setBackupSelecionado] = useState<BackupRegistro | null>(null);
  const [restaurando, setRestaurando] = useState(false);

  async function carregarBackups() {
    setCarregando(true);
    try {
      const { data, error } = await supabase
        .from("importacoes_backup")
        .select("id, created_at, criado_por, nome_arquivo, total_pedidos, dados_snapshot")
        .order("created_at", { ascending: false })
        .limit(3);

      if (error) throw error;
      setBackups((data ?? []) as unknown as BackupRegistro[]);
    } catch (err) {
      toast.error("Não foi possível carregar os backups de importação.");
      console.error(err);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (!isAdmin) {
      onVoltarPainel();
      return;
    }
    carregarBackups();
  }, [isAdmin, onVoltarPainel]);

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <ShieldAlert className="mx-auto size-10 text-rose-500" />
          <h2 className="mt-3 text-base font-bold text-slate-900">Acesso Restrito</h2>
          <p className="mt-1 text-xs text-slate-500">
            Apenas administradores podem acessar o histórico de alterações e backups de importação.
          </p>
        </div>
      </div>
    );
  }

  async function confirmarRestauracao() {
    if (!backupSelecionado || restaurando) return;
    setRestaurando(true);
    const tid = toast.loading(
      `Restaurando base para "${backupSelecionado.nome_arquivo}"...`,
      { duration: 60000 },
    );

    try {
      await restaurarBackupImportacao(
        backupSelecionado.id,
        backupSelecionado.created_at,
        backupSelecionado.dados_snapshot ?? [],
      );
      await queryClient.invalidateQueries();
      await carregarBackups();
      toast.dismiss(tid);
      toast.success(
        `Base restaurada com sucesso para a versão anterior à importação de ${backupSelecionado.nome_arquivo}!`,
      );
      setBackupSelecionado(null);
    } catch (err) {
      toast.dismiss(tid);
      toast.error(
        err instanceof Error
          ? err.message
          : "Erro ao restaurar o backup selecionado.",
      );
    } finally {
      setRestaurando(false);
    }
  }

  return (
    <div className="flex flex-col min-w-0 w-full min-h-screen bg-slate-100 text-slate-800">
      {/* Topbar */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4 shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onVoltarPainel}
            className="inline-flex md:hidden items-center gap-1 rounded-lg border border-slate-200 p-1.5 text-xs text-slate-600 hover:bg-slate-50 mr-1"
            title="Voltar ao painel operacional"
          >
            <ArrowLeft className="size-4" />
          </button>
          <History className="size-5 text-indigo-600" />
          <h1 className="text-lg font-bold tracking-tight text-slate-900">
            Histórico de Alterações & Backups
          </h1>
        </div>

        <button
          type="button"
          onClick={onExportarHistorico}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
        >
          <Download className="size-4 text-indigo-600" />
          Exportar CSV do Histórico
        </button>
      </header>

      <main className="mx-auto w-full max-w-5xl p-6 space-y-6">
        {/* Seção Destacada: Backups de Importação */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-900 px-6 py-4 text-white flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold tracking-tight">
                Backups de Importação (Últimas 3 atualizações)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Snapshots automáticos gerados antes de cada importação de planilha. Restaure para desfazer uma carga incorreta.
              </p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
              {backups.length} versão(ões) salva(s)
            </span>
          </div>

          <div className="p-6">
            {carregando ? (
              <div className="flex items-center justify-center py-10 text-xs text-slate-400 gap-2">
                <Loader2 className="size-4 animate-spin text-indigo-500" />
                Carregando backups de importação...
              </div>
            ) : backups.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 py-10 text-center text-xs text-slate-500">
                Nenhum backup de importação disponível no momento. Os snapshots são criados automaticamente antes da próxima importação.
              </div>
            ) : (
              <div className="space-y-3">
                {backups.map((b, idx) => (
                  <div
                    key={b.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 transition hover:bg-white hover:shadow-xs"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-md bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-800">
                          {idx === 0 ? "Mais recente" : `Versão #${idx + 1}`}
                        </span>
                        <span className="text-xs font-semibold text-slate-700">
                          {formatarDataHoraPtBr(b.created_at)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                        <FileSpreadsheet className="size-4 shrink-0 text-emerald-600" />
                        <span className="truncate">{b.nome_arquivo}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <User className="size-3.5 text-slate-400" />
                          Importado por: <strong className="text-slate-700">{b.criado_por}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          <strong className="text-slate-700">
                            {Number(b.total_pedidos ?? 0).toLocaleString("pt-BR")}
                          </strong>{" "}
                          pedido(s) salvos no snapshot
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={restaurando}
                      onClick={() => setBackupSelecionado(b)}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900 shadow-2xs transition hover:bg-amber-100 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                    >
                      <RotateCcw className="size-3.5 text-amber-700" />
                      Restaurar esta versão
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Diálogo de Confirmação de Restauração */}
      <AlertDialog
        open={!!backupSelecionado}
        onOpenChange={(open) => {
          if (!open && !restaurando) setBackupSelecionado(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl border border-slate-200 bg-white p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900">
              Confirmar restauração de backup
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600 leading-relaxed">
              Deseja restaurar toda a base de pedidos para o estado exato anterior à importação de{" "}
              <strong className="text-slate-900">{backupSelecionado?.nome_arquivo}</strong> (
              {backupSelecionado ? formatarDataHoraPtBr(backupSelecionado.created_at) : ""})?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              disabled={restaurando}
              className="h-9 rounded-xl border border-slate-200 text-xs"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={restaurando}
              onClick={(e) => {
                e.preventDefault();
                confirmarRestauracao();
              }}
              className="h-9 rounded-xl bg-amber-600 text-xs font-semibold text-white hover:bg-amber-700 inline-flex items-center gap-1.5"
            >
              {restaurando ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Restaurando...
                </>
              ) : (
                <>
                  <RotateCcw className="size-3.5" />
                  Sim, restaurar versão
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

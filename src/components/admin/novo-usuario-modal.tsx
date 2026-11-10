import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserRole } from "@/lib/rbac";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

interface NovoUsuarioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdicionar: (dados: {
    email: string;
    nome: string;
    perfil: UserRole;
  }) => { success: boolean; error?: string };
}

export function NovoUsuarioModal({
  open,
  onOpenChange,
  onAdicionar,
}: NovoUsuarioModalProps) {
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [perfil, setPerfil] = useState<UserRole>("user");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      toast.error("Por favor, informe um e-mail corporativo válido.");
      return;
    }

    const resultado = onAdicionar({
      email: email.trim(),
      nome: nome.trim(),
      perfil,
    });

    if (resultado.success) {
      toast.success("Usuário cadastrado com sucesso!");
      setEmail("");
      setNome("");
      setPerfil("user");
      onOpenChange(false);
    } else {
      toast.error(resultado.error || "Erro ao cadastrar usuário.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
            <UserPlus className="size-5 text-blue-600" />
            Cadastrar Novo Usuário
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Insira os dados do usuário para conceder acesso ao painel de coletas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              E-mail corporativo <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              required
              placeholder="exemplo@somagrupo.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome completo
            </label>
            <input
              type="text"
              placeholder="Nome do colaborador"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Perfil de Acesso
            </label>
            <select
              value={perfil}
              onChange={(e) => setPerfil(e.target.value as UserRole)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="user">Visualizador (Somente consulta)</option>
              <option value="admin">Administrador (Acesso total)</option>
            </select>
            <p className="mt-1 text-[11px] text-slate-400">
              Visualizadores consultam o painel; Administradores podem gerenciar acessos e limpar base.
            </p>
          </div>

          <DialogFooter className="mt-6 gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 transition"
            >
              Cadastrar Usuário
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

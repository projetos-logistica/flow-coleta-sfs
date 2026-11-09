import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Redefinir senha — Painel de Coletas SFS Convencional" },
      { name: "description", content: "Defina uma nova senha para acessar o Painel de Coletas - SFS Convencional." },
      { property: "og:title", content: "Redefinir senha — Painel de Coletas SFS Convencional" },
      { property: "og:description", content: "Defina uma nova senha para acessar o Painel de Coletas - SFS Convencional." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [valido, setValido] = useState(false);

  useEffect(() => {
    // O link de redefinição chega com type=recovery no hash e cria uma sessão de recuperação.
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setValido(true);
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setValido(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (senha !== confirmar) {
      setMsg("As senhas não coincidem.");
      return;
    }
    setCarregando(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) {
        setMsg(error.message);
      } else {
        setMsg("Senha redefinida com sucesso. Redirecionando...");
        setTimeout(() => navigate({ to: "/", replace: true }), 1500);
      }
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        <img src="/logo-azzas-dark.png" alt="AZZAS 2154" className="mx-auto mb-4 h-8 w-auto" />
        <h1 className="mb-1 text-center text-lg font-bold text-foreground">Redefinir senha</h1>
        <p className="mb-5 text-center text-xs text-muted-foreground">Defina uma nova senha para sua conta</p>
        {valido ? (
          <form onSubmit={salvar} className="space-y-3">
            <div className="relative">
              <input
                type={mostrarSenha ? "text" : "password"}
                required
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Nova senha"
                className="h-10 w-full rounded-md border border-input bg-background px-3 pr-10 text-sm text-foreground"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((v) => !v)}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground"
              >
                {mostrarSenha ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
            <input
              type={mostrarSenha ? "text" : "password"}
              required
              minLength={6}
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              placeholder="Confirmar nova senha"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            />
            <button
              type="submit"
              disabled={carregando}
              className="h-10 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Salvar nova senha
            </button>
          </form>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            Link inválido ou expirado. Solicite um novo link de redefinição na tela de login.
          </p>
        )}
        {msg && <p className="mt-3 text-center text-xs text-muted-foreground">{msg}</p>}
        <button
          type="button"
          onClick={() => navigate({ to: "/auth" })}
          className="mt-4 w-full text-center text-xs text-muted-foreground underline"
        >
          Voltar para o login
        </button>
      </div>
    </div>
  );
}

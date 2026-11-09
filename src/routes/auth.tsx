import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Eye, EyeOff, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { verificarEmailExiste } from "@/lib/auth.functions";

/** Domínios corporativos autorizados a acessar o painel. */
const DOMINIOS_PERMITIDOS = ["somagrupo.com.br", "usereserva.com"];

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Painel de Coletas SFS Convencional" },
      { name: "description", content: "Acesse o Painel de Coletas - SFS Convencional com sua conta." },
      { property: "og:title", content: "Entrar — Painel de Coletas SFS Convencional" },
      { property: "og:description", content: "Acesse o Painel de Coletas - SFS Convencional com sua conta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Etapa = "email" | "senha" | "cadastrar" | "recuperar";

function AuthPage() {
  const navigate = useNavigate();
  const [etapa, setEtapa] = useState<Etapa>("email");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [tipoMsg, setTipoMsg] = useState<"erro" | "ok">("ok");
  const [carregando, setCarregando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  function avisar(texto: string, tipo: "erro" | "ok" = "ok") {
    setMsg(texto);
    setTipoMsg(tipo);
  }

  function mensagemAmigavel(message: string): string {
    const m = message.toLowerCase();
    if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos. Verifique e tente novamente.";
    if (m.includes("email not confirmed")) return "Seu e-mail ainda não foi confirmado. Clique em 'Esqueci minha senha' para definir uma senha e ativar o acesso.";
    if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.";
    if (m.includes("user already registered")) return "Já existe uma conta com este e-mail. Tente entrar ou redefinir a senha.";
    if (m.includes("password should be")) return "A senha deve ter pelo menos 6 caracteres.";
    if (m.includes("unable to validate email") || m.includes("invalid email")) return "E-mail inválido. Verifique se foi digitado corretamente.";
    return message;
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function continuar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setCarregando(true);
    setSenha("");
    const emailLimpo = email.trim().toLowerCase();
    const dominio = emailLimpo.split("@")[1] ?? "";
    if (!DOMINIOS_PERMITIDOS.includes(dominio)) {
      avisar("Apenas e-mails @somagrupo.com.br ou @usereserva.com podem acessar o painel.", "erro");
      setCarregando(false);
      return;
    }
    try {
      const res = await verificarEmailExiste({ data: { email: emailLimpo } });
      setEtapa(res.existe ? "senha" : "cadastrar");
    } catch {
      setEtapa("senha");
    } finally {
      setCarregando(false);
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setCarregando(true);
    try {
      if (etapa === "senha") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
        if (error) avisar(mensagemAmigavel(error.message), "erro");
      } else if (etapa === "cadastrar") {
        const { error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password: senha,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) {
          avisar(mensagemAmigavel(error.message), "erro");
        } else {
          avisar("Verifique seu e-mail e confirme o cadastro antes de entrar.", "ok");
          setEtapa("senha");
        }
      }
    } finally {
      setCarregando(false);
    }
  }

  async function redefinirSenha(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setCarregando(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/reset-password` });
      if (error) avisar(mensagemAmigavel(error.message), "erro");
      else avisar("Se houver uma conta, você receberá um link para verificar seu e-mail e definir uma nova senha.", "ok");
    } finally { setCarregando(false); }
  }

  function voltarParaEmail() {
    setEtapa("email");
    setSenha("");
    setMsg(null);
  }

  const campoSenha = (
    <div className="relative">
      <input
        type={mostrarSenha ? "text" : "password"}
        required
        minLength={6}
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        placeholder="Senha"
        className="h-10 w-full rounded-md border border-input bg-background px-3 pr-10 text-sm text-foreground"
      />
      <button
        type="button"
        onClick={() => setMostrarSenha((v) => !v)}
        aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
        title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground"
      >
        {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        <img src="/logo-azzas-dark.png" alt="AZZAS 2154" className="mx-auto mb-4 h-8 w-auto" />
        <h1 className="mb-1 text-center text-lg font-bold text-foreground">Painel de Coletas — SFS Convencional</h1>
        <p className="mb-5 text-center text-xs text-muted-foreground">
          {etapa === "email" && "Informe seu e-mail corporativo (@somagrupo.com.br ou @usereserva.com)."}
          {etapa === "senha" && "Informe sua senha para acessar."}
          {etapa === "cadastrar" && "Este e-mail ainda não tem conta. Crie sua senha para cadastro."}
          {etapa === "recuperar" && "Enviaremos um link seguro para redefinir sua senha."}
        </p>

        {etapa === "email" && (
          <form onSubmit={continuar} className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Informe seu e-mail"
                className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground"
              />
            </div>
            <button
              type="submit"
              disabled={carregando}
              className="h-10 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {carregando ? "Verificando..." : "Continuar"}
            </button>
          </form>
        )}

        {etapa === "senha" && (
          <>
            <form onSubmit={enviar} className="space-y-3">
              <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-xs">
                <span className="truncate font-medium text-foreground">{email}</span>
                <button
                  type="button"
                  onClick={voltarParaEmail}
                  className="shrink-0 text-muted-foreground underline"
                >
                  trocar
                </button>
              </div>
              {campoSenha}
              <button
                type="button"
                onClick={() => { setEtapa("recuperar"); setSenha(""); setMsg(null); }}
                className="w-full text-right text-xs text-muted-foreground underline"
              >
                Esqueci minha senha
              </button>
              <button
                type="submit"
                disabled={carregando}
                className="h-10 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                Entrar
              </button>
            </form>
            <button
              type="button"
              onClick={voltarParaEmail}
              className="mt-4 flex w-full items-center justify-center gap-1 text-center text-xs text-muted-foreground underline"
            >
              <ArrowLeft className="size-3" />
              Voltar
            </button>
          </>
        )}

        {etapa === "cadastrar" && (
          <>
            <form onSubmit={enviar} className="space-y-3">
              <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-xs">
                <span className="truncate font-medium text-foreground">{email}</span>
                <button
                  type="button"
                  onClick={voltarParaEmail}
                  className="shrink-0 text-muted-foreground underline"
                >
                  trocar
                </button>
              </div>
              {campoSenha}
              <button
                type="submit"
                disabled={carregando}
                className="h-10 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                Cadastrar
              </button>
            </form>
            <button
              type="button"
              onClick={voltarParaEmail}
              className="mt-4 flex w-full items-center justify-center gap-1 text-center text-xs text-muted-foreground underline"
            >
              <ArrowLeft className="size-3" />
              Voltar
            </button>
          </>
        )}

        {etapa === "recuperar" && (
          <>
            <form onSubmit={redefinirSenha} className="space-y-3">
              <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-xs">
                <span className="truncate font-medium text-foreground">{email}</span>
                <button
                  type="button"
                  onClick={voltarParaEmail}
                  className="shrink-0 text-muted-foreground underline"
                >
                  trocar
                </button>
              </div>
              <button
                type="submit"
                disabled={carregando}
                className="h-10 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {carregando ? "Enviando..." : "Enviar link de redefinição"}
              </button>
            </form>
            <button
              type="button"
              onClick={() => { setEtapa("senha"); setMsg(null); }}
              className="mt-4 flex w-full items-center justify-center gap-1 text-center text-xs text-muted-foreground underline"
            >
              <ArrowLeft className="size-3" />
              Voltar para o login
            </button>
          </>
        )}

        {msg && (
          <p role="alert" className={"mt-3 rounded-md border px-3 py-2 text-center text-xs font-medium " + (tipoMsg === "erro" ? "border-erro bg-erro text-erro-foreground" : "border-finalizado bg-finalizado text-finalizado-foreground")}>
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}

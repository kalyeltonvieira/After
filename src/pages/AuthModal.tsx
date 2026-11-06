import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { X, AlertCircle, ShieldCheck, ArrowRight, Eye, EyeOff, Mail, LockKeyhole, KeyRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: "signin" | "signup";
}

type AuthMode = "signin" | "signup" | "reset";

function getAuthErrorMessage(error: any, language: string) {
  const code = String(error?.code || "");
  const pt = language === "pt";
  const messages: Record<string, string> = {
    "auth/invalid-email": pt ? "O endereço de e-mail é inválido." : "The email address is invalid.",
    "auth/email-already-in-use": pt ? "Este e-mail já possui uma conta. Entre em vez de criar outra." : "This email already has an account. Sign in instead.",
    "auth/invalid-credential": pt ? "E-mail ou senha incorretos." : "Incorrect email or password.",
    "auth/user-not-found": pt ? "Não encontramos uma conta com este e-mail." : "No account was found for this email.",
    "auth/wrong-password": pt ? "E-mail ou senha incorretos." : "Incorrect email or password.",
    "auth/weak-password": pt ? "Escolha uma senha mais forte (mínimo de 6 caracteres)." : "Choose a stronger password (at least 6 characters).",
    "auth/too-many-requests": pt ? "Muitas tentativas. Aguarde um pouco e tente novamente." : "Too many attempts. Please wait and try again.",
    "auth/network-request-failed": pt ? "Falha de conexão. Verifique sua internet." : "Network error. Check your connection.",
    "auth/operation-not-allowed": pt ? "O login por e-mail e senha ainda não está ativado no Firebase Authentication." : "Email/password sign-in is not enabled in Firebase Authentication.",
  };
  return messages[code] || error?.message || (pt ? "Não foi possível concluir a autenticação." : "Authentication failed.");
}

export function AuthModal({ isOpen, onClose, defaultMode = "signin" }: AuthModalProps) {
  const { signInWithEmail, createAccount, resetPassword } = useAuth();
  const { language } = useLanguage();
  const isPt = language === "pt";
  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(defaultMode);
      setError(null);
      setNotice(null);
      setPassword("");
    }
  }, [isOpen, defaultMode]);

  if (!isOpen) return null;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "reset") {
        await resetPassword(email);
        setNotice(isPt ? "Enviamos um link de redefinição para seu e-mail, caso exista uma conta." : "Password reset instructions have been sent if an account exists.");
        return;
      }

      if (mode === "signup") {
        await createAccount(email, password);
      } else {
        await signInWithEmail(email, password);
      }
      onClose();
    } catch (err: any) {
      setError(getAuthErrorMessage(err, language));
    } finally {
      setLoading(false);
    }
  };

  const title = mode === "signup"
    ? (isPt ? "Crie sua conta AFTER" : "Create your AFTER account")
    : mode === "reset"
      ? (isPt ? "Redefinir senha" : "Reset your password")
      : (isPt ? "Bem-vindo de volta" : "Welcome back");

  const description = mode === "signup"
    ? (isPt ? "Crie seu espaço de trabalho. Você poderá conectar o GitHub depois." : "Create your workspace. You can connect GitHub later.")
    : mode === "reset"
      ? (isPt ? "Informe seu e-mail para receber as instruções de redefinição." : "Enter your email to receive reset instructions.")
      : (isPt ? "Entre para continuar de onde seu trabalho parou." : "Sign in to continue where you left off.");

  return (
    <motion.div
      className="fixed inset-0 z-[100] overflow-y-auto bg-[#08090a] text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -left-24 top-1/4 h-96 w-96 rounded-full bg-lime-300/10 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-violet-500/10 blur-[130px]" />
      </div>

      <div className="relative z-10 grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden lg:flex flex-col justify-between border-r border-white/10 px-12 py-10 xl:px-20">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-300 text-zinc-950 font-serif text-xl font-bold">A</div>
            <span className="text-sm font-semibold tracking-tight">AFTER<span className="ml-1.5 text-lime-300">•</span></span>
          </div>

          <div className="max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.16em] text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-lime-300 shadow-[0_0_12px_rgba(217,255,87,.8)]" />
              {isPt ? "Acesso ao AFTER" : "AFTER access"}
            </div>
            <h1 className="text-5xl font-semibold leading-[1.08] tracking-[-0.055em] xl:text-6xl">
              {isPt ? <>Software que não envelhece <span className="text-lime-300">sozinho.</span></> : <>Software that doesn't age <span className="text-lime-300">alone.</span></>}
            </h1>
            <p className="mt-6 max-w-lg text-sm leading-7 text-zinc-400">
              {isPt
                ? "Uma visão contínua da arquitetura, das decisões e da saúde dos seus projetos. Entre primeiro. Conecte suas ferramentas quando fizer sentido."
                : "A continuous view of architecture, decisions, and project health. Sign in first. Connect your tools when it makes sense."}
            </p>
            <div className="mt-10 space-y-4">
              {[
                isPt ? ["Memória preservada", "Decisões e contexto continuam ligados à origem."] : ["Preserved memory", "Decisions and context remain tied to their source."],
                isPt ? ["Análise fundamentada", "Entenda a evolução a partir de dados reais."] : ["Evidence-based analysis", "Understand change through real project data."],
                isPt ? ["Integrações opcionais", "Seu login não depende de uma conta GitHub."] : ["Optional integrations", "Your sign-in does not depend on a GitHub account."],
              ].map(([title, description]) => (
                <div key={title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime-300/10 text-lime-300"><ShieldCheck className="h-3.5 w-3.5" /></span>
                  <p className="text-xs leading-relaxed text-zinc-500"><strong className="font-semibold text-zinc-200">{title}.</strong> {description}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-zinc-600">AFTER · Continuous software intelligence</p>
        </section>

        <section className="relative flex min-h-screen flex-col px-6 py-6 sm:px-10 lg:px-12 xl:px-20">
          <div className="flex items-center justify-between lg:justify-end">
            <div className="flex items-center gap-2 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime-300 text-zinc-950 font-serif text-lg font-bold">A</div>
              <span className="text-sm font-semibold tracking-tight">AFTER<span className="ml-1 text-lime-300">•</span></span>
            </div>
            <button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs text-zinc-500 transition-colors hover:bg-white/5 hover:text-white">
              <X className="h-3.5 w-3.5" />{isPt ? "Voltar ao início" : "Back to home"}
            </button>
          </div>

          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
            <div className="mb-8">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500">{mode === "signup" ? (isPt ? "Comece por aqui" : "Get started") : mode === "reset" ? (isPt ? "Recuperação de acesso" : "Account recovery") : (isPt ? "Bem-vindo de volta" : "Welcome back")}</p>
              <h2 id="auth-modal-title" className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">{description}</p>
            </div>

            {mode !== "reset" && (
              <div className="mb-6 grid grid-cols-2 rounded-xl border border-white/10 bg-white/[0.03] p-1">
                <button type="button" onClick={() => { setMode("signin"); setError(null); setNotice(null); }} className={`rounded-lg py-2.5 text-xs font-medium transition-all ${mode === "signin" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-white"}`}>
                  {isPt ? "Entrar" : "Sign in"}
                </button>
                <button type="button" onClick={() => { setMode("signup"); setError(null); setNotice(null); }} className={`rounded-lg py-2.5 text-xs font-medium transition-all ${mode === "signup" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-white"}`}>
                  {isPt ? "Criar conta" : "Create account"}
                </button>
              </div>
            )}

            {error && (
              <div role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span className="leading-snug">{error}</span>
              </div>
            )}
            {notice && (
              <div role="status" className="mb-5 flex items-start gap-2 rounded-xl border border-lime-300/20 bg-lime-300/10 p-3 text-xs text-lime-200">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><span className="leading-snug">{notice}</span>
              </div>
            )}

            <form onSubmit={(event) => void submit(event)} className="space-y-4">
              <div>
                <label htmlFor="after-auth-email" className="mb-2 block text-xs font-medium text-zinc-300">E-mail</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-zinc-600" />
                  <input id="after-auth-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@exemplo.com" className="w-full rounded-2xl border border-white/10 bg-white/[0.035] py-3.5 pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-lime-300/60" />
                </div>
              </div>

              {mode !== "reset" && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor="after-auth-password" className="text-xs font-medium text-zinc-300">{isPt ? "Senha" : "Password"}</label>
                    {mode === "signin" && <button type="button" onClick={() => { setMode("reset"); setError(null); setNotice(null); }} className="text-[11px] font-medium text-lime-300 transition-colors hover:text-lime-200">{isPt ? "Esqueci minha senha" : "Forgot password"}</button>}
                  </div>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-zinc-600" />
                    <input id="after-auth-password" type={showPassword ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isPt ? "Sua senha" : "Your password"} className="w-full rounded-2xl border border-white/10 bg-white/[0.035] py-3.5 pl-11 pr-12 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-lime-300/60" />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-3 rounded-lg p-1.5 text-zinc-500 transition-colors hover:text-white" aria-label={showPassword ? (isPt ? "Ocultar senha" : "Hide password") : (isPt ? "Mostrar senha" : "Show password")}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {mode === "signup" && <p className="mt-2 text-[10px] text-zinc-600">{isPt ? "Mínimo de 6 caracteres." : "At least 6 characters."}</p>}
                </div>
              )}

              <button type="submit" disabled={loading} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-lime-300 px-4 py-3.5 text-sm font-semibold text-zinc-950 shadow-[0_0_28px_rgba(217,255,87,.12)] transition-all hover:bg-lime-200 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60">
                {mode === "reset" ? <KeyRound className="h-4 w-4" /> : null}
                <span>{loading ? (isPt ? "Aguarde..." : "Please wait...") : mode === "signup" ? (isPt ? "Criar minha conta" : "Create my account") : mode === "reset" ? (isPt ? "Enviar link de redefinição" : "Send reset link") : (isPt ? "Entrar na plataforma" : "Sign in")}</span>
                {mode !== "reset" && !loading && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>

            <div className="mt-7 border-t border-white/10 pt-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-lime-300" />
                <p className="text-[11px] leading-relaxed text-zinc-500">
                  {isPt
                    ? "Sua conta AFTER é independente. O GitHub será solicitado separadamente, somente quando você quiser conectar seus próprios repositórios."
                    : "Your AFTER account is independent. GitHub access is requested separately, only when you want to connect your own repositories."}
                </p>
              </div>
              {mode === "reset" && <button type="button" onClick={() => { setMode("signin"); setError(null); setNotice(null); }} className="mt-5 w-full text-center text-xs font-medium text-zinc-500 hover:text-white">{isPt ? "Voltar ao login" : "Back to sign in"}</button>}
            </div>
          </div>
          <p className="text-center text-[10px] text-zinc-700 lg:hidden">AFTER · Continuous software intelligence</p>
        </section>
      </div>
    </motion.div>
  );

}

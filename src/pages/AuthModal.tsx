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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-50 w-full max-w-md overflow-hidden rounded-3xl border border-zinc-200/80 bg-white p-8 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <button
          id="close-auth-modal-btn"
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          aria-label={isPt ? "Fechar" : "Close"}
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-7 text-center">
          <span className="font-mono text-xl font-bold tracking-tighter text-zinc-950 dark:text-zinc-50">AFTER</span>
          <h2 id="auth-modal-title" className="mt-3 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{title}</h2>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
        </div>

        {mode !== "reset" && (
          <div className="mb-5 grid grid-cols-2 rounded-xl border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-950/60">
            <button type="button" onClick={() => { setMode("signin"); setError(null); setNotice(null); }} className={`rounded-lg py-2 text-xs font-medium transition-all ${mode === "signin" ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-white" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}`}>
              {isPt ? "Entrar" : "Sign in"}
            </button>
            <button type="button" onClick={() => { setMode("signup"); setError(null); setNotice(null); }} className={`rounded-lg py-2 text-xs font-medium transition-all ${mode === "signup" ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-white" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}`}>
              {isPt ? "Criar conta" : "Create account"}
            </button>
          </div>
        )}

        {error && (
          <div role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-rose-200/60 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="leading-snug">{error}</span>
          </div>
        )}
        {notice && (
          <div role="status" className="mb-5 flex items-start gap-2 rounded-xl border border-emerald-200/60 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-400">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="leading-snug">{notice}</span>
          </div>
        )}

        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          <div>
            <label htmlFor="after-auth-email" className="mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300">E-mail</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-zinc-400" />
              <input
                id="after-auth-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@exemplo.com"
                className="w-full rounded-xl border border-zinc-200 bg-white py-3 pl-10 pr-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-lime-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
          </div>

          {mode !== "reset" && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="after-auth-password" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{isPt ? "Senha" : "Password"}</label>
                {mode === "signin" && (
                  <button type="button" onClick={() => { setMode("reset"); setError(null); setNotice(null); }} className="text-[11px] font-medium text-lime-600 hover:text-lime-500 dark:text-lime-400">
                    {isPt ? "Esqueci minha senha" : "Forgot password"}
                  </button>
                )}
              </div>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-zinc-400" />
                <input
                  id="after-auth-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  minLength={6}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={isPt ? "Sua senha" : "Your password"}
                  className="w-full rounded-xl border border-zinc-200 bg-white py-3 pl-10 pr-11 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-lime-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-2.5 rounded-md p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200" aria-label={showPassword ? (isPt ? "Ocultar senha" : "Hide password") : (isPt ? "Mostrar senha" : "Show password")}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {mode === "signup" && <p className="mt-1.5 text-[10px] text-zinc-400">{isPt ? "Use pelo menos 6 caracteres." : "Use at least 6 characters."}</p>}
            </div>
          )}

          <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime-300 px-4 py-3.5 text-sm font-medium text-zinc-950 shadow-sm transition-all hover:bg-lime-200 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60">
            {mode === "reset" ? <KeyRound className="h-4 w-4" /> : null}
            <span>{loading
              ? (isPt ? "Aguarde..." : "Please wait...")
              : mode === "signup" ? (isPt ? "Criar minha conta" : "Create my account")
                : mode === "reset" ? (isPt ? "Enviar link de redefinição" : "Send reset link")
                  : (isPt ? "Entrar na plataforma" : "Sign in")}</span>
            {mode !== "reset" && !loading && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>

        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/50">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            {isPt
              ? "Sua conta AFTER é independente. A conexão com GitHub será solicitada separadamente, somente quando você quiser acessar seus próprios repositórios."
              : "Your AFTER account is independent. GitHub access is requested separately, only when you want to access your own repositories."}
          </p>
        </div>

        {mode === "reset" && (
          <button type="button" onClick={() => { setMode("signin"); setError(null); setNotice(null); }} className="mt-5 w-full text-center text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            {isPt ? "Voltar ao login" : "Back to sign in"}
          </button>
        )}
      </motion.div>
    </div>
  );
}

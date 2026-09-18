import React, { useState } from "react";
import { X, Mail, Lock, User, AlertCircle, ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: "signin" | "signup";
}

export function AuthModal({
  isOpen,
  onClose,
  defaultMode = "signin",
}: AuthModalProps) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset } =
    useAuth();
  const { language } = useLanguage();

  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(defaultMode);
  const [authMethod, setAuthMethod] = useState<"email" | "google">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err: any) {
      setError(err?.message || (language === "pt" ? "Falha ao autenticar com o Google" : "Failed to sign in with Google"));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "signin") {
        await signInWithEmail(email, password);
        onClose();
      } else if (mode === "signup") {
        if (!name.trim()) {
          setError(language === "pt" ? "O nome é obrigatório" : "Name is required");
          setLoading(false);
          return;
        }
        await signUpWithEmail(email, password, name);
        onClose();
      } else if (mode === "forgot") {
        await sendPasswordReset(email);
        setResetSuccess(true);
      }
    } catch (err: any) {
      setError(err?.message || (language === "pt" ? "Ocorreu um erro de autenticação" : "Authentication error occurred"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xl p-8 z-50 overflow-hidden">
        {/* Close Button */}
        <button
          id="close-auth-modal-btn"
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand & Heading */}
        <div className="text-center mb-6">
          <span className="font-mono font-bold tracking-tighter text-xl text-zinc-950 dark:text-zinc-50">
            AFTER
          </span>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mt-2">
            {mode === "signin"
              ? (language === "pt" ? "Bem-vindo de volta" : "Welcome back")
              : mode === "signup"
              ? (language === "pt" ? "Crie sua conta" : "Create your account")
              : (language === "pt" ? "Recuperar senha" : "Reset password")}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {mode === "signin"
              ? (language === "pt" ? "Acesse seu ledger e monitore a evolução do seu software" : "Observe and understand your software's evolution")
              : mode === "signup"
              ? (language === "pt" ? "Cadastre-se para registrar decisões, arquitetura e intenções" : "Start monitoring your code, architecture, and rationale")
              : (language === "pt" ? "Digite seu e-mail para receber as instruções de recuperação" : "Enter your email to receive recovery instructions")}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {resetSuccess ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm text-zinc-800 dark:text-zinc-200 font-medium">
              {language === "pt"
                ? `Link de recuperação de senha enviado para ${email}`
                : `Password reset link sent to ${email}`}
            </p>
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setResetSuccess(false);
              }}
              className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:underline cursor-pointer"
            >
              {language === "pt" ? "Voltar ao login" : "Back to sign in"}
            </button>
          </div>
        ) : (
          <>
            {/* Google Sign-in Option */}
            {mode !== "forgot" && (
              <>
                <button
                  id="google-signin-btn"
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-3 py-3 px-4 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-750 text-sm font-medium text-zinc-700 dark:text-zinc-200 transition-all cursor-pointer disabled:opacity-50 shadow-2xs active:scale-[0.99]"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{language === "pt" ? "Continuar com o Google" : "Continue with Google"}</span>
                </button>

                <div className="relative my-4 text-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
                  </div>
                  <span className="relative px-3 bg-white dark:bg-zinc-900 text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                    {language === "pt" ? "ou com e-mail e senha" : "or with email & password"}
                  </span>
                </div>
              </>
            )}

            {/* Email form */}
            <form onSubmit={handleEmailAuth} className="space-y-3.5">
              {mode === "signup" && (
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    {language === "pt" ? "Nome Completo" : "Full Name"}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                    <input
                      id="signup-name-input"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={language === "pt" ? "Seu Nome" : "Jane Doe"}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-hidden focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  {language === "pt" ? "E-mail" : "Work Email"}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                  <input
                    id="auth-email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seuemail@exemplo.com"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-hidden focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>
              </div>

              {mode !== "forgot" && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      {language === "pt" ? "Senha" : "Password"}
                    </label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => setMode("forgot")}
                        className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                      >
                        {language === "pt" ? "Esqueceu a senha?" : "Forgot password?"}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                    <input
                      id="auth-password-input"
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-hidden focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                    />
                  </div>
                </div>
              )}

              <button
                id="submit-auth-form-btn"
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-all cursor-pointer shadow-xs active:scale-[0.99] disabled:opacity-50"
              >
                {loading
                  ? (language === "pt" ? "Processando..." : "Processing...")
                  : mode === "signin"
                  ? (language === "pt" ? "Entrar com E-mail" : "Sign in with Email")
                  : mode === "signup"
                  ? (language === "pt" ? "Criar Conta com E-mail" : "Create account with Email")
                  : (language === "pt" ? "Enviar link de recuperação" : "Send reset link")}
              </button>
            </form>

            {/* Backend identifier badge */}
            <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-850 flex items-center justify-center space-x-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Firebase: <strong className="font-mono text-zinc-600 dark:text-zinc-400">afterbrasil</strong></span>
            </div>

            {/* Switch Mode Footer */}
            <div className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
              {mode === "signin" ? (
                <p>
                  {language === "pt" ? "Não tem uma conta?" : "Don't have an account?"}{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signup");
                      setError(null);
                    }}
                    className="font-semibold text-zinc-900 dark:text-zinc-100 hover:underline cursor-pointer"
                  >
                    {language === "pt" ? "Cadastre-se" : "Sign up"}
                  </button>
                </p>
              ) : mode === "signup" ? (
                <p>
                  {language === "pt" ? "Já tem uma conta?" : "Already have an account?"}{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signin");
                      setError(null);
                    }}
                    className="font-semibold text-zinc-900 dark:text-zinc-100 hover:underline cursor-pointer"
                  >
                    {language === "pt" ? "Entrar" : "Sign in"}
                  </button>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                  }}
                  className="font-semibold text-zinc-900 dark:text-zinc-100 hover:underline cursor-pointer"
                >
                  {language === "pt" ? "Voltar ao login" : "Return to sign in"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

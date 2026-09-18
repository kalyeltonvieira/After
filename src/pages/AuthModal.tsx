import React, { useState } from "react";
import { X, AlertCircle, ShieldCheck, Github, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: "signin" | "signup";
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signInWithGitHub } = useAuth();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGitHubSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGitHub();
      onClose();
    } catch (err: any) {
      setError(
        err?.message ||
          (language === "pt"
            ? "Não foi possível entrar com o GitHub."
            : "Could not sign in with GitHub.")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xl p-8 z-50 overflow-hidden">
        <button
          id="close-auth-modal-btn"
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          aria-label={language === "pt" ? "Fechar" : "Close"}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-8">
          <span className="font-mono font-bold tracking-tighter text-xl text-zinc-950 dark:text-zinc-50">
            AFTER
          </span>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mt-2">
            {language === "pt" ? "Entre com GitHub" : "Continue with GitHub"}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed max-w-sm mx-auto">
            {language === "pt"
              ? "Use sua conta do GitHub. O AFTER usará sua autorização para descobrir os repositórios públicos e privados aos quais você tem acesso."
              : "Use your GitHub account. AFTER uses your authorization to discover the public and private repositories you can access."}
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        <button
          id="github-signin-btn"
          type="button"
          onClick={handleGitHubSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center space-x-2.5 py-3.5 px-4 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 transition-all cursor-pointer disabled:opacity-50 shadow-xs active:scale-[0.99]"
        >
          <Github className="w-4 h-4" />
          <span>
            {loading
              ? language === "pt"
                ? "Conectando ao GitHub..."
                : "Connecting to GitHub..."
              : language === "pt"
                ? "Continuar com GitHub"
                : "Continue with GitHub"}
          </span>
          {!loading && <ArrowRight className="w-4 h-4" />}
        </button>

        <div className="mt-5 p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/50 flex items-start space-x-3">
          <ShieldCheck className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
              {language === "pt" ? "Uma única conta, integrada ao GitHub" : "One account, integrated with GitHub"}
            </p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
              {language === "pt"
                ? "Não há cadastro separado de senha. A autorização acontece no próprio GitHub."
                : "There is no separate password account. Authorization happens directly through GitHub."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { Sparkles, Check, AlertCircle, ArrowRight, Github, Search, SkipForward } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function OnboardingModal() {
  const {
    user,
    needsOnboarding,
    completeOnboarding,
    checkUsernameAvailable,
    connectGitHub,
    isGitHubConnected,
  } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [bio, setBio] = useState("");
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [connectingGitHub, setConnectingGitHub] = useState(false);

  useEffect(() => {
    if (user?.email && !username) {
      const draft = user.email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "");
      setUsername(draft);
    }
  }, [user, username]);

  useEffect(() => {
    if (!username || username.length < 3) {
      setIsUsernameAvailable(null);
      setUsernameError(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsCheckingUsername(true);
      try {
        const available = await checkUsernameAvailable(username);
        if (!cancelled) {
          setIsUsernameAvailable(available);
          setUsernameError(available ? null : "Este nome de usuário já está ocupado ou é inválido.");
        }
      } catch {
        if (!cancelled) {
          setIsUsernameAvailable(false);
          setUsernameError("Não foi possível verificar este nome de usuário.");
        }
      } finally {
        if (!cancelled) setIsCheckingUsername(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username, checkUsernameAvailable]);

  if (!needsOnboarding) return null;

  const finishOnboarding = async () => {
    setLoading(true);
    setGeneralError(null);
    try {
      await completeOnboarding({
        username,
        displayName: displayName || username,
        bio,
      });
    } catch (err: any) {
      console.error("Onboarding failed:", err);
      setGeneralError(err?.message || "Não foi possível concluir a configuração da conta.");
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGitHub = async () => {
    setConnectingGitHub(true);
    setGeneralError(null);
    try {
      await connectGitHub();
      await finishOnboarding();
    } catch (err: any) {
      setGeneralError(err?.message || "Não foi possível conectar ao GitHub. Você pode fazer isso depois.");
    } finally {
      setConnectingGitHub(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-7 sm:p-8 overflow-hidden">
        <div className="flex items-center gap-2 mb-7">
          <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? "bg-lime-300" : "bg-zinc-200 dark:bg-zinc-800"}`} />
          <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? "bg-lime-300" : "bg-zinc-200 dark:bg-zinc-800"}`} />
        </div>

        {generalError && (
          <div role="alert" className="mb-5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{generalError}</span>
          </div>
        )}

        {step === 1 ? (
          <div>
            <div className="mb-6">
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-400 block mb-2">Passo 1 de 2 · Perfil</span>
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Seu espaço está pronto.</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">Escolha como você será identificado no AFTER. Sua conta é independente do GitHub.</p>
            </div>

            <form onSubmit={(event) => { event.preventDefault(); if (isUsernameAvailable) setStep(2); }} className="space-y-4">
              <div>
                <label htmlFor="after-onboarding-username" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Nome de usuário</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-sm text-zinc-400 font-mono">@</span>
                  <input
                    id="after-onboarding-username"
                    type="text"
                    required
                    minLength={3}
                    maxLength={30}
                    value={username}
                    onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    placeholder="arquiteto"
                    className="w-full pl-8 pr-10 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm font-mono outline-none focus:border-lime-400"
                  />
                  <div className="absolute right-3 top-3">
                    {isCheckingUsername && <span className="w-3.5 h-3.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin block" />}
                    {!isCheckingUsername && isUsernameAvailable === true && <Check className="w-4 h-4 text-emerald-500" />}
                  </div>
                </div>
                {usernameError && <p className="text-xs text-rose-500 mt-1.5">{usernameError}</p>}
                <p className="text-[10px] text-zinc-400 mt-1.5">3 a 30 caracteres: letras minúsculas, números e _.</p>
              </div>

              <div>
                <label htmlFor="after-onboarding-name" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Nome de exibição</label>
                <input
                  id="after-onboarding-name"
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Seu nome"
                  className="w-full px-3.5 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm outline-none focus:border-lime-400"
                />
              </div>

              <button type="submit" disabled={!isUsernameAvailable || isCheckingUsername} className="w-full mt-2 py-3 px-4 rounded-xl bg-lime-300 text-zinc-950 text-sm font-semibold hover:bg-lime-200 transition-all cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2">
                <span>Continuar</span><ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <div>
            <div className="mb-6">
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-400 block mb-2">Passo 2 de 2 · Integrações</span>
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Dê contexto ao seu código.</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">O AFTER funciona sem conectar serviços externos. Quando quiser analisar seus próprios projetos, você pode autorizar o GitHub.</p>
            </div>

            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/50 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center"><Github className="w-5 h-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Conectar GitHub</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{isGitHubConnected ? "Sua conta GitHub já está vinculada." : "Autorize o acesso aos seus repositórios privados e pessoais."}</p>
                </div>
                {isGitHubConnected && <Check className="w-5 h-5 text-emerald-500" />}
              </div>
              {!isGitHubConnected && (
                <button type="button" onClick={() => void handleConnectGitHub()} disabled={connectingGitHub || loading} className="w-full flex items-center justify-center gap-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 py-3 text-xs font-semibold disabled:opacity-50">
                  <Github className="w-4 h-4" />{connectingGitHub ? "Aguardando autorização..." : "Conectar minha conta GitHub"}<ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="mt-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 flex gap-3">
              <Search className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Explorar repositórios públicos</p>
                <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400 mt-1">Você também pode pesquisar projetos públicos de qualquer pessoa ou organização sem conectar sua conta GitHub.</p>
              </div>
            </div>

            <div className="pt-5 space-y-2">
              <button
                id="onboarding-complete-btn"
                type="button"
                disabled={loading || connectingGitHub}
                onClick={() => void finishOnboarding()}
                className="w-full py-3 px-4 rounded-xl bg-lime-300 text-zinc-950 text-sm font-semibold hover:bg-lime-200 transition-all cursor-pointer shadow-xs disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>{loading ? "Preparando seu espaço..." : "Entrar no AFTER"}</span>
              </button>
              {!isGitHubConnected && (
                <button type="button" disabled={loading || connectingGitHub} onClick={() => void finishOnboarding()} className="w-full py-2.5 px-4 rounded-xl text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  <SkipForward className="w-3.5 h-3.5" /> Conectar GitHub depois
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

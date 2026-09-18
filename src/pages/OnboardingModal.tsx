import React, { useState, useEffect } from "react";
import { Sparkles, Check, AlertCircle, ArrowRight, Github } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useProject } from "../context/ProjectContext";

export function OnboardingModal() {
  const { user, needsOnboarding, completeOnboarding, checkUsernameAvailable } = useAuth();
  const { connectRepository, createProject } = useProject();

  const [step, setStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [bio, setBio] = useState("");
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);



  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Auto-fill initial username draft from email
  useEffect(() => {
    if (user?.email && !username) {
      const draft = user.email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "");
      setUsername(draft);
    }
  }, [user]);

  // Debounced check for username
  useEffect(() => {
    if (!username || username.length < 3) {
      setIsUsernameAvailable(null);
      setUsernameError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingUsername(true);
      try {
        const available = await checkUsernameAvailable(username);
        setIsUsernameAvailable(available);
        setUsernameError(available ? null : "Username is already taken or invalid");
      } catch {
        setIsUsernameAvailable(false);
        setUsernameError("Error checking username");
      } finally {
        setIsCheckingUsername(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username]);

  if (!needsOnboarding) return null;

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isUsernameAvailable) return;
    setStep(2);
  };

  const handleFinishOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setGeneralError(err?.message || "Failed to complete onboarding setup.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkipRepository = async () => {
    await handleFinishOnboarding(new Event("submit") as unknown as React.FormEvent);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-8 overflow-hidden">
        {/* Progress indicator */}
        <div className="flex items-center space-x-2 mb-6">
          <div
            className={`h-1.5 flex-1 rounded-full ${
              step >= 1 ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-200 dark:bg-zinc-800"
            }`}
          />
          <div
            className={`h-1.5 flex-1 rounded-full ${
              step >= 2 ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-200 dark:bg-zinc-800"
            }`}
          />
        </div>

        {generalError && (
          <div className="mb-6 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{generalError}</span>
          </div>
        )}

        {step === 1 ? (
          <div>
            <div className="mb-6">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                Step 1 of 2
              </span>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Claim your handle
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Your unique identity across the AFTER ledger.
              </p>
            </div>

            <form onSubmit={handleStep1Submit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Username <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs text-zinc-400 font-mono">
                    @
                  </span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    placeholder="architect"
                    className="w-full pl-8 pr-10 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                  <div className="absolute right-3 top-3">
                    {isCheckingUsername && (
                      <span className="w-3.5 h-3.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin block" />
                    )}
                    {!isCheckingUsername && isUsernameAvailable === true && (
                      <Check className="w-4 h-4 text-emerald-500" />
                    )}
                  </div>
                </div>
                {usernameError && (
                  <p className="text-xs text-rose-500 mt-1">{usernameError}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ada Lovelace"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-hidden focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>

              <button
                type="submit"
                disabled={!isUsernameAvailable}
                className="w-full mt-4 py-2.5 px-4 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-all cursor-pointer shadow-xs active:scale-98 disabled:opacity-40 flex items-center justify-center space-x-2"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <div>
            <div className="mb-6">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                Step 2 of 2
              </span>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Connect your repository
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Connect a GitHub repository to observe its architecture, commits, and dependencies.
              </p>
            </div>

            <form onSubmit={handleFinishOnboarding} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  GitHub Repository (optional)
                </label>
                <div className="relative">
                  <Github className="w-4 h-4 absolute left-3.5 top-3 text-zinc-400" />
                  <input
                    type="text"
                    value={repository}
                    onChange={(e) => setRepository(e.target.value)}
                    placeholder="e.g. facebook/react or vercel/next.js"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  You can connect a public repository now, or skip and connect later from the dashboard.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Branch (optional)
                </label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>

              <div className="flex items-center space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleSkipRepository}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Skip for now
                </button>
                <button
                  id="onboarding-complete-btn"
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-all cursor-pointer shadow-xs active:scale-98 disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{loading ? "Analyzing..." : repository ? "Connect & Launch" : "Launch AFTER"}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useRef } from "react";
import { RefreshCw, Check, Sparkles, Layers, GitBranch, History, Cpu } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useProject, ScanStage } from "../context/ProjectContext";
import { useToast } from "../context/ToastContext";
import { useLanguage } from "../context/LanguageContext";

interface ScanRationaleButtonProps {
  className?: string;
  variant?: "primary" | "secondary";
  showStages?: boolean;
}

const STAGES: { id: ScanStage; labelEn: string; labelPt: string; icon: React.ElementType }[] = [
  { id: "repository", labelEn: "Repository", labelPt: "Repositório", icon: GitBranch },
  { id: "architecture", labelEn: "Architecture", labelPt: "Arquitetura", icon: Layers },
  { id: "dependencies", labelEn: "Dependencies", labelPt: "Dependências", icon: Cpu },
  { id: "history", labelEn: "History", labelPt: "Histórico", icon: History },
  { id: "insights", labelEn: "Insights", labelPt: "Insights", icon: Sparkles },
];

export function ScanRationaleButton({
  className = "",
  variant = "secondary",
  showStages = true,
}: ScanRationaleButtonProps) {
  const { refreshAnalysis, isAnalyzing, scanStage, currentProject } = useProject();
  const { toast } = useToast();
  const { language } = useLanguage();
  const prevStageRef = useRef(scanStage);

  useEffect(() => {
    if (prevStageRef.current !== "completed" && scanStage === "completed") {
      toast.success(
        language === "pt" ? "Análise Atualizada" : "Analysis updated",
        language === "pt"
          ? "Topologia e memória arquitetural sincronizadas com sucesso."
          : "Architecture topology & rationale radar synchronized."
      );
    }
    prevStageRef.current = scanStage;
  }, [scanStage, toast, language]);

  if (!currentProject) return null;

  const getStageIndex = (stage: ScanStage) => {
    switch (stage) {
      case "repository":
        return 0;
      case "architecture":
        return 1;
      case "dependencies":
        return 2;
      case "history":
        return 3;
      case "insights":
        return 4;
      case "completed":
        return 5;
      default:
        return -1;
    }
  };

  const currentStageIndex = getStageIndex(scanStage);

  return (
    <div className="flex flex-col items-end space-y-1.5">
      <motion.button
        type="button"
        id="scan-rationale-btn"
        whileTap={{ scale: 0.97 }}
        onClick={refreshAnalysis}
        disabled={isAnalyzing}
        className={`relative inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer disabled:cursor-wait select-none ${
          variant === "primary"
            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-95 shadow-xs"
            : "border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-850 text-zinc-800 dark:text-zinc-200 shadow-2xs"
        } ${className}`}
      >
        <AnimatePresence mode="wait">
          {scanStage === "completed" ? (
            <motion.div
              key="completed"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-medium"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{language === "pt" ? "Análise Atualizada" : "Analysis updated"}</span>
            </motion.div>
          ) : isAnalyzing ? (
            <motion.div
              key="scanning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center space-x-2 text-zinc-700 dark:text-zinc-300"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-500 shrink-0" />
              <span className="font-mono text-[11px]">
                {language === "pt" ? "Varrendo..." : "Scanning..."}
              </span>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center space-x-2"
            >
              <RefreshCw className="w-3.5 h-3.5 text-zinc-400 group-hover:rotate-45 transition-transform shrink-0" />
              <span>
                {language === "pt" ? "Escanear Racional & Deriva" : "Scan Rationale & Drift"}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Progressive Stage Stepper */}
      <AnimatePresence>
        {isAnalyzing && showStages && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-zinc-100/90 dark:bg-zinc-850/90 border border-zinc-200/60 dark:border-zinc-750 text-[10px] font-mono text-zinc-500 dark:text-zinc-400"
          >
            {STAGES.map((s, idx) => {
              const isDone = currentStageIndex > idx;
              const isCurrent = currentStageIndex === idx;

              return (
                <React.Fragment key={s.id}>
                  <div
                    className={`flex items-center space-x-1 transition-colors duration-150 ${
                      isCurrent
                        ? "text-zinc-950 dark:text-zinc-50 font-semibold"
                        : isDone
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-zinc-400 dark:text-zinc-600 opacity-60"
                    }`}
                  >
                    {isDone ? (
                      <Check className="w-2.5 h-2.5" />
                    ) : (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isCurrent
                            ? "bg-zinc-900 dark:bg-zinc-100 animate-ping"
                            : "bg-zinc-300 dark:bg-zinc-700"
                        }`}
                      />
                    )}
                    <span>{language === "pt" ? s.labelPt : s.labelEn}</span>
                  </div>
                  {idx < STAGES.length - 1 && <span className="text-zinc-300 dark:text-zinc-700">›</span>}
                </React.Fragment>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

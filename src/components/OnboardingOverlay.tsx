import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Zap,
  Shield,
  Network,
  History,
  Lightbulb,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  X,
} from "lucide-react";

interface OnboardingStep {
  id: string;
  title: {
    pt: string;
    en: string;
  };
  description: {
    pt: string;
    en: string;
  };
  icon: React.ElementType;
  accentColor: string;
}

const STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: {
      pt: "Bem-vindo ao AFTER",
      en: "Welcome to AFTER",
    },
    description: {
      pt: "Você acaba de conectar o DNA do seu software. Nossa inteligência está mapeando cada módulo, conexão e segredo técnico do seu repositório.",
      en: "You've just connected your software's DNA. Our intelligence is mapping every module, connection, and technical secret in your repository.",
    },
    icon: Sparkles,
    accentColor: "from-blue-500 to-cyan-400",
  },
  {
    id: "architecture",
    title: {
      pt: "Grafos de Arquitetura",
      en: "Architecture Graphs",
    },
    description: {
      pt: "Transformamos código estático em um mapa vivo. Visualize dependências, identifique gargalos e entenda o impacto de cada alteração em tempo real.",
      en: "We transform static code into a living map. Visualize dependencies, identify bottlenecks, and understand the impact of every change in real-time.",
    },
    icon: Network,
    accentColor: "from-purple-500 to-pink-400",
  },
  {
    id: "memory",
    title: {
      pt: "Memória Forense",
      en: "Forensic Memory",
    },
    description: {
      pt: "Não apenas o 'O que', mas o 'Por que'. Preservamos o racional por trás das decisões, transformando o histórico do Git em uma base de conhecimento eterna.",
      en: "Not just the 'What', but the 'Why'. We preserve the rationale behind decisions, transforming Git history into an eternal knowledge base.",
    },
    icon: History,
    accentColor: "from-emerald-500 to-teal-400",
  },
  {
    id: "insights",
    title: {
      pt: "Evolução Contínua",
      en: "Continuous Evolution",
    },
    description: {
      pt: "Detectamos anomalias, débitos técnicos e riscos arquiteturais antes que eles se tornem problemas. Software que não envelhece sozinho.",
      en: "We detect anomalies, technical debt, and architectural risks before they become problems. Software that doesn't age alone.",
    },
    icon: Lightbulb,
    accentColor: "from-orange-500 to-yellow-400",
  },
];

interface OnboardingOverlayProps {
  language: "pt" | "en";
  onComplete: () => void;
  onSkip?: () => void;
}

export function OnboardingOverlay({ language, onComplete, onSkip }: OnboardingOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const isPt = language === "pt";
  const step = STEPS[currentStep];

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/95 backdrop-blur-xl"
    >
      {/* Abstract Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-zinc-400/5 rounded-full blur-[128px]" />
      </div>

      <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-[2.5rem] p-8 sm:p-12 shadow-2xl overflow-hidden">
        {/* Progress Bar Top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-900">
          <motion.div
            className="h-full bg-white"
            initial={{ width: "0%" }}
            animate={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        </div>

        {/* Skip Button */}
        <button
          onClick={onSkip || onComplete}
          className="absolute top-6 right-8 text-xs font-mono text-zinc-500 hover:text-white transition-colors cursor-pointer"
        >
          {isPt ? "Pular" : "Skip"}
        </button>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center text-center"
          >
            {/* Animated Icon Container */}
            <div className="relative mb-10">
              <div className="absolute inset-0 bg-white/10 blur-3xl rounded-full scale-150" />
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center rounded-3xl bg-zinc-900 border border-zinc-800 shadow-inner">
                <step.icon className="w-10 h-10 sm:w-12 sm:h-12 text-white" strokeWidth={1.5} />
              </div>
              
              {/* Floating Monochromatic Squares (Decorative) */}
              <motion.div 
                animate={{ y: [0, -10, 0], rotate: [0, 45, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-4 -right-4 w-4 h-4 bg-white/20 border border-white/40 rounded-sm" 
              />
              <motion.div 
                animate={{ y: [0, 15, 0], rotate: [0, -45, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="absolute -bottom-2 -left-6 w-3 h-3 bg-zinc-600/30 border border-zinc-500/40 rounded-sm" 
              />
            </div>

            {/* Content */}
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-4">
              {isPt ? step.title.pt : step.title.en}
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-md mx-auto mb-12">
              {isPt ? step.description.pt : step.description.en}
            </p>

            {/* Navigation Controls */}
            <div className="flex items-center justify-between w-full mt-auto">
              <div className="flex items-center space-x-1.5">
                {STEPS.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === currentStep ? "w-8 bg-white" : "w-1.5 bg-zinc-800"
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center space-x-3">
                {currentStep > 0 && (
                  <button
                    onClick={handleBack}
                    className="p-3 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                
                <button
                  onClick={handleNext}
                  className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-white text-zinc-950 font-semibold text-sm hover:bg-zinc-100 transition-all shadow-xl shadow-white/5 cursor-pointer active:scale-95"
                >
                  <span>
                    {currentStep === STEPS.length - 1 
                      ? (isPt ? "Começar agora" : "Get started") 
                      : (isPt ? "Próximo" : "Next")}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

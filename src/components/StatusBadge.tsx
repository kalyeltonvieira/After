import React from "react";
import { SeverityLevel, ConfidenceLevel } from "../types";

interface StatusBadgeProps {
  label: string;
  variant?: "neutral" | "success" | "warning" | "danger" | "info" | "known" | "inferred" | "unknown";
  size?: "sm" | "md";
  className?: string;
}

export function StatusBadge({
  label,
  variant = "neutral",
  size = "sm",
  className = "",
}: StatusBadgeProps) {
  const getStyles = () => {
    switch (variant) {
      case "success":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/40";
      case "warning":
        return "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/40";
      case "danger":
        return "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200/60 dark:border-rose-800/40";
      case "info":
        return "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 border-sky-200/60 dark:border-sky-800/40";
      case "known":
        return "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700 font-semibold tracking-wider";
      case "inferred":
        return "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/50";
      case "unknown":
        return "bg-amber-50/80 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-dashed border-amber-300 dark:border-amber-700/50";
      case "neutral":
      default:
        return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-300 border-zinc-200/80 dark:border-zinc-700/60";
    }
  };

  const sizeClasses =
    size === "sm"
      ? "px-2 py-0.5 text-[11px]"
      : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium whitespace-nowrap leading-none transition-colors ${sizeClasses} ${getStyles()} ${className}`}
    >
      {label}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: SeverityLevel }) {
  const variantMap: Record<SeverityLevel, "neutral" | "warning" | "danger" | "info"> = {
    low: "neutral",
    medium: "info",
    high: "warning",
    critical: "danger",
  };
  return <StatusBadge label={severity.toUpperCase()} variant={variantMap[severity]} />;
}

export function ConfidenceBadge({ confidence }: { confidence: ConfidenceLevel }) {
  const variantMap: Record<ConfidenceLevel, "neutral" | "info" | "success"> = {
    low: "neutral",
    medium: "info",
    high: "success",
  };
  return <StatusBadge label={`${confidence.toUpperCase()} CONFIDENCE`} variant={variantMap[confidence]} />;
}

export function KnowledgeBadge({ status }: { status: "KNOWN" | "INFERRED" | "UNKNOWN" | string }) {
  const normalized = status.toUpperCase();
  let variant: "known" | "inferred" | "unknown" = "known";
  if (normalized === "INFERRED") variant = "inferred";
  if (normalized === "UNKNOWN") variant = "unknown";

  return <StatusBadge label={normalized} variant={variant} />;
}

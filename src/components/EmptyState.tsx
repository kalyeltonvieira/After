import React from "react";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  id?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  id,
}: EmptyStateProps) {
  return (
    <div
      id={id}
      className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/30"
    >
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 mb-4 shadow-xs">
          <Icon className="w-6 h-6 stroke-[1.5]" />
        </div>
      )}
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight max-w-md">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 rounded-full hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all duration-150 shadow-xs cursor-pointer active:scale-98"
          >
            {actionLabel}
          </button>
        )}
        {secondaryActionLabel && onSecondaryAction && (
          <button
            type="button"
            onClick={onSecondaryAction}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-all duration-150 shadow-xs cursor-pointer active:scale-98"
          >
            {secondaryActionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

import React from "react";
import { motion } from "motion/react";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  size?: "sm" | "md";
}

export function Switch({
  checked,
  onChange,
  disabled = false,
  id,
  size = "md",
}: SwitchProps) {
  const isSm = size === "sm";

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex shrink-0 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-100 ${
        isSm ? "w-8 h-4.5" : "w-10 h-5.5"
      } ${
        checked
          ? "bg-zinc-900 dark:bg-zinc-100"
          : "bg-zinc-300 dark:bg-zinc-700"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <motion.span
        layout
        transition={{
          type: "spring",
          stiffness: 700,
          damping: 38,
        }}
        className={`pointer-events-none inline-block rounded-full bg-white dark:bg-zinc-900 shadow-sm ${
          isSm ? "w-3.5 h-3.5" : "w-4.5 h-4.5"
        } ${
          checked
            ? isSm
              ? "translate-x-4"
              : "translate-x-5"
            : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

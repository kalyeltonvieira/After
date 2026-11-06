import React from "react";

/**
 * Standard GitHub Linguist official colors for programming languages and file formats.
 */
export const LANGUAGE_COLORS: Record<string, string> = {
  typescript: "#3178c6",
  javascript: "#f1e05a",
  tsx: "#3178c6",
  jsx: "#f1e05a",
  python: "#3572A5",
  go: "#00ADD8",
  golang: "#00ADD8",
  rust: "#deb887",
  "c++": "#f34b7d",
  cpp: "#f34b7d",
  c: "#555555",
  "c#": "#178600",
  csharp: "#178600",
  java: "#b07219",
  kotlin: "#A97BFF",
  swift: "#F05138",
  ruby: "#701516",
  php: "#4F5D95",
  html: "#e34c26",
  css: "#563d7c",
  scss: "#c6538c",
  sass: "#c6538c",
  less: "#1d365d",
  vue: "#41b883",
  svelte: "#ff3e00",
  shell: "#89e051",
  bash: "#89e051",
  zsh: "#89e051",
  sh: "#89e051",
  sql: "#e38c00",
  graphql: "#e10098",
  dockerfile: "#384d54",
  docker: "#384d54",
  markdown: "#083fa1",
  md: "#083fa1",
  json: "#292929",
  json5: "#292929",
  yaml: "#cb171e",
  yml: "#cb171e",
  toml: "#9c4221",
  xml: "#0060ac",
  zig: "#ec915c",
  dart: "#00B4AB",
  elixir: "#6e4a7e",
  haskell: "#5e5086",
  scala: "#c22d40",
  clojure: "#db5855",
  erlang: "#B83998",
  r: "#198CE7",
  lua: "#000080",
  julia: "#a270ba",
  nim: "#ffc200",
  ocaml: "#ef7a08",
  solidity: "#AA6746",
  webassembly: "#04133b",
  wasm: "#04133b",
  makefile: "#427819",
  cmake: "#DA3434",
  assembly: "#6E4C13",
  asm: "#6E4C13",
  powershell: "#012456",
  batchfile: "#C1F12E",
  matlab: "#e16737",
  groovy: "#4298b8",
  perl: "#0298c3",
  fortran: "#4d41b1",
  racket: "#3c5c6e",
  scheme: "#1e4aec",
  lisp: "#3fb68b",
  actionscript: "#882B43",
  tex: "#3D6117",
  latex: "#3D6117",
};

/**
 * File extension mapping to normalized language name
 */
export const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",
  py: "Python",
  pyw: "Python",
  go: "Go",
  rs: "Rust",
  cpp: "C++",
  cc: "C++",
  cxx: "C++",
  hpp: "C++",
  h: "C",
  c: "C",
  cs: "C#",
  java: "Java",
  kt: "Kotlin",
  kts: "Kotlin",
  swift: "Swift",
  rb: "Ruby",
  php: "PHP",
  html: "HTML",
  htm: "HTML",
  css: "CSS",
  scss: "SCSS",
  sass: "Sass",
  less: "Less",
  vue: "Vue",
  svelte: "Svelte",
  sh: "Shell",
  bash: "Shell",
  zsh: "Shell",
  sql: "SQL",
  gql: "GraphQL",
  graphql: "GraphQL",
  md: "Markdown",
  markdown: "Markdown",
  json: "JSON",
  yaml: "YAML",
  yml: "YAML",
  toml: "TOML",
  xml: "XML",
  zig: "Zig",
  dart: "Dart",
  ex: "Elixir",
  exs: "Elixir",
  hs: "Haskell",
  scala: "Scala",
  clj: "Clojure",
  erl: "Erlang",
  r: "R",
  lua: "Lua",
  jl: "Julia",
  sol: "Solidity",
  wasm: "WebAssembly",
};

const DEFAULT_COLOR = "#8b949e";

/**
 * Resolves official color for a given programming language name or string.
 */
export function getLanguageColor(languageName?: string | null): string {
  if (!languageName || typeof languageName !== "string") return DEFAULT_COLOR;
  const normalized = languageName.trim().toLowerCase();
  return LANGUAGE_COLORS[normalized] || DEFAULT_COLOR;
}

/**
 * Resolves official color based on filename or file extension (e.g., 'App.tsx' -> '#3178c6')
 */
export function getLanguageColorByExtension(filenameOrPath?: string | null): string {
  if (!filenameOrPath || typeof filenameOrPath !== "string") return DEFAULT_COLOR;
  const cleanPath = filenameOrPath.trim().toLowerCase();

  // Special exact filenames
  if (cleanPath.endsWith("dockerfile") || cleanPath.includes("dockerfile")) return LANGUAGE_COLORS["dockerfile"];
  if (cleanPath.endsWith("makefile") || cleanPath.endsWith("make")) return LANGUAGE_COLORS["makefile"];

  const ext = cleanPath.split(".").pop() || "";
  const langName = EXTENSION_TO_LANGUAGE[ext] || ext;
  return getLanguageColor(langName);
}

/**
 * Comprehensive helper returning language metadata: name, color, and extension
 */
export function getLanguageInfo(filenameOrLang?: string | null): { name: string; color: string; extension: string } {
  if (!filenameOrLang) return { name: "Code", color: DEFAULT_COLOR, extension: "code" };
  const input = filenameOrLang.trim();

  if (input.includes(".")) {
    const ext = input.split(".").pop()?.toLowerCase() || "";
    const name = EXTENSION_TO_LANGUAGE[ext] || input;
    const color = getLanguageColorByExtension(input);
    return { name, color, extension: ext.toUpperCase() };
  }

  const name = input;
  const color = getLanguageColor(input);
  return { name, color, extension: input.slice(0, 4).toUpperCase() };
}

interface LanguageColorDotProps {
  language?: string | null;
  filename?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

export function LanguageColorDot({ language, filename, size = "sm", className = "" }: LanguageColorDotProps) {
  const color = filename ? getLanguageColorByExtension(filename) : getLanguageColor(language);
  const sizeClasses = {
    xs: "w-1.5 h-1.5",
    sm: "w-2.5 h-2.5",
    md: "w-3 h-3",
    lg: "w-4 h-4",
  }[size];

  return React.createElement("span", {
    className: `inline-block rounded-full shrink-0 ${sizeClasses} ${className}`,
    style: { backgroundColor: color },
    "aria-hidden": true,
  });
}

interface LanguageBadgeProps {
  language?: string | null;
  filename?: string | null;
  showDot?: boolean;
  className?: string;
}

export function LanguageBadge({ language, filename, showDot = true, className = "" }: LanguageBadgeProps) {
  const info = getLanguageInfo(filename || language);

  const children: React.ReactNode[] = [];
  if (showDot) {
    children.push(
      React.createElement("span", {
        key: "dot",
        className: "w-2 h-2 rounded-full shrink-0",
        style: { backgroundColor: info.color },
      })
    );
  }
  children.push(React.createElement("span", { key: "name" }, info.name));

  return React.createElement("span", {
    className: `inline-flex items-center gap-1.5 text-xs font-mono text-zinc-700 dark:text-zinc-300 ${className}`,
  }, children);
}

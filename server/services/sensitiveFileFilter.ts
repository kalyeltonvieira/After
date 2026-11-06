/**
 * AFTER Sensitive File Filter and Path Security Guard
 * Prevents sensitive files (.env, private keys, certificates, credentials)
 * from being read, sent to LLM prompts, or exposed via APIs.
 * Also provides path traversal defense.
 */

import pathModule from "node:path";

// Exact names or prefixes/extensions of sensitive files that must NEVER be accessed or sent to AI
const SENSITIVE_EXACT_NAMES = new Set([
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".env.staging",
  ".env.test",
  "id_rsa",
  "id_ed25519",
  "id_ecdsa",
  "id_dsa",
  "credentials.json",
  "service-account.json",
  "serviceaccount.json",
  "client_secret.json",
  "firebase-adminsdk.json",
  "jwt.key",
  "privkey.pem",
]);

const SENSITIVE_EXTENSIONS = new Set([
  ".pem",
  ".key",
  ".pkcs12",
  ".pfx",
  ".p12",
  ".keystore",
  ".jks",
  ".der",
  ".crt",
]);

const SENSITIVE_PATTERNS = [
  /^\.env(\..+)?$/i,
  /^id_[a-z0-9_-]+$/i,
  /service[-_]?account.*\.json$/i,
  /client[-_]?secret.*\.json$/i,
  /.*\.key$/i,
  /.*\.pem$/i,
  /.*credentials.*\.json$/i,
  /.*secret.*\.json$/i,
];

// Patterns inside content that resemble secrets/tokens
const CONTENT_SECRET_PATTERNS = [
  /gh[pousr]_[A-Za-z0-9_]{36,}/g, // GitHub tokens
  /ey[A-Za-z0-9-_]+\.ey[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g, // JWT
  /(?:AIza[0-9A-Za-z-_]{35})/g, // Google API key
  /(?:sk-[a-zA-Z0-9]{32,})/g, // OpenAI/Gemini/generic sk
  /AKIA[0-9A-Z]{16}/g, // AWS Access Key
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,
];

/**
 * Checks if a given file path is classified as sensitive.
 */
export function isSensitiveFilePath(rawPath: string): boolean {
  if (!rawPath || typeof rawPath !== "string") return true;
  const normalized = rawPath.replace(/\\/g, "/").trim();
  const basename = pathModule.basename(normalized).toLowerCase();
  const ext = pathModule.extname(normalized).toLowerCase();

  // Explicit safe examples/templates
  if (basename === ".env.example" || basename === ".env.template" || basename === ".env.sample") {
    return false;
  }

  if (SENSITIVE_EXACT_NAMES.has(basename)) return true;
  if (SENSITIVE_EXTENSIONS.has(ext)) return true;

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(basename)) return true;
  }

  // Common sensitive directories
  const segments = normalized.split("/").map((s) => s.toLowerCase());
  if (segments.some((s) => s === ".ssh" || s === ".aws" || s === ".gnupg")) {
    return true;
  }

  return false;
}

/**
 * Validates that a requested path does not traverse outside the repository workspace.
 * Strips leading slashes, normalizes paths, and rejects any paths escaping the workspace via `..`.
 */
export function sanitizeRepoRelativePath(rawPath: string): string | null {
  if (!rawPath || typeof rawPath !== "string") return null;
  const trimmed = rawPath.trim().replace(/\\/g, "/");
  if (!trimmed) return null;

  // Strip leading slashes to evaluate as repo-relative
  const withoutLeadingSlash = trimmed.replace(/^\/+/, "");
  if (!withoutLeadingSlash) return null;

  const normalized = pathModule.posix.normalize(withoutLeadingSlash);

  // If after normalization it starts with '..' or resolves to absolute, reject
  if (normalized.startsWith("..") || normalized === "." || pathModule.posix.isAbsolute(normalized)) {
    return null;
  }

  return normalized;
}

/**
 * Redacts secrets from source code or text before it is passed to LLM prompts.
 */
export function redactSecrets(content: string): string {
  if (!content || typeof content !== "string") return "";
  let redacted = content;
  for (const pattern of CONTENT_SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, "[REDACTED_SECRET]");
  }
  return redacted;
}

/**
 * Filters a list of file paths, removing all sensitive and blocked files.
 */
export function filterSafeFilePaths(paths: string[]): string[] {
  if (!Array.isArray(paths)) return [];
  return paths.filter((p) => typeof p === "string" && !isSensitiveFilePath(p));
}

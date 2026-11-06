import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isSensitiveFilePath,
  sanitizeRepoRelativePath,
  redactSecrets,
  filterSafeFilePaths,
} from "../server/services/sensitiveFileFilter.js";

test("Security: isSensitiveFilePath detects sensitive files and keys", () => {
  assert.equal(isSensitiveFilePath(".env"), true);
  assert.equal(isSensitiveFilePath(".env.local"), true);
  assert.equal(isSensitiveFilePath(".env.production"), true);
  assert.equal(isSensitiveFilePath("id_rsa"), true);
  assert.equal(isSensitiveFilePath("id_ed25519"), true);
  assert.equal(isSensitiveFilePath("server.key"), true);
  assert.equal(isSensitiveFilePath("cert.pem"), true);
  assert.equal(isSensitiveFilePath("credentials.json"), true);
  assert.equal(isSensitiveFilePath("service-account.json"), true);
  assert.equal(isSensitiveFilePath(".ssh/id_rsa"), true);

  // Safe files should not be flagged
  assert.equal(isSensitiveFilePath("src/App.tsx"), false);
  assert.equal(isSensitiveFilePath("package.json"), false);
  assert.equal(isSensitiveFilePath("README.md"), false);
  assert.equal(isSensitiveFilePath("server.ts"), false);
  assert.equal(isSensitiveFilePath(".env.example"), false);
});

test("Security: sanitizeRepoRelativePath blocks path traversal escaping repository", () => {
  assert.equal(sanitizeRepoRelativePath("../../../etc/passwd"), null);
  assert.equal(sanitizeRepoRelativePath(".."), null);
  assert.equal(sanitizeRepoRelativePath("src/../../etc/shadow"), null);
  assert.equal(sanitizeRepoRelativePath(""), null);

  // Valid relative paths
  assert.equal(sanitizeRepoRelativePath("src/App.tsx"), "src/App.tsx");
  assert.equal(sanitizeRepoRelativePath("/src/App.tsx"), "src/App.tsx");
  assert.equal(sanitizeRepoRelativePath("components/Widget.tsx"), "components/Widget.tsx");
});

test("Security: redactSecrets redacts tokens and private keys", () => {
  const secretContent = "const token = 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';";
  const redacted = redactSecrets(secretContent);
  assert.equal(redacted.includes("ghp_"), false);
  assert.equal(redacted.includes("[REDACTED_SECRET]"), true);

  const awsContent = "const aws = 'AKIAIOSFODNN7EXAMPLE';";
  const redactedAws = redactSecrets(awsContent);
  assert.equal(redactedAws.includes("AKIAIOSFODNN7EXAMPLE"), false);
  assert.equal(redactedAws.includes("[REDACTED_SECRET]"), true);
});

test("Security: filterSafeFilePaths removes sensitive paths from list", () => {
  const list = ["README.md", ".env", "src/index.ts", "service-account.json", "id_rsa"];
  const safe = filterSafeFilePaths(list);
  assert.deepEqual(safe, ["README.md", "src/index.ts"]);
});

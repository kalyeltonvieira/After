import test from "node:test";
import assert from "node:assert/strict";
import { buildCommitMemoryEntries, sanitizeFirestoreData } from "../src/lib/firestoreSanitize.js";

test("sanitizeFirestoreData removes nested undefined without mutating input", () => {
  const original = {
    keep: "value",
    missing: undefined,
    nested: { present: 1, absent: undefined },
    list: [1, undefined, null, { absent: undefined, present: true }],
  };
  const cleaned = sanitizeFirestoreData(original);
  assert.deepEqual(cleaned, {
    keep: "value",
    nested: { present: 1 },
    list: [1, null, { present: true }],
  });
  assert.equal("missing" in original, true);
  assert.equal("absent" in original.nested, true);
});

test("sanitizeFirestoreData preserves Date, null, and special instances", () => {
  class Marker { value = 1; }
  const date = new Date("2026-01-01T00:00:00.000Z");
  const marker = new Marker();
  const cleaned = sanitizeFirestoreData({ date, marker, empty: null });
  assert.equal(cleaned.date, date);
  assert.equal(cleaned.marker, marker);
  assert.equal(cleaned.empty, null);
});

test("buildCommitMemoryEntries ignores non-commit events and events without SHA", () => {
  const entries = buildCommitMemoryEntries([
    { id: "pr_1", projectId: "p", event: "PR", actor: "a", timestamp: "2026-01-01", affectedComponents: [], reason: "PR", metadata: { type: "pull_request", url: "https://example.test/pr/1" } },
    { id: "issue_1", projectId: "p", event: "Issue", actor: "a", timestamp: "2026-01-01", affectedComponents: [], reason: "Issue", metadata: { type: "issue" } },
    { id: "commit_missing", projectId: "p", event: "Missing SHA", actor: "a", timestamp: "2026-01-01", affectedComponents: [], reason: "No SHA" },
  ], "p", [], "2026-01-02T00:00:00.000Z");
  assert.deepEqual(entries, []);
});

test("buildCommitMemoryEntries builds a typed memory record for a real commit", () => {
  const entries = buildCommitMemoryEntries([
    { id: "commit_abc", projectId: "p", event: "Initial commit", actor: "a", timestamp: "2026-01-01", affectedComponents: ["src/index.ts"], reason: "Commit observed", metadata: { fullSha: "abcdef012345", url: "https://github.com/o/r/commit/abcdef012345" } },
  ], "p", [], "2026-01-02T00:00:00.000Z");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].type, "commit");
  assert.equal(entries[0].source?.id, "abcdef012345");
  assert.equal(entries[0].source?.url, "https://github.com/o/r/commit/abcdef012345");
});

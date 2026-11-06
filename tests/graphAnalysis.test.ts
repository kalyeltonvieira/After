import test from "node:test";
import assert from "node:assert/strict";
import { calculateImpact } from "../server/services/graphAnalysis.js";

test("Impact Analysis: finds transitive dependents, blast radius, and affected tests/APIs", () => {
  const nodes = [
    { id: "auth_service", label: "authService", type: "function", filePath: "src/services/authService.ts" },
    { id: "api_route", label: "apiAuth", type: "api", filePath: "server/routes/apiAuth.ts" },
    { id: "login_page", label: "LoginPage", type: "component", filePath: "src/pages/LoginPage.tsx" },
    { id: "auth_test", label: "authTest", type: "file", filePath: "tests/authService.test.ts" },
  ];

  const edges = [
    { from: "api_route", to: "auth_service", relationship: "CALLS", evidence: "authService.verify()" },
    { from: "login_page", to: "api_route", relationship: "CALLS", evidence: "fetch('/api/login')" },
    { from: "auth_test", to: "auth_service", relationship: "IMPORTS", evidence: "import { authService }" },
  ];

  const impact = calculateImpact("auth_service", nodes, edges);
  assert.ok(impact);
  assert.equal(impact.node.id, "auth_service");
  assert.deepEqual(impact.transitiveDependentIds.sort(), ["api_route", "auth_test", "login_page"]);
  assert.deepEqual(impact.affectedTests, ["tests/authService.test.ts"]);
  assert.deepEqual(impact.affectedApis, ["server/routes/apiAuth.ts"]);
  assert.equal(impact.certainty, "KNOWN");
  assert.ok(impact.blastRadiusScore > 0);
  assert.ok(impact.evidence.length >= 2);
});
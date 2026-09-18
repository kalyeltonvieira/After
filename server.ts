import express from "express";
import cookieParser from "cookie-parser";
import { githubOAuthCallback } from "./server/routes/projects.ts";
import path from "path";
import { fileURLToPath } from "url";
import { apiRouter } from "./server/app.ts";
import { githubWebhookHandler } from "./server/routes/githubWebhook.ts";
import { recoverQueuedIncrementalAnalyses } from "./server/services/incrementalAnalysis.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.post(
  "/api/projects/github-webhook",
  express.raw({ type: "application/json", limit: "2mb" }),
  githubWebhookHandler as any
);

app.use(express.json());
app.use(cookieParser());

app.get("/auth/callback", githubOAuthCallback);

app.use("/api", apiRouter);

// Serve static assets from Vite build in production
app.use(express.static(path.join(__dirname, "dist")));

// SPA fallback to index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`AFTER server running on http://0.0.0.0:${PORT}`);
  void recoverQueuedIncrementalAnalyses()
    .then((count) => {
      if (count > 0) console.log(`AFTER resumed ${count} queued analysis job(s).`);
    })
    .catch((error) => console.warn("Could not recover queued analysis jobs:", error?.message));
});

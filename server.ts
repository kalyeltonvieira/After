import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { apiRouter } from "./server/app.ts";
import { githubWebhookHandler } from "./server/routes/githubWebhook.ts";
import { recoverQueuedIncrementalAnalyses } from "./server/services/incrementalAnalysis.ts";
import { requestIdMiddleware } from "./server/observability.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Preserve dev server uptime against unhandled rejections
process.on("unhandledRejection", (reason) => {
  console.warn("Ignored unhandledRejection to preserve dev server uptime:", (reason as any)?.message || reason);
});

process.on("uncaughtException", (error: any) => {
  if (error?.code === "EADDRINUSE" || String(error?.message || "").includes("EADDRINUSE")) {
    console.error("Fatal: Port is already in use (EADDRINUSE). Exiting to permit clean restart.", error?.message || error);
    process.exit(1);
  }
  console.warn("Ignored uncaughtException to preserve dev server uptime:", error?.message || error);
});

async function startServer() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(requestIdMiddleware);
  app.use(helmet({ contentSecurityPolicy: false }));
  const apiLimiter = rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many requests. Please retry shortly." },
  });
  const envPort = Number(process.env.APP_PORT || process.env.PORT);
  const PORT = envPort && envPort !== 8080 ? envPort : 3000;

  app.post(
    "/api/projects/github-webhook",
    express.raw({ type: "application/json", limit: "2mb" }),
    githubWebhookHandler as any
  );

  app.use(express.json());
  app.use(cookieParser());

  app.use("/api", apiLimiter, apiRouter);

  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`AFTER server running on http://0.0.0.0:${PORT}`);
    void recoverQueuedIncrementalAnalyses()
      .then((count) => {
        if (count > 0) console.log(`AFTER resumed ${count} queued analysis job(s).`);
      })
      .catch((error) => console.warn("Could not recover queued analysis jobs:", error?.message));
  });

  server.on("error", (err: any) => {
    if (err?.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use (EADDRINUSE). Exiting process.`);
      process.exit(1);
    }
    console.error("HTTP server error:", err);
    process.exit(1);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});

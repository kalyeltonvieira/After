import dotenv from "dotenv";
dotenv.config({ override: true });
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

// Unhandled failures can leave the process in an unknown state. Log them and
// terminate so the process supervisor can restart a clean instance.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection; terminating process:", reason);
  process.exit(1);
});

process.on("uncaughtException", (error: any) => {
  console.error("Uncaught exception; terminating process:", error);
  process.exit(1);
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

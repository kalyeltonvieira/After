import express, { Router } from "express";
import { aiRouter } from "./routes/ai.js";
import { projectsRouter } from "./routes/projects.js";
import { repositoryRouter } from "./routes/repository.js";

export const apiRouter = Router();

apiRouter.use(express.json());

// Health check
apiRouter.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "AFTER Backend Engine",
    timestamp: new Date().toISOString(),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY)
  });
});

// Mount AI and Project sub-routers
apiRouter.use("/gemini", aiRouter);
apiRouter.use("/projects", projectsRouter);
apiRouter.use("/repository", repositoryRouter);

// Catch-all 404 for API routes to prevent HTML error leaks
apiRouter.use((req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

// Global API error handler returning structured JSON
apiRouter.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("API Error:", err?.message || err);
  res.status(Number(err?.status) || 500).json({ error: err?.message || "Internal API error" });
});

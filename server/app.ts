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

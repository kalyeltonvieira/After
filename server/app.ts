import express, { Router } from "express";
import { aiRouter } from "./routes/ai.js";
import { projectsRouter } from "./routes/projects.js";

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

// OAuth popup callback handler
apiRouter.get("/auth/callback", (req, res) => {
  const { code, error } = req.query;
  res.send(`
    <!doctype html>
    <html>
      <head><title>AFTER GitHub Authorization</title></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #09090b; color: #f4f4f5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
        <div style="text-align: center; max-width: 400px; padding: 24px;">
          <h2 style="font-size: 18px; margin-bottom: 8px;">GitHub Authorization</h2>
          <p style="font-size: 13px; color: #a1a1aa;">Communicating with AFTER window...</p>
        </div>
        <script>
          try {
            if (window.opener) {
              window.opener.postMessage({
                type: 'OAUTH_AUTH_SUCCESS',
                code: ${JSON.stringify(code || null)},
                error: ${JSON.stringify(error || null)}
              }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          } catch (e) {
            window.close();
          }
        </script>
      </body>
    </html>
  `);
});

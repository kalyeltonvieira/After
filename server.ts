import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { apiRouter } from "./server/app.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use("/api", apiRouter);
app.get("/auth/callback", (req, res, next) => {
  (apiRouter as any)(req, res, next);
});

// Serve static assets from Vite build in production
app.use(express.static(path.join(__dirname, "dist")));

// SPA fallback to index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`AFTER server running on http://0.0.0.0:${PORT}`);
});

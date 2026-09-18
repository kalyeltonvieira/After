import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import express from 'express';
import path from 'path';
import {defineConfig, Plugin} from 'vite';
import cookieParser from 'cookie-parser';
import {apiRouter} from './server/app.ts';
import { githubWebhookHandler } from './server/routes/githubWebhook.ts';

function expressApiPlugin(): Plugin {
  return {
    name: 'express-api-plugin',
    configureServer(server) {
      const app = express();
      app.post('/projects/github-webhook', express.raw({ type: 'application/json', limit: '2mb' }), githubWebhookHandler as any);
      app.use(express.json());
      app.use(cookieParser());
      app.use(apiRouter);

      server.middlewares.use('/api', (req, res, next) => {
        (app as any)(req, res, next);
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), expressApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

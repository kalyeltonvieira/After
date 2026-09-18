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
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // AI Studio's preview proxy can drop the Vite HMR websocket and trigger
      // repeated "server connection lost" polling. The platform rebuilds the
      // preview when files change, so keep Vite HMR disabled here.
      hmr: false,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

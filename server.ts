import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { getDb } from './server/db.js';
import { authenticate } from './server/auth.js';
import { ensureStorageDirectories, cleanupStaging } from './server/storage.js';
import { ensureKeypairExists } from './server/crypto.js';

import authRoutes from './server/routes/auth.routes.js';
import evidenceRoutes from './server/routes/evidence.routes.js';
import custodyRoutes from './server/routes/custody.routes.js';
import checkpointRoutes from './server/routes/checkpoints.routes.js';
import verificationRoutes from './server/routes/verification.routes.js';
import caseRoutes from './server/routes/cases.routes.js';
import reportRoutes from './server/routes/reports.routes.js';
import adminRoutes from './server/routes/admin.routes.js';

const PORT = 3000;
const HOST = '0.0.0.0';

async function bootstrap() {
  const app = express();

  // Initialize storage, crypto keypairs, and database
  ensureStorageDirectories();
  ensureKeypairExists();
  cleanupStaging();
  await getDb();

  // Basic security and parsing middleware
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));
  app.use(cookieParser());

  // Global authentication session resolver
  app.use(authenticate);

  // Health check
  app.get('/api/ping', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'EVIDENCELOCK Forensic API',
      version: '2026.1.0',
      timestamp: new Date().toISOString()
    });
  });

  // REST API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/evidence', evidenceRoutes);
  app.use('/api/custody', custodyRoutes);
  app.use('/api/checkpoints', checkpointRoutes);
  app.use('/api/verify', verificationRoutes);
  app.use('/api/cases', caseRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/admin', adminRoutes);

  // Catch any unmatched /api requests and return JSON 404 (prevents Vite HTML fallback)
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Forensic API endpoint not found' });
  });

  // API error handler (never leaks sensitive internal stack traces)
  app.use('/api', (err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('API Error handler:', err);
    res.status(err.status || 500).json({
      error: 'Forensic System Error',
      message: err.message || 'An unexpected condition prevented the operation from completing.',
    });
  });

  // Vite development middleware or production static build
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, HOST, () => {
    console.log(`[EVIDENCELOCK] Running on http://${HOST}:${PORT}`);
    console.log(`[EVIDENCELOCK] Mode: ${isProduction ? 'Production' : 'Development'}`);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});

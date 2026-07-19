/**
 * FanPulse AI — Express Server Entry Point
 *
 * Bootstraps the application:
 * 1. Validates environment config (fails fast on missing vars)
 * 2. Initializes the database and seeds demo data
 * 3. Starts the crowd simulator background tick
 * 4. Configures security middleware (Helmet, CORS)
 * 5. Mounts all API routes
 * 6. Starts the HTTP server
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config.js';

// Initialize DB and crowd simulator at startup
import './db/database.js';
import { startSimulator } from './simulator/crowdSimulator.js';

// Route imports
import { authRouter } from './routes/authRoutes.js';
import { crowdRouter } from './routes/crowdRoutes.js';
import { chatRouter } from './routes/chatRoutes.js';
import { incidentRouter } from './routes/incidentRoutes.js';
import { briefingRouter } from './routes/briefingRoutes.js';
import { sustainabilityRouter } from './routes/sustainabilityRoutes.js';

// Error handling
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();

// ── Security Headers ────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = config.corsOrigin.split(',').map((o) => o.trim());
app.use(
  cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (e.g., Postman, curl, same-origin)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: Origin '${origin}' not allowed`));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// ── Body Parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '50kb' })); // Tight body size limit

// ── Request Logging (minimal, no PII) ───────────────────────────────────────
app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ── Health Check ────────────────────────────────────────────────────────────
app.get('/api/health', (_req: express.Request, res: express.Response) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    aiMode: config.isMockAiMode ? 'mock' : 'live',
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/crowd', crowdRouter);
app.use('/api/chat', chatRouter);
app.use('/api/incidents', incidentRouter);
app.use('/api/briefings', briefingRouter);
app.use('/api/sustainability', sustainabilityRouter);

// ── 404 Handler ─────────────────────────────────────────────────────────────
app.use(notFoundHandler);

// ── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ─────────────────────────────────────────────────────────────
const server = app.listen(config.port, () => {
  console.log(`\n🏟️  FanPulse AI Server running on http://localhost:${config.port}`);
  console.log(`   AI Mode: ${config.isMockAiMode ? '⚠️  MOCK (no API key)' : '✅ Live (Claude)'}`);
  console.log(`   Env: ${config.nodeEnv}\n`);

  // Start the crowd simulator after server is ready
  startSimulator();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('[Server] HTTP server closed.');
    process.exit(0);
  });
});

export { app };

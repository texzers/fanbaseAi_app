/**
 * Crowd Routes — serves simulated live crowd data and AI wayfinding.
 */

import { Router, Request, Response } from 'express';
import { standardLimiter, aiLimiter } from '../middleware/rateLimiter.js';
import { validate, wayfindingSchema } from '../middleware/validationMiddleware.js';
import { getCurrentCrowdStatus } from '../services/crowdService.js';
import { generateWayfinding } from '../services/wayfindingService.js';
import { WayfindingRequest } from '@fanpulse/shared-types';

export const crowdRouter = Router();

/**
 * GET /api/crowd/status
 * Returns the current crowd density for all zones/gates with AI briefing.
 * Public endpoint (no auth required) — rate limited.
 */
crowdRouter.get('/status', standardLimiter, async (_req: Request, res: Response) => {
  try {
    const status = await getCurrentCrowdStatus();
    res.json({ success: true, data: status, timestamp: new Date().toISOString() });
  } catch (error) {
    throw error;
  }
});

/**
 * POST /api/crowd/wayfinding
 * Returns AI-generated step-by-step directions from one stadium location to another,
 * incorporating live crowd density to route fans away from congested areas.
 * Public endpoint (no auth required) — AI rate limited.
 */
crowdRouter.post(
  '/wayfinding',
  aiLimiter,
  validate(wayfindingSchema),
  async (req: Request, res: Response) => {
    const directions = await generateWayfinding(req.body as WayfindingRequest);
    res.json({ success: true, data: directions, timestamp: new Date().toISOString() });
  }
);

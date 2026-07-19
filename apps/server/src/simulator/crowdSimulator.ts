/**
 * Crowd Simulator — generates realistic, dynamically changing stadium crowd
 * density readings for all gates and zones.
 *
 * This module stands in for a real IoT/turnstile data feed. It simulates
 * fan arrival waves, half-time rushes, and exit surges based on a
 * configurable match timeline. All readings are clearly marked as simulated.
 *
 * The simulator ticks every SIMULATOR_TICK_MS (configurable, default 10s) on
 * a setInterval — no busy loop. Consumers call getCrowdState() to get the
 * latest snapshot without triggering re-computation.
 */

import { CrowdReading, CrowdStatus, ZoneCrowdSummary, CrowdStatusResponse } from '@fanpulse/shared-types';
import { config } from '../config.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Crowd density thresholds (percentage) */
const DENSITY_THRESHOLD = {
  LOW: 50,       // < 50% → low
  MODERATE: 75,  // 50–75% → moderate
  CONGESTED: 76, // > 75% → congested
} as const;

/** Gate seed data — matches DB seed in database.ts */
const GATE_DEFS = [
  { id: 'gate-a', name: 'Gate A', zoneId: 'zone-north', baseDensity: 60 },
  { id: 'gate-b', name: 'Gate B', zoneId: 'zone-north', baseDensity: 45 },
  { id: 'gate-c', name: 'Gate C', zoneId: 'zone-north', baseDensity: 80 },
  { id: 'gate-d', name: 'Gate D', zoneId: 'zone-south', baseDensity: 55 },
  { id: 'gate-e', name: 'Gate E', zoneId: 'zone-south', baseDensity: 40 },
  { id: 'gate-f', name: 'Gate F', zoneId: 'zone-south', baseDensity: 70 },
  { id: 'gate-g', name: 'Gate G', zoneId: 'zone-east', baseDensity: 35 },
  { id: 'gate-h', name: 'Gate H', zoneId: 'zone-east', baseDensity: 65 },
  { id: 'gate-i', name: 'Gate I', zoneId: 'zone-west', baseDensity: 50 },
  { id: 'gate-j', name: 'Gate J', zoneId: 'zone-west', baseDensity: 75 },
] as const;

const ZONE_DEFS = [
  { id: 'zone-north', name: 'North Zone', color: '#3B82F6' },
  { id: 'zone-south', name: 'South Zone', color: '#10B981' },
  { id: 'zone-east', name: 'East Zone', color: '#F59E0B' },
  { id: 'zone-west', name: 'West Zone', color: '#EF4444' },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type ZoneId = (typeof ZONE_DEFS)[number]['id'];

// ─── State ────────────────────────────────────────────────────────────────────

/** Internal mutable state — updated each tick. */
let currentReadings: Map<string, CrowdReading> = new Map();
let tickCount = 0;
let simulatorInterval: ReturnType<typeof setInterval> | null = null;

// ─── Helper functions ─────────────────────────────────────────────────────────

/** Returns a crowd status label based on density percentage. */
function getDensityStatus(density: number): CrowdStatus {
  if (density < DENSITY_THRESHOLD.LOW) return 'low';
  if (density < DENSITY_THRESHOLD.CONGESTED) return 'moderate';
  return 'congested';
}

/** Clamps a number between min and max. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Generates a realistic density value by applying:
 * - Time-based modifiers (arrival wave, half-time rush, exit surge)
 * - Random gaussian-like noise for natural variance
 * - Clamp to [0, 100]
 */
function computeDensity(baseDensity: number, tick: number): number {
  // Simulate match phases using tick count
  // Each tick = SIMULATOR_TICK_MS (default 10s)
  const phase = tick % 180; // 30-min virtual cycle (180 ticks * 10s = 30min)

  let modifier = 0;

  // Pre-match arrival surge (ticks 0-30)
  if (phase < 30) {
    modifier = (phase / 30) * 25;
  }
  // Match in progress — steady state (ticks 30-90)
  else if (phase < 90) {
    modifier = 10;
  }
  // Half-time rush — restroom/food queues spike (ticks 90-120)
  else if (phase < 120) {
    modifier = 20 + ((phase - 90) / 30) * 15;
  }
  // Second half — settling back down (ticks 120-150)
  else if (phase < 150) {
    modifier = 15 - ((phase - 120) / 30) * 10;
  }
  // Exit surge (ticks 150-180)
  else {
    modifier = -20 + ((phase - 150) / 30) * -30;
  }

  // Gaussian noise: average 2 random samples for a bell-curve effect
  const noise = ((Math.random() + Math.random()) / 2 - 0.5) * 20;

  return clamp(Math.round(baseDensity + modifier + noise), 0, 100);
}

/** Estimates queue time in minutes from density percentage. */
function computeQueueTime(density: number): number {
  if (density < 30) return 0;
  if (density < 50) return Math.round((density - 30) / 5);
  if (density < 75) return Math.round(4 + (density - 50) / 5);
  return Math.round(9 + (density - 75) / 2);
}

/** Generates a unique reading ID. */
function makeReadingId(gateId: string, tick: number): string {
  return `${gateId}-tick-${tick}`;
}

// ─── Tick function ─────────────────────────────────────────────────────────────

/** Recomputes crowd readings for all gates. Called on every simulator tick. */
function tick(): void {
  tickCount++;
  const updatedAt = new Date().toISOString();

  for (const gate of GATE_DEFS) {
    const density = computeDensity(gate.baseDensity, tickCount);
    const status = getDensityStatus(density);
    const queueTime = computeQueueTime(density);

    currentReadings.set(gate.id, {
      id: makeReadingId(gate.id, tickCount),
      gateId: gate.id,
      zoneId: gate.zoneId,
      densityPercentage: density,
      queueTimeMin: queueTime,
      status,
      inboundFlowPerMin: Math.round(density * 3.5), // rough turnstile sim
      updatedAt,
    });
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the current crowd state as a CrowdStatusResponse.
 *
 * Groups gate readings by zone, computes zone-level aggregates,
 * and returns a snapshot ready for the API response. The `isSimulated: true`
 * flag is always set to clearly communicate that this is not real IoT data.
 */
export function getCrowdState(): Omit<CrowdStatusResponse, 'operationalBriefing'> {
  const simulatedAt = new Date().toISOString();
  const zoneMap = new Map<ZoneId, CrowdReading[]>();

  for (const [, reading] of currentReadings) {
    const zoneId = reading.zoneId as ZoneId;
    if (!zoneMap.has(zoneId)) zoneMap.set(zoneId, []);
    zoneMap.get(zoneId)!.push(reading);
  }

  const zones: ZoneCrowdSummary[] = ZONE_DEFS.map((zoneDef) => {
    const gates = zoneMap.get(zoneDef.id) ?? [];
    const densities = gates.map((g) => g.densityPercentage);
    const avg = densities.length
      ? Math.round(densities.reduce((a, b) => a + b, 0) / densities.length)
      : 0;
    const max = densities.length ? Math.max(...densities) : 0;

    return {
      zoneId: zoneDef.id,
      zoneName: zoneDef.name,
      avgDensityPercentage: avg,
      maxDensityPercentage: max,
      status: getDensityStatus(max),
      gates,
    };
  });

  const allDensities = zones.map((z) => z.avgDensityPercentage);
  const overallAvg = allDensities.length
    ? Math.round(allDensities.reduce((a, b) => a + b, 0) / allDensities.length)
    : 0;

  return {
    simulatedAt,
    isSimulated: true,
    zones,
    overallStatus: getDensityStatus(overallAvg),
  };
}

/**
 * Returns the raw gate readings map — used by AI services to inject only
 * relevant data into prompts (token efficiency).
 */
export function getRawReadings(): Map<string, CrowdReading> {
  return new Map(currentReadings);
}

/**
 * Returns a JSON summary of crowd state suitable for injecting into AI prompts.
 * Only includes fields relevant to the AI — no internal IDs.
 */
export function getCrowdContextForAI(): string {
  const state = getCrowdState();
  const summary = state.zones.map((z: any) => ({
    zone: z.zoneName,
    avgDensity: `${z.avgDensityPercentage}%`,
    maxDensity: `${z.maxDensityPercentage}%`,
    status: z.status,
    gates: z.gates.map((g: any) => ({
      gate: g.gateId.replace('gate-', 'Gate ').toUpperCase(),
      density: `${g.densityPercentage}%`,
      queueMin: g.queueTimeMin,
      status: g.status,
    })),
  }));
  return JSON.stringify(summary, null, 2);
}

/**
 * Starts the crowd simulator background ticker.
 * Safe to call multiple times — won't create duplicate intervals.
 */
export function startSimulator(): void {
  if (simulatorInterval) return;

  // Run an initial tick immediately so state is populated before first request
  tick();

  simulatorInterval = setInterval(tick, config.simulatorTickMs);
  console.log(
    `[Simulator] Crowd simulator started (tick every ${config.simulatorTickMs}ms)`
  );
}

/**
 * Stops the crowd simulator (useful in tests to prevent open handles).
 */
export function stopSimulator(): void {
  if (simulatorInterval) {
    clearInterval(simulatorInterval);
    simulatorInterval = null;
    console.log('[Simulator] Crowd simulator stopped.');
  }
}

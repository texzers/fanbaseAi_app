/**
 * Unit tests for the crowd simulator.
 * Tests tick behavior, density computation, and getCrowdState() output structure.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getCrowdState,
  getCrowdContextForAI,
  startSimulator,
  stopSimulator,
} from '../../simulator/crowdSimulator.js';

describe('crowdSimulator', () => {
  beforeEach(() => {
    startSimulator();
  });

  afterEach(() => {
    stopSimulator();
  });

  describe('getCrowdState()', () => {
    it('should return a valid CrowdStatusResponse structure', () => {
      const state = getCrowdState();

      expect(state).toHaveProperty('simulatedAt');
      expect(state.isSimulated).toBe(true);
      expect(Array.isArray(state.zones)).toBe(true);
      expect(state.zones).toHaveLength(4);
      expect(['low', 'moderate', 'congested']).toContain(state.overallStatus);
    });

    it('should have all four zones', () => {
      const state = getCrowdState();
      const zoneIds = state.zones.map((z: any) => z.zoneId);

      expect(zoneIds).toContain('zone-north');
      expect(zoneIds).toContain('zone-south');
      expect(zoneIds).toContain('zone-east');
      expect(zoneIds).toContain('zone-west');
    });

    it('should have valid density percentages (0-100)', () => {
      const state = getCrowdState();

      for (const zone of state.zones) {
        expect(zone.avgDensityPercentage).toBeGreaterThanOrEqual(0);
        expect(zone.avgDensityPercentage).toBeLessThanOrEqual(100);
        expect(zone.maxDensityPercentage).toBeGreaterThanOrEqual(0);
        expect(zone.maxDensityPercentage).toBeLessThanOrEqual(100);

        for (const gate of zone.gates) {
          expect(gate.densityPercentage).toBeGreaterThanOrEqual(0);
          expect(gate.densityPercentage).toBeLessThanOrEqual(100);
          expect(gate.queueTimeMin).toBeGreaterThanOrEqual(0);
          expect(['low', 'moderate', 'congested']).toContain(gate.status);
        }
      }
    });

    it('should mark state as simulated', () => {
      const state = getCrowdState();
      expect(state.isSimulated).toBe(true);
    });

    it('should return a valid ISO timestamp', () => {
      const state = getCrowdState();
      expect(() => new Date(state.simulatedAt)).not.toThrow();
      expect(new Date(state.simulatedAt).toISOString()).toBe(state.simulatedAt);
    });
  });

  describe('getCrowdContextForAI()', () => {
    it('should return valid JSON string', () => {
      const ctx = getCrowdContextForAI();
      expect(() => JSON.parse(ctx)).not.toThrow();
    });

    it('should contain zone information', () => {
      const ctx = getCrowdContextForAI();
      const parsed = JSON.parse(ctx) as unknown[];
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
    });
  });
});

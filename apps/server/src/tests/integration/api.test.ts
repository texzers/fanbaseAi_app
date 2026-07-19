/**
 * Comprehensive Integration Tests — Problem Statement Alignment
 *
 * Tests aligned to the FIFA World Cup 2026 hackathon problem statement:
 * 1. Fan multilingual concierge (language param, accessibility mode)
 * 2. Crowd-grounded ops assistant (RBAC, grounded responses)
 * 3. AI incident co-pilot (create, classify, RBAC)
 * 4. Volunteer shift briefing generator (RBAC, translation)
 * 5. Sustainability / carbon-footprint transport advisor
 * 6. Smart wayfinding with crowd context
 * 7. Input validation & injection prevention
 * 8. Health check & 404 handling
 * 9. JWT authentication & role-based access control
 *
 * ALL tests run in Mock AI mode — no real API calls are made.
 * Mock responses are clearly labeled but structurally valid.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { stopSimulator } from '../../simulator/crowdSimulator.js';

// App is imported after env vars are forced by vitest.config.ts env block
const { app } = await import('../../index.js');

// Token store — populated in auth tests and reused across test groups
let fanToken = '';
let volunteerToken = '';
let organizerToken = '';

describe('FanPulse AI — Full API Test Suite', () => {
  afterAll(() => {
    stopSimulator();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. AUTHENTICATION
  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /api/auth/login', () => {
    it('logs in as fan and returns a signed JWT', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'alex_fan', password: 'fan123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.role).toBe('fan');
      fanToken = res.body.data.token as string;
    });

    it('logs in as volunteer and returns correct role', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'sam_volunteer', password: 'vol123' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe('volunteer');
      volunteerToken = res.body.data.token as string;
    });

    it('logs in as organizer and returns correct role', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin_organizer', password: 'org123' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe('organizer');
      organizerToken = res.body.data.token as string;
    });

    it('rejects wrong password with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'alex_fan', password: 'WRONG' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects missing password field with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'alex_fan' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects missing username field with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'fan123' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns user profile without sensitive fields (no password hash)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'alex_fan', password: 'fan123' });

      expect(res.body.data.user).not.toHaveProperty('passwordHash');
      expect(res.body.data.user).not.toHaveProperty('password');
      expect(res.body.data.user).toHaveProperty('id');
      expect(res.body.data.user).toHaveProperty('username');
      expect(res.body.data.user).toHaveProperty('role');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. CROWD STATUS — Real-time simulated turnstile data
  // ═══════════════════════════════════════════════════════════════════════════
  describe('GET /api/crowd/status', () => {
    it('returns crowd status without authentication', async () => {
      const res = await request(app).get('/api/crowd/status');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('marks data as simulated (isSimulated: true)', async () => {
      const res = await request(app).get('/api/crowd/status');
      expect(res.body.data.isSimulated).toBe(true);
    });

    it('returns exactly 4 stadium zones', async () => {
      const res = await request(app).get('/api/crowd/status');
      expect(res.body.data.zones).toHaveLength(4);
    });

    it('returns all four expected zone IDs', async () => {
      const res = await request(app).get('/api/crowd/status');
      const zoneIds = res.body.data.zones.map((z: any) => z.zoneId);
      expect(zoneIds).toContain('zone-north');
      expect(zoneIds).toContain('zone-south');
      expect(zoneIds).toContain('zone-east');
      expect(zoneIds).toContain('zone-west');
    });

    it('returns density percentages within valid range (0–100)', async () => {
      const res = await request(app).get('/api/crowd/status');
      for (const zone of res.body.data.zones) {
        expect(zone.avgDensityPercentage).toBeGreaterThanOrEqual(0);
        expect(zone.avgDensityPercentage).toBeLessThanOrEqual(100);
        expect(zone.maxDensityPercentage).toBeGreaterThanOrEqual(0);
        expect(zone.maxDensityPercentage).toBeLessThanOrEqual(100);
      }
    });

    it('returns valid crowd status labels on all zones', async () => {
      const valid = ['low', 'moderate', 'congested'];
      const res = await request(app).get('/api/crowd/status');
      expect(valid).toContain(res.body.data.overallStatus);
      for (const zone of res.body.data.zones) {
        expect(valid).toContain(zone.status);
      }
    });

    it('includes operationalBriefing string (AI or mock)', async () => {
      const res = await request(app).get('/api/crowd/status');
      expect(typeof res.body.data.operationalBriefing).toBe('string');
      expect(res.body.data.operationalBriefing.length).toBeGreaterThan(0);
    });

    it('includes gate-level readings within each zone', async () => {
      const res = await request(app).get('/api/crowd/status');
      for (const zone of res.body.data.zones) {
        expect(Array.isArray(zone.gates)).toBe(true);
        expect(zone.gates.length).toBeGreaterThan(0);
        for (const gate of zone.gates) {
          expect(gate).toHaveProperty('gateId');
          expect(gate).toHaveProperty('densityPercentage');
          expect(gate).toHaveProperty('queueTimeMin');
          expect(gate).toHaveProperty('status');
        }
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. FAN CONCIERGE CHAT — Multilingual AI assistant (no auth required)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /api/chat/fan', () => {
    it('responds to a basic stadium question in mock mode', async () => {
      const res = await request(app)
        .post('/api/chat/fan')
        .send({ message: 'Where is Gate A?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message.role).toBe('assistant');
      expect(typeof res.body.data.message.content).toBe('string');
    });

    it('accepts language parameter (Spanish — es)', async () => {
      const res = await request(app)
        .post('/api/chat/fan')
        .send({ message: '¿Dónde está la salida?', language: 'es' });

      expect(res.status).toBe(200);
      expect(res.body.data.message.language).toBe('es');
    });

    it('accepts accessibility mode flag', async () => {
      const res = await request(app)
        .post('/api/chat/fan')
        .send({ message: 'How do I get to my seat?', accessibilityMode: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns suggested actions for contextual quick replies', async () => {
      const res = await request(app)
        .post('/api/chat/fan')
        .send({ message: 'Where can I find food?' });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.suggestedActions)).toBe(true);
    });

    it('rejects empty message with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/chat/fan')
        .send({ message: '' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects message exceeding 1000 chars with 400', async () => {
      const res = await request(app)
        .post('/api/chat/fan')
        .send({ message: 'a'.repeat(1001) });

      expect(res.status).toBe(400);
    });

    it('rejects invalid BCP-47 language code with 400', async () => {
      const res = await request(app)
        .post('/api/chat/fan')
        .send({ message: 'Hello', language: 'invalid-lang-xyz-1234' });

      expect(res.status).toBe(400);
    });

    it('includes timestamp on the response message', async () => {
      const res = await request(app)
        .post('/api/chat/fan')
        .send({ message: 'Tell me about the stadium' });

      expect(res.status).toBe(200);
      const ts = res.body.data.message.timestamp as string;
      expect(new Date(ts).toISOString()).toBe(ts);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. OPS CHAT — Crowd-grounded assistant (volunteer/organizer only)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /api/chat/ops', () => {
    it('rejects unauthenticated requests with 401 AUTH_REQUIRED', async () => {
      const res = await request(app)
        .post('/api/chat/ops')
        .send({ message: 'Which gates are congested?' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_REQUIRED');
    });

    it('rejects fan-role users with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post('/api/chat/ops')
        .set('Authorization', `Bearer ${fanToken}`)
        .send({ message: 'Which gates are congested?' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('allows volunteer-role users to query crowd ops', async () => {
      const res = await request(app)
        .post('/api/chat/ops')
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send({ message: 'What is the crowd status?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message.role).toBe('assistant');
    });

    it('allows organizer-role users to query crowd ops', async () => {
      const res = await request(app)
        .post('/api/chat/ops')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ message: 'Which gates have the highest density?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects tampered/invalid JWT with 401', async () => {
      const res = await request(app)
        .post('/api/chat/ops')
        .set('Authorization', 'Bearer tampered.jwt.token')
        .send({ message: 'status?' });

      expect(res.status).toBe(401);
    });

    it('rejects empty ops message with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/chat/ops')
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send({ message: '' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. INCIDENT CO-PILOT — AI-powered incident management
  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /api/incidents', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app)
        .post('/api/incidents')
        .send({ rawNote: 'Medical situation at section 214', location: 'Section 214' });

      expect(res.status).toBe(401);
    });

    it('rejects fan-role users with 403', async () => {
      const res = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${fanToken}`)
        .send({ rawNote: 'Fight in the stands', location: 'Section 102' });

      expect(res.status).toBe(403);
    });

    it('creates a structured incident report for volunteer', async () => {
      const res = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send({
          rawNote: 'Fan collapsed at Gate D, appears to be heat-related.',
          location: 'Gate D, Section 201',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('title');
      expect(res.body.data).toHaveProperty('category');
      expect(res.body.data).toHaveProperty('severity');
      expect(res.body.data).toHaveProperty('radioSummary');
      expect(res.body.data).toHaveProperty('responsePlan');
    });

    it('returns valid category and severity values', async () => {
      const res = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send({
          rawNote: 'Suspicious bag left unattended near turnstile at Gate C.',
          location: 'Gate C',
        });

      expect(res.status).toBe(201);
      const validCategories = ['medical', 'security', 'crowd_control', 'infrastructure', 'general'];
      const validSeverities = ['low', 'medium', 'high', 'critical'];
      expect(validCategories).toContain(res.body.data.category);
      expect(validSeverities).toContain(res.body.data.severity);
    });

    it('allows organizer to create incidents', async () => {
      const res = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          rawNote: 'Broken turnstile at Gate A blocking fan entry.',
          location: 'Gate A',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.createdBy).toBeDefined();
    });

    it('rejects rawNote that is too short (< 10 chars)', async () => {
      const res = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send({ rawNote: 'bad', location: 'Gate A' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects missing location field', async () => {
      const res = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send({ rawNote: 'Fan collapsed at the concourse.' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. INCIDENTS LIST — Retrieve recorded incidents
  // ═══════════════════════════════════════════════════════════════════════════
  describe('GET /api/incidents', () => {
    it('rejects unauthenticated list requests with 401', async () => {
      const res = await request(app).get('/api/incidents');
      expect(res.status).toBe(401);
    });

    it('returns paginated list for organizer', async () => {
      const res = await request(app)
        .get('/api/incidents')
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('fans cannot list incidents (403)', async () => {
      const res = await request(app)
        .get('/api/incidents')
        .set('Authorization', `Bearer ${fanToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. BRIEFING GENERATOR — Volunteer shift briefings (organizer only)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /api/briefings', () => {
    it('rejects fan-role users with 403', async () => {
      const res = await request(app)
        .post('/api/briefings')
        .set('Authorization', `Bearer ${fanToken}`)
        .send({ shiftNotes: 'Match at 7pm, 60,000 expected', date: '2026-07-19' });

      expect(res.status).toBe(403);
    });

    it('generates briefing for organizer', async () => {
      const res = await request(app)
        .post('/api/briefings')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          shiftNotes: 'Match at 7pm. All gates open by 5pm. Focus on Gate C congestion.',
          date: '2026-07-19',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('content');
    });

    it('accepts targetLanguage for multilingual briefings', async () => {
      const res = await request(app)
        .post('/api/briefings')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          shiftNotes: 'Gate assignments: Zone A - volunteers 1-5',
          date: '2026-07-19',
          targetLanguage: 'fr',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('rejects empty shiftNotes with 400', async () => {
      const res = await request(app)
        .post('/api/briefings')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ shiftNotes: '', date: '2026-07-19' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. SUSTAINABILITY / TRANSPORT — Carbon footprint advisor
  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /api/sustainability/recommendations', () => {
    it('returns transport options for a fan origin (no auth required)', async () => {
      const res = await request(app)
        .post('/api/sustainability/recommendations')
        .send({ origin: 'City Centre' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns an AI summary string', async () => {
      const res = await request(app)
        .post('/api/sustainability/recommendations')
        .send({ origin: 'Downtown Hotel' });

      expect(res.status).toBe(200);
      expect(typeof res.body.data.aiSummary).toBe('string');
    });

    it('rejects missing origin field with 400', async () => {
      const res = await request(app)
        .post('/api/sustainability/recommendations')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. WAYFINDING — Smart crowd-aware directions
  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /api/crowd/wayfinding', () => {
    it('returns wayfinding directions (no auth required)', async () => {
      const res = await request(app)
        .post('/api/crowd/wayfinding')
        .send({ fromLocation: 'Gate A', toLocation: 'Section 205' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.directions).toBe('string');
    });

    it('accepts step-free accessibility flag', async () => {
      const res = await request(app)
        .post('/api/crowd/wayfinding')
        .send({ fromLocation: 'Main Entrance', toLocation: 'Section 101', preferStepFree: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects missing toLocation field with 400', async () => {
      const res = await request(app)
        .post('/api/crowd/wayfinding')
        .send({ fromLocation: 'Gate B' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. SECURITY & INFRASTRUCTURE
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Security & Infrastructure', () => {
    it('health check returns ok with aiMode: mock in tests', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.aiMode).toBe('mock');
    });

    it('unknown routes return 404 with structured error body', async () => {
      const res = await request(app).get('/api/nonexistent-endpoint');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('returns JSON Content-Type on all API responses', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['content-type']).toContain('application/json');
    });

    it('login response does not expose password hash', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'alex_fan', password: 'fan123' });
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('rejects Bearer token with wrong signature', async () => {
      const res = await request(app)
        .post('/api/chat/ops')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoib3JnYW5pemVyIn0.FAKE')
        .send({ message: 'status?' });

      expect(res.status).toBe(401);
    });

    it('rejects missing Authorization header on protected routes', async () => {
      const res = await request(app)
        .post('/api/chat/ops')
        .send({ message: 'crowd status?' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_REQUIRED');
    });
  });
});

/**
 * Test setup — configure environment variables for test runs.
 * All tests run in MOCK AI mode — no real Anthropic API calls are made.
 *
 * IMPORTANT: We explicitly delete ANTHROPIC_API_KEY after setting all vars.
 * This ensures mock mode is active even if a .env file has a placeholder key,
 * preventing accidental real API calls (and failing 401 errors) in tests.
 */

// Set required env vars BEFORE any module imports (including config.ts + dotenv)
process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = 'test-secret-key-for-testing-only-not-production';
process.env['JWT_EXPIRES_IN'] = '1h';
process.env['DATABASE_URL'] = ':memory:';
process.env['PORT'] = '3099';
process.env['CORS_ORIGIN'] = 'http://localhost:5173';
process.env['SIMULATOR_TICK_MS'] = '999999'; // Disable simulator ticks in tests

// Force mock AI mode — delete any key loaded from .env or inherited environment.
// This is the single authoritative override that guarantees no real API calls.
delete process.env['ANTHROPIC_API_KEY'];

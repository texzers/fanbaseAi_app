/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
    setupFiles: ['./src/tests/setup.ts'],
    // Force all test env vars at the Vitest runner level.
    // These are applied BEFORE any module code (including dotenv) runs,
    // ensuring deterministic test isolation regardless of local .env files.
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-key-for-testing-only-not-production',
      JWT_EXPIRES_IN: '1h',
      DATABASE_URL: ':memory:',
      PORT: '3099',
      CORS_ORIGIN: 'http://localhost:5173',
      SIMULATOR_TICK_MS: '999999',
      // Explicitly empty so isMockAiMode === true — no real API calls in tests.
      ANTHROPIC_API_KEY: '',
    },
  },
});

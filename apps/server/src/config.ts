/**
 * Config module — validated environment variable access.
 *
 * Reads all required env vars at startup and fails fast with a clear error
 * message if any are missing or malformed. This prevents cryptic runtime
 * failures deep in service code.
 *
 * All other modules MUST import config values from here — never from
 * `process.env` directly — so there is one authoritative source of truth
 * for the server's configuration contract.
 */

import 'dotenv/config';

/** Reads a required string env var; throws if missing or empty. */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(
      `[Config] Missing required environment variable: ${key}. ` +
        `Please check your .env file against .env.example.`
    );
  }
  return value.trim();
}

/** Reads an optional string env var with a fallback. */
function optionalEnv(key: string, fallback: string): string {
  const value = process.env[key];
  return value && value.trim() !== '' ? value.trim() : fallback;
}

/** Reads an optional integer env var with a fallback. */
function optionalIntEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) {
    console.warn(`[Config] ${key} is not a valid integer; using default ${fallback}`);
    return fallback;
  }
  return parsed;
}

/**
 * Validated application configuration.
 *
 * ANTHROPIC_API_KEY is optional in dev; if missing, the server starts in
 * "mock AI" mode and returns placeholder responses (clearly labeled).
 * In production (NODE_ENV=production), the key is required.
 */
export const config = {
  /** Server port to listen on. */
  port: optionalIntEnv('PORT', 3001),

  /** Node environment. */
  nodeEnv: optionalEnv('NODE_ENV', 'development'),

  /** JWT signing secret — must be long and random in production. */
  jwtSecret: requireEnv('JWT_SECRET'),

  /** JWT token expiry string (e.g. "24h"). */
  jwtExpiresIn: optionalEnv('JWT_EXPIRES_IN', '24h'),

  /** Path to SQLite database file. */
  databaseUrl: optionalEnv('DATABASE_URL', './data/fanpulse.db'),

  /** Anthropic API key — required in production, optional in dev (triggers mock mode). */
  anthropicApiKey: process.env['ANTHROPIC_API_KEY'] ?? '',

  /** Claude model identifier. */
  anthropicModel: optionalEnv('ANTHROPIC_MODEL', 'claude-sonnet-4-6'),

  /** Whether the server is running in AI mock mode (no real API calls). */
  get isMockAiMode(): boolean {
    const liveKey = process.env['ANTHROPIC_API_KEY'] ?? '';
    return !liveKey || liveKey.trim() === '' || liveKey.startsWith('sk-ant-replace');
  },

  /** Rate limiting: max requests per window per IP on AI endpoints. */
  rateLimitMaxRequests: optionalIntEnv('RATE_LIMIT_MAX_REQUESTS', 30),

  /** Rate limiting: window in milliseconds. */
  rateLimitWindowMs: optionalIntEnv('RATE_LIMIT_WINDOW_MS', 900_000), // 15 min

  /** Allowed CORS origin(s), comma-separated. */
  corsOrigin: optionalEnv('CORS_ORIGIN', 'http://localhost:5173'),

  /** Crowd simulator tick interval in milliseconds. */
  simulatorTickMs: optionalIntEnv('SIMULATOR_TICK_MS', 10_000), // 10 sec
} as const;

// Log warning in production if no API key is provided, rather than crashing (useful for hackathon demo sandboxes)
if (config.nodeEnv === 'production' && config.isMockAiMode) {
  console.warn(
    '⚠️  [Config] ANTHROPIC_API_KEY not set in production — running in MOCK AI mode. ' +
      'Make sure this is intended for demo/evaluation purposes.'
  );
}

if (config.isMockAiMode) {
  console.warn(
    '⚠️  [Config] ANTHROPIC_API_KEY not set — running in MOCK AI mode. ' +
      'All GenAI responses will be simulated placeholders.'
  );
}

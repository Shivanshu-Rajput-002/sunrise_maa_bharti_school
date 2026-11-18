/** Fail fast on boot if required env vars are missing or unsafe */
export function validateEnv(env: Record<string, unknown>) {
  const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'JWT_SECRET'];
  const missing = required.filter((k) => !env[k]);
  if (missing.length) throw new Error(`Missing required env vars: ${missing.join(', ')}`);

  const secret = String(env.JWT_SECRET);
  if (secret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');

  if (env.NODE_ENV === 'production' && env.COOKIE_SECURE !== 'true') {
    throw new Error('COOKIE_SECURE must be true in production (HTTPS)');
  }
  return env;
}

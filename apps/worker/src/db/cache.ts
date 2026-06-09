export async function getCache(db: D1Database, key: string): Promise<any | null> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const row = await db.prepare('SELECT value FROM cache WHERE key = ? AND expires_at > ?').bind(key, now).first<{ value: string }>();
    if (!row) return null;
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

export async function setCache(db: D1Database, key: string, value: any, ttlSeconds: number): Promise<void> {
  try {
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    const serialized = JSON.stringify(value);
    await db.prepare(
      'INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)'
    ).bind(key, serialized, expiresAt).run();
  } catch {
    // ignore cache write failures
  }
}

export async function initCacheTable(db: D1Database): Promise<void> {
  await db.prepare(
    'CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires_at INTEGER NOT NULL)'
  ).run();
}

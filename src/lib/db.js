import { neon } from '@neondatabase/serverless';

/**
 * Neon connection.
 *
 * The site is designed to run with or without a database: until DATABASE_URL
 * is set, the repositories in `src/server/repo.js` fall back to the seed data
 * in `src/data`. That keeps local development and previews working, and means
 * pointing at Neon is a one-line change rather than a migration.
 */

const connectionString = process.env.DATABASE_URL?.trim();

export const hasDatabase = Boolean(connectionString);

let client = null;

/** Tagged-template SQL client, or null when no DATABASE_URL is configured. */
export function getSql() {
  if (!hasDatabase) return null;
  if (!client) client = neon(connectionString);
  return client;
}

/**
 * Run a query, returning `fallback` if the database is not configured or the
 * query fails. A café site should never 500 because Postgres blinked.
 */
export async function query(run, fallback) {
  const sql = getSql();
  if (!sql) return { rows: fallback, source: 'seed' };

  try {
    const rows = await run(sql);
    return { rows, source: 'database' };
  } catch (error) {
    console.error('[binileaf] database query failed, serving seed data:', error.message);
    return { rows: fallback, source: 'seed', error: error.message };
  }
}

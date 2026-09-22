import 'server-only';
import { getSql, hasDatabase } from '@/lib/db';
import { entityGroup, notifySite } from './notify-site';

/**
 * A line in the log for every write, so "who changed the price of the chai"
 * has an answer — and the one place that tells the site to rebuild.
 *
 * Every mutation already calls this, which makes it the natural integration
 * point: one call, rather than a line to remember in thirty server actions.
 * Never throws — neither the log nor the ping may fail the edit.
 */
export async function recordChange({ actor, action, entity, entityId, detail }) {
  // The site is told first: it does not depend on the log, and the operator
  // should see their change even if the audit insert is the thing that fails.
  notifySite(entityGroup(entity));

  if (!hasDatabase) return;

  try {
    const sql = getSql();
    await sql`
      insert into audit_log (actor, action, entity, entity_id, detail)
      values (${actor ?? null}, ${action}, ${entity}, ${entityId ?? null},
              ${JSON.stringify(detail ?? {})}::jsonb)
    `;
  } catch (error) {
    console.error('[binileaf-admin] audit write failed:', error.message);
  }
}

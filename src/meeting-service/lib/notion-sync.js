import { randomUUID } from 'node:crypto';

// The Blob compare-and-swap keeps admission and the pending Notion writes in
// the same commit. Only the lease holder writes Notion records.
export function queueNotionEvent(db, event, previous) {
  const pending = db.notionPending ??= {};
  const job = pending[event.id] ??= { rows: {} };
  const { rows, ...fields } = event;
  const { rows: oldRows = [], ...oldFields } = previous ?? {};
  if (JSON.stringify(fields) !== JSON.stringify(oldFields)) job.event = randomUUID();
  const prior = new Map(oldRows.map(row => [row.id, JSON.stringify(row)]));
  for (const row of rows) {
    if (prior.get(row.id) !== JSON.stringify(row)) job.rows[row.id] = randomUUID();
  }
  if (!job.event && !Object.keys(job.rows).length) delete pending[event.id];
}

export function queueLinkedPlayer(db, uid) {
  for (const event of db.events) {
    for (const row of event.rows.filter(entry => entry.uid === uid)) {
      const pending = db.notionPending ??= {};
      const job = pending[event.id] ??= { rows: {} };
      job.rows[row.id] = randomUUID();
    }
  }
}

export async function flushNotionMeeting({ load, save, records }) {
  const initial = await load();
  const db = initial.db;
  if ((db.notionLease?.expires ?? 0) > Date.now()) return false;
  const [eventId, job] = Object.entries(db.notionPending ?? {})[0] ?? [];
  if (!job) return true;
  const lease = { id: randomUUID(), expires: Date.now() + 90000 };
  db.notionLease = lease;
  if (!await save(initial)) return false;
  const completed = { gatheringId: undefined, rows: [] };
  try {
    const event = db.events.find(entry => entry.id === eventId);
    if (!event) throw new Error('Pending event missing');
    const gathering = job.event ? undefined : await records.findGathering(eventId);
    const gatheringId = gathering?.id ?? await records.gathering(event);
    completed.gatheringId = gatheringId;
    // Keep each invocation short and preserve the remaining queue across calls.
    const rowId = Object.keys(job.rows)[0];
    if (rowId) {
      const row = event.rows.find(entry => entry.id === rowId);
      if (!row) throw new Error('Pending registration missing');
      await records.registration(row, gatheringId, row.notionPlayerId ?? db.members[row.uid]?.notionPlayerId);
      completed.rows.push(rowId);
    }
  } catch (error) {
    console.error('Meeting Notion sync deferred', error.message);
  }
  {
    for (let attempt = 0; attempt < 6; attempt++) {
      const latest = await load();
      if (latest.db.notionLease?.id !== lease.id) break;
      delete latest.db.notionLease;
      const current = latest.db.notionPending[eventId];
      if (completed.gatheringId) {
        (latest.db.notionGatherings ??= {})[eventId] = completed.gatheringId;
        if (current && current.event === job.event) delete current.event;
      }
      for (const rowId of completed.rows) {
        if (current?.rows[rowId] === job.rows[rowId]) delete current.rows[rowId];
      }
      if (current && !current.event && !Object.keys(current.rows).length) {
        delete latest.db.notionPending[eventId];
      }
      if (await save(latest)) {
        if (!Object.keys(latest.db.notionPending).length) return true;
        return completed.gatheringId && (!Object.keys(job.rows).length || completed.rows.length > 0) ? 'progress' : false;
      }
    }
  }
  return false;
}

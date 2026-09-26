import type { Table } from 'dexie';
import { db, type Expense, type Group, type Member, type QuickTitle, type RemoteTable } from './db';
import { supabase } from './supabase';

interface Spec<T> {
  remote: RemoteTable;
  table: Table<T, string>;
  toRow(record: T): Record<string, unknown>;
  fromRow(row: Record<string, any>): T;
}

const iso = (value: string) => new Date(value).toISOString();

const groupSpec: Spec<Group> = {
  remote: 'groups',
  table: db.groups,
  toRow: (g) => ({ id: g.id, name: g.name, currency: g.currency, updated_at: g.updatedAt, deleted: g.deleted }),
  fromRow: (r) => ({ id: r.id, name: r.name, currency: r.currency, updatedAt: iso(r.updated_at), deleted: r.deleted })
};

const memberSpec: Spec<Member> = {
  remote: 'members',
  table: db.members,
  toRow: (m) => ({
    id: m.id,
    group_id: m.groupId,
    name: m.name,
    auth_user_id: m.authUserId,
    phone: m.phone,
    updated_at: m.updatedAt,
    deleted: m.deleted
  }),
  fromRow: (r) => ({
    id: r.id,
    groupId: r.group_id,
    name: r.name,
    authUserId: r.auth_user_id ?? null,
    phone: r.phone ?? null,
    updatedAt: iso(r.updated_at),
    deleted: r.deleted
  })
};

const quickTitleSpec: Spec<QuickTitle> = {
  remote: 'quick_titles',
  table: db.quickTitles,
  toRow: (q) => ({ id: q.id, group_id: q.groupId, text: q.text, updated_at: q.updatedAt, deleted: q.deleted }),
  fromRow: (r) => ({ id: r.id, groupId: r.group_id, text: r.text, updatedAt: iso(r.updated_at), deleted: r.deleted })
};

const expenseSpec: Spec<Expense> = {
  remote: 'expenses',
  table: db.expenses,
  toRow: (e) => ({
    id: e.id,
    group_id: e.groupId,
    title: e.title,
    amount_ore: e.amountOre,
    date: e.date,
    paid_by: e.paidBy,
    shares: e.shares,
    is_settlement: e.isSettlement,
    updated_at: e.updatedAt,
    deleted: e.deleted
  }),
  fromRow: (r) => ({
    id: r.id,
    groupId: r.group_id,
    title: r.title,
    amountOre: Number(r.amount_ore),
    date: r.date,
    paidBy: r.paid_by,
    shares: r.shares ?? [],
    isSettlement: r.is_settlement,
    updatedAt: iso(r.updated_at),
    deleted: r.deleted
  })
};

// Parents before children: a member row is rejected until its group exists.
const specs = [groupSpec, memberSpec, quickTitleSpec, expenseSpec] as Spec<any>[];

const EPOCH = '1970-01-01T00:00:00.000Z';
const sinceKey = (remote: RemoteTable) => `clover.sync.since.${remote}`;

/** Supabase errors are plain objects, so keep the readable parts and say which step failed. */
class SyncError extends Error {
  constructor(step: string, cause: { message: string; code?: string; details?: string; hint?: string }) {
    const parts = [cause.message, cause.details, cause.hint].filter(Boolean);
    super(`${step} (${cause.code ?? 'okänd kod'}): ${parts.join(' — ')}`);
    console.error('[clover sync]', step, cause);
  }
}

export function resetSyncCursor(): void {
  for (const spec of specs) localStorage.removeItem(sinceKey(spec.remote));
}

export async function queueChange(remote: RemoteTable, id: string): Promise<void> {
  await db.outbox.put({ key: `${remote}:${id}`, table: remote, id });
}

async function pushChanges(): Promise<void> {
  const entries = await db.outbox.toArray();
  if (entries.length === 0) return;

  let failures: SyncError[] = [];

  for (const spec of specs) {
    const mine = entries.filter((e) => e.table === spec.remote);
    if (mine.length === 0) continue;

    const records = (await spec.table.bulkGet(mine.map((e) => e.id))).filter(Boolean);
    if (records.length > 0) {
      const { error } = await supabase!.from(spec.remote).upsert(records.map((r) => spec.toRow(r)));
      if (error) {
        // Keep going: a later table can grant the access the failed one was missing.
        failures.push(new SyncError(`skickar ${spec.remote}`, error));
        continue;
      }
    }
    await db.outbox.bulkDelete(mine.map((e) => e.key));
  }

  if (failures.length > 0) throw new Error(failures.map((f) => f.message).join(' | '));
}

/** Returns true when anything changed locally. */
async function pullChanges(): Promise<boolean> {
  let changed = false;

  for (const spec of specs) {
    const since = localStorage.getItem(sinceKey(spec.remote)) ?? EPOCH;
    const { data, error } = await supabase!
      .from(spec.remote)
      .select('*')
      .gt('updated_at', since)
      .order('updated_at', { ascending: true })
      .limit(1000);
    if (error) throw new SyncError(`hämtar ${spec.remote}`, error);
    if (!data || data.length === 0) continue;

    let newest = since;
    for (const row of data) {
      const record = spec.fromRow(row);
      const local = await spec.table.get(record.id);
      if (!local || Date.parse(record.updatedAt) > Date.parse(local.updatedAt)) {
        await spec.table.put(record);
        changed = true;
      }
      if (Date.parse(record.updatedAt) > Date.parse(newest)) newest = record.updatedAt;
    }
    // Step back a second so rows written in the same instant are not skipped.
    localStorage.setItem(sinceKey(spec.remote), new Date(Date.parse(newest) - 1000).toISOString());
  }

  return changed;
}

type Status = 'off' | 'idle' | 'syncing' | 'offline' | 'error';

export const syncState = $state({
  status: 'off' as Status,
  lastSyncedAt: null as string | null,
  message: ''
});

let onChanged: (() => void | Promise<void>) | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

export function onSyncChanged(callback: () => void | Promise<void>): void {
  onChanged = callback;
}

export async function syncNow(): Promise<void> {
  if (!supabase || running) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  if (!navigator.onLine) {
    syncState.status = 'offline';
    return;
  }

  running = true;
  syncState.status = 'syncing';
  try {
    await pushChanges();
    const changed = await pullChanges();
    syncState.status = 'idle';
    syncState.lastSyncedAt = new Date().toISOString();
    syncState.message = '';
    if (changed) await onChanged?.();
  } catch (error) {
    syncState.status = 'error';
    syncState.message = error instanceof Error ? error.message : String(error);
  } finally {
    running = false;
  }
}

export function startSync(intervalMs = 5000): void {
  if (!supabase || timer) return;
  syncState.status = 'idle';
  timer = setInterval(syncNow, intervalMs);
  window.addEventListener('online', syncNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncNow();
  });
  syncNow();
}

export function stopSync(): void {
  if (timer) clearInterval(timer);
  timer = null;
  window.removeEventListener('online', syncNow);
  syncState.status = 'off';
}

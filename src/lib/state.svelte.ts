import type { Table } from 'dexie';
import {
  db,
  DEFAULT_QUICK_TITLES,
  type Expense,
  type Group,
  type Member,
  type QuickTitle,
  type RemoteTable
} from './db';
import { newId, nowIso, UUID_PATTERN } from './id';
import type { Period } from './period';
import { supabase, syncConfigured } from './supabase';
import { queueChange, resetSyncCursor, startSync, stopSync, syncNow } from './sync.svelte';

const ME_KEY = 'clover.meId';
const GROUP_KEY = 'clover.groupId';

type Tab = 'expenses' | 'standings';

export const app = $state({
  ready: false,
  authReady: !syncConfigured,
  user: null as { id: string; email: string } | null,
  recovery: false,
  group: null as Group | null,
  members: [] as Member[],
  quickTitles: [] as QuickTitle[],
  expenses: [] as Expense[],
  meId: null as string | null,
  tab: 'expenses' as Tab,
  period: { preset: 'all', from: '', to: '' } as Period
});

export function memberName(id: string | null | undefined): string {
  return app.members.find((m) => m.id === id)?.name ?? 'Okänd';
}

/**
 * Older builds could create ids that are not UUIDs, which the server rejects outright.
 * Give those records a fresh id so the queued changes can finally be sent.
 */
async function rekey<T extends { id: string; updatedAt: string }>(
  name: RemoteTable,
  store: Table<T, string>
): Promise<void> {
  const broken = (await store.toArray()).filter((record) => !UUID_PATTERN.test(record.id));
  for (const record of broken) {
    await store.delete(record.id);
    await db.outbox.delete(`${name}:${record.id}`);
    const fixed = { ...record, id: newId(), updatedAt: nowIso() };
    await store.put(fixed);
    await queueChange(name, fixed.id);
  }
}

export async function start(): Promise<void> {
  await rekey('expenses', db.expenses);
  await rekey('quick_titles', db.quickTitles);
  await loadAll();
}

export async function loadAll(): Promise<void> {
  const groups = (await db.groups.toArray()).filter((g) => !g.deleted);
  const storedGroupId = localStorage.getItem(GROUP_KEY);
  const group = groups.find((g) => g.id === storedGroupId) ?? groups[0] ?? null;
  app.group = group ?? null;

  if (group) {
    localStorage.setItem(GROUP_KEY, group.id);
    const [members, quickTitles, expenses] = await Promise.all([
      db.members.where('groupId').equals(group.id).toArray(),
      db.quickTitles.where('groupId').equals(group.id).toArray(),
      db.expenses.where('groupId').equals(group.id).toArray()
    ]);
    app.members = members.filter((m) => !m.deleted).sort((a, b) => a.name.localeCompare(b.name, 'sv'));
    app.quickTitles = quickTitles.filter((q) => !q.deleted).sort((a, b) => a.text.localeCompare(b.text, 'sv'));
    app.expenses = expenses.filter((e) => !e.deleted);

    const claimed = app.user ? app.members.find((m) => m.authUserId === app.user!.id) : null;
    const storedMe = localStorage.getItem(ME_KEY);
    const meId = claimed?.id ?? (app.members.some((m) => m.id === storedMe) ? storedMe : null);
    if (meId) localStorage.setItem(ME_KEY, meId);
    app.meId = meId;
  } else {
    app.members = [];
    app.quickTitles = [];
    app.expenses = [];
    app.meId = null;
  }
  app.ready = true;
}

export function initAuth(): void {
  if (!supabase) return;
  // The recovery link lands with #type=recovery; the event fires while that is being consumed.
  if (location.hash.includes('type=recovery')) app.recovery = true;
  supabase.auth.getSession().then(({ data }) => {
    applySession(data.session?.user ?? null);
    app.authReady = true;
  });
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') app.recovery = true;
    applySession(session?.user ?? null);
  });
}

function applySession(user: { id: string; email?: string } | null): void {
  app.user = user ? { id: user.id, email: user.email ?? '' } : null;
  if (user) startSync();
  else stopSync();
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const { error } = await supabase!.auth.signInWithPassword({ email, password });
  return error ? error.message : null;
}

export async function signUp(email: string, password: string): Promise<string | null> {
  const { error } = await supabase!.auth.signUp({ email, password });
  return error ? error.message : null;
}

export async function signOut(): Promise<void> {
  await supabase!.auth.signOut();
  app.user = null;
}

export async function sendPasswordReset(email: string): Promise<string | null> {
  const redirectTo = `${location.origin}${import.meta.env.BASE_URL}`;
  const { error } = await supabase!.auth.resetPasswordForEmail(email, { redirectTo });
  return error ? error.message : null;
}

export async function updatePassword(password: string): Promise<string | null> {
  const { error } = await supabase!.auth.updateUser({ password });
  if (error) return error.message;
  app.recovery = false;
  history.replaceState(null, '', location.pathname + location.search);
  return null;
}

export interface GroupPreview {
  groupName: string;
  members: { id: string; name: string; claimed: boolean }[];
}

/** Looks up a group by its invite code (the group id) so a new phone can pick its person. */
export async function previewGroup(groupId: string): Promise<GroupPreview | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('group_preview', { p_group: groupId.trim() });
  if (error || !data || data.length === 0) return null;
  return {
    groupName: data[0].group_name,
    members: data.map((row: { member_id: string; member_name: string; claimed: boolean }) => ({
      id: row.member_id,
      name: row.member_name,
      claimed: row.claimed
    }))
  };
}

export async function joinGroup(groupId: string, memberId: string): Promise<string | null> {
  if (!supabase) return 'Synk är inte konfigurerad.';
  const { error } = await supabase.rpc('claim_member', { p_group: groupId.trim(), p_member: memberId });
  if (error) return error.message;

  resetSyncCursor();
  localStorage.setItem(GROUP_KEY, groupId.trim());
  localStorage.setItem(ME_KEY, memberId);
  await syncNow();
  await loadAll();
  return null;
}

export async function createGroup(name: string, memberNames: string[], meIndex: number): Promise<void> {
  const groupId = newId();
  const updatedAt = nowIso();
  const group: Group = { id: groupId, name, currency: 'SEK', updatedAt, deleted: false };
  const members: Member[] = memberNames.map((n, i) => ({
    id: newId(),
    groupId,
    name: n,
    authUserId: i === meIndex ? (app.user?.id ?? null) : null,
    phone: null,
    updatedAt,
    deleted: false
  }));
  const quickTitles: QuickTitle[] = DEFAULT_QUICK_TITLES.map((text) => ({
    id: newId(),
    groupId,
    text,
    updatedAt,
    deleted: false
  }));

  await db.transaction('rw', db.groups, db.members, db.quickTitles, db.outbox, async () => {
    await db.groups.put(group);
    await db.members.bulkPut(members);
    await db.quickTitles.bulkPut(quickTitles);
    await queueChange('groups', groupId);
    for (const m of members) await queueChange('members', m.id);
    for (const q of quickTitles) await queueChange('quick_titles', q.id);
  });

  localStorage.setItem(GROUP_KEY, groupId);
  localStorage.setItem(ME_KEY, members[meIndex]?.id ?? members[0].id);
  await loadAll();
  void syncNow();
}

async function put<T extends { id: string }>(
  table: 'groups' | 'members' | 'quick_titles' | 'expenses',
  store: { put(record: T): unknown },
  record: T
): Promise<void> {
  // IndexedDB cannot clone Svelte's state proxies, so store a plain copy.
  await store.put($state.snapshot(record) as T);
  await queueChange(table, record.id);
  await loadAll();
  void syncNow();
}

export async function renameGroup(name: string): Promise<void> {
  if (!app.group) return;
  await put('groups', db.groups, { ...app.group, name, updatedAt: nowIso() });
}

export async function addMember(name: string): Promise<void> {
  if (!app.group) return;
  await put('members', db.members, {
    id: newId(),
    groupId: app.group.id,
    name,
    authUserId: null,
    phone: null,
    updatedAt: nowIso(),
    deleted: false
  });
}

export async function renameMember(id: string, name: string): Promise<void> {
  const member = app.members.find((m) => m.id === id);
  if (!member) return;
  await put('members', db.members, { ...member, name, updatedAt: nowIso() });
}

export async function setPhone(id: string, phone: string): Promise<void> {
  const member = app.members.find((m) => m.id === id);
  if (!member) return;
  const trimmed = phone.trim();
  if ((member.phone ?? '') === trimmed) return;
  await put('members', db.members, { ...member, phone: trimmed || null, updatedAt: nowIso() });
}

export function setMe(id: string): void {
  localStorage.setItem(ME_KEY, id);
  app.meId = id;
}

export async function addQuickTitle(text: string): Promise<boolean> {
  if (!app.group) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (app.quickTitles.some((q) => q.text.toLowerCase() === trimmed.toLowerCase())) return false;
  await put('quick_titles', db.quickTitles, {
    id: newId(),
    groupId: app.group.id,
    text: trimmed,
    updatedAt: nowIso(),
    deleted: false
  });
  return true;
}

export async function removeQuickTitle(id: string): Promise<void> {
  const title = app.quickTitles.find((q) => q.id === id);
  if (!title) return;
  await put('quick_titles', db.quickTitles, { ...title, deleted: true, updatedAt: nowIso() });
}

export async function saveExpense(expense: Expense): Promise<void> {
  await put('expenses', db.expenses, { ...expense, updatedAt: nowIso() });
}

export async function deleteExpense(id: string): Promise<void> {
  const expense = app.expenses.find((e) => e.id === id);
  if (!expense) return;
  await put('expenses', db.expenses, { ...expense, deleted: true, updatedAt: nowIso() });
}

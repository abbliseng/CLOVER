import Dexie, { type Table } from 'dexie';
import { DEFAULT_TAGS, iconForTag, tagIdFor } from './tags';

/** Every record carries groupId and sync fields (updatedAt, deleted) so a server sync can be added later. */
export interface Group {
  id: string;
  name: string;
  currency: string;
  updatedAt: string;
  deleted: boolean;
}

export interface Member {
  id: string;
  groupId: string;
  name: string;
  authUserId: string | null;
  phone: string | null;
  updatedAt: string;
  deleted: boolean;
}

export interface QuickTitle {
  id: string;
  groupId: string;
  text: string;
  updatedAt: string;
  deleted: boolean;
}

export interface Tag {
  id: string;
  groupId: string;
  text: string;
  icon: string;
  updatedAt: string;
  deleted: boolean;
}

export interface Share {
  memberId: string;
  /** Percent of the expense, 0–100. */
  percent: number;
}

export interface Expense {
  id: string;
  groupId: string;
  title: string;
  tagId: string | null;
  /** Whole öre, 1 kr = 100 öre. */
  amountOre: number;
  /** yyyy-mm-dd */
  date: string;
  paidBy: string;
  shares: Share[];
  isSettlement: boolean;
  updatedAt: string;
  deleted: boolean;
}

export type RemoteTable = 'groups' | 'members' | 'quick_titles' | 'tags' | 'expenses';

/** A local change waiting to be pushed to the server. */
export interface OutboxEntry {
  key: string;
  table: RemoteTable;
  id: string;
}

class CloverDb extends Dexie {
  groups!: Table<Group, string>;
  members!: Table<Member, string>;
  quickTitles!: Table<QuickTitle, string>;
  tags!: Table<Tag, string>;
  expenses!: Table<Expense, string>;
  outbox!: Table<OutboxEntry, string>;

  constructor() {
    super('clover');
    this.version(1).stores({
      groups: 'id, updatedAt',
      members: 'id, groupId, updatedAt',
      quickTitles: 'id, groupId, updatedAt',
      expenses: 'id, groupId, date, updatedAt'
    });
    this.version(2).stores({
      outbox: 'key, table'
    });
    this.version(3)
      .stores({
        groups: 'id, updatedAt',
        members: 'id, groupId, updatedAt',
        quickTitles: 'id, groupId, updatedAt',
        tags: 'id, groupId, updatedAt',
        expenses: 'id, groupId, tagId, date, updatedAt',
        outbox: 'key, table'
      })
      .upgrade(async (transaction) => {
        const groups = await transaction.table('groups').toArray();
        const expenses = await transaction.table('expenses').toArray();
        const tags = new Map<string, Tag>();
        const updatedAt = new Date().toISOString();

        for (const group of groups) {
          for (const seed of DEFAULT_TAGS) {
            const id = tagIdFor(group.id, seed.text);
            tags.set(id, { id, groupId: group.id, ...seed, updatedAt, deleted: false });
          }
        }

        for (const expense of expenses) {
          if (expense.deleted || expense.isSettlement || expense.tagId) continue;
          const text = String(expense.title ?? '').trim() || 'Övrigt';
          const id = tagIdFor(expense.groupId, text);
          if (!tags.has(id)) {
            tags.set(id, {
              id,
              groupId: expense.groupId,
              text,
              icon: iconForTag(text),
              updatedAt,
              deleted: false
            });
          }
          expense.tagId = id;
          expense.updatedAt = updatedAt;
          await transaction.table('expenses').put(expense);
          await transaction.table('outbox').put({ key: `expenses:${expense.id}`, table: 'expenses', id: expense.id });
        }

        for (const tag of tags.values()) {
          await transaction.table('tags').put(tag);
          await transaction.table('outbox').put({ key: `tags:${tag.id}`, table: 'tags', id: tag.id });
        }
      });
  }
}

export const db = new CloverDb();

export const DEFAULT_QUICK_TITLES = ['Mat', 'Hyra', 'El'];

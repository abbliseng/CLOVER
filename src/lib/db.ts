import Dexie, { type Table } from 'dexie';

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

export interface Share {
  memberId: string;
  /** Percent of the expense, 0–100. */
  percent: number;
}

export interface Expense {
  id: string;
  groupId: string;
  title: string;
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

export type RemoteTable = 'groups' | 'members' | 'quick_titles' | 'expenses';

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
  }
}

export const db = new CloverDb();

export const DEFAULT_QUICK_TITLES = ['Mat', 'Hyra', 'El'];

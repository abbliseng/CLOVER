export type PeriodPreset = 'all' | 'month' | 'quarter' | 'year' | 'custom';

export interface Period {
  preset: PeriodPreset;
  /** yyyy-mm-dd, only used by the custom preset. An empty string means open-ended. */
  from: string;
  to: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const day = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Inclusive range as yyyy-mm-dd strings; null means unbounded. */
export function rangeOf(period: Period, today = new Date()): { from: string | null; to: string | null } {
  const year = today.getFullYear();
  const month = today.getMonth();

  switch (period.preset) {
    case 'month':
      return { from: day(new Date(year, month, 1)), to: day(new Date(year, month + 1, 0)) };
    case 'quarter':
      return { from: day(new Date(year, month - 2, 1)), to: day(new Date(year, month + 1, 0)) };
    case 'year':
      return { from: `${year}-01-01`, to: `${year}-12-31` };
    case 'custom':
      return { from: period.from || null, to: period.to || null };
    default:
      return { from: null, to: null };
  }
}

export function withinPeriod(date: string, period: Period, today = new Date()): boolean {
  const { from, to } = rangeOf(period, today);
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export function periodLabel(period: Period, today = new Date()): string {
  switch (period.preset) {
    case 'month':
      return 'Denna månad';
    case 'quarter':
      return 'Senaste 3 mån';
    case 'year':
      return String(today.getFullYear());
    case 'custom': {
      const { from, to } = rangeOf(period, today);
      if (!from && !to) return 'Egen period';
      return `${from ?? '…'} – ${to ?? '…'}`;
    }
    default:
      return 'Denna månad';
  }
}

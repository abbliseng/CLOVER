const kr = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "1 234,50 kr" */
export function formatOre(ore: number, unit = true): string {
  const text = kr.format(Math.abs(ore) / 100);
  return unit ? `${text} kr` : text;
}

/** "+1 234,50 kr", "-1 234,50 kr" or "jämnt". */
export function formatSignedOre(ore: number, evenLabel = 'ca$h money gang sleyy'): string {
  if (ore === 0) return evenLabel;
  return `${ore > 0 ? '+' : '-'}${formatOre(ore)}`;
}

/** Plain number for the clipboard, e.g. "1234,50" or "1234" — no unit, no grouping. */
export function clipboardAmount(ore: number): string {
  const abs = Math.abs(ore);
  const whole = Math.trunc(abs / 100);
  const rest = abs % 100;
  return rest === 0 ? String(whole) : `${whole},${String(rest).padStart(2, '0')}`;
}

/**
 * Swish payment links, per "Create QR code from specification" in the Swish docs:
 * https://app.swish.nu/1/p/sw/?sw=<number>&amt=<amount>&msg=<message>&edit=<fields>
 * Opening this on a phone with Swish installed pre-fills the payment form.
 */
const ALLOWED_MESSAGE = /[^0-9A-Za-zÅÄÖåäö !?(),.:;-]/g;

/** Swish accepts a limited character set and at most 50 characters. */
export function swishMessage(text: string): string {
  return text.replace(ALLOWED_MESSAGE, ' ').replace(/\s+/g, ' ').trim().slice(0, 50);
}

/** Digits only, so "070-123 45 67" and "+46 70 123 45 67" both work. */
export function swishNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('46') ? `0${digits.slice(2)}` : digits;
}

export function swishLink(phone: string, amountOre: number, message = ''): string | null {
  const number = swishNumber(phone);
  if (number.length < 6 || amountOre <= 0) return null;

  const text = swishMessage(message);
  const params = [`sw=${number}`, `amt=${(amountOre / 100).toFixed(2)}`];
  if (text) params.push(`msg=${encodeURIComponent(text)}`);
  // Without edit the pre-filled fields are locked in the Swish app.
  params.push(`edit=${text ? 'amt,msg' : 'amt'}`);

  return `https://app.swish.nu/1/p/sw/?${params.join('&')}`;
}

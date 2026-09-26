/**
 * Swish payment link. The documented app switch (swish://paymentrequest) needs a merchant
 * token, so this uses the universal link behind Swish payment links/QR codes instead.
 * Unofficial: if it ever stops working the copy buttons still do the job.
 */
const ALLOWED_MESSAGE = /[^0-9A-Za-zÅÄÖåäö !?(),.:;-]/g;

export function swishMessage(text: string): string {
  return text.replace(ALLOWED_MESSAGE, ' ').replace(/\s+/g, ' ').trim().slice(0, 50);
}

/** Digits only, so "070-123 45 67" and "+46 70 123 45 67" both work. */
export function swishNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('46') ? `0${digits.slice(2)}` : digits;
}

export function swishLink(phone: string, amountOre: number, message: string): string | null {
  const number = swishNumber(phone);
  if (number.length < 6) return null;

  const params = new URLSearchParams({
    sw: number,
    amt: (amountOre / 100).toFixed(2),
    cur: 'SEK',
    src: 'qr',
    edit: 'amt,msg'
  });
  const text = swishMessage(message);
  if (text) params.set('msg', text);

  return `https://app.swish.nu/1/p/?${params.toString()}`;
}

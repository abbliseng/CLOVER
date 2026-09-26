/**
 * Swish cannot be pre-filled from a link: that needs a payment-request token from the
 * Commerce API, which requires a merchant agreement. This link only opens the app
 * (and shows a download page when it is missing), so the number and the amount are
 * offered as one-tap copies instead.
 */
export const SWISH_APP_URL = 'https://app.swish.nu/1/p/';

/** Digits only, so "070-123 45 67" and "+46 70 123 45 67" both paste cleanly. */
export function swishNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('46') ? `0${digits.slice(2)}` : digits;
}

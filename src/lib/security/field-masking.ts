/** Pure display-formatting helpers for sensitive identifiers. No crypto — safe to import anywhere. */

export function maskPan(pan: string): string {
  if (pan.length !== 10) return "•".repeat(pan.length);
  return `XXXXX${pan.slice(5)}`;
}

export function maskAadhaar(aadhaar: string): string {
  const digits = aadhaar.replace(/\s+/g, "");
  if (digits.length !== 12) return "•".repeat(digits.length);
  return `XXXX XXXX ${digits.slice(-4)}`;
}

export function maskBankAccount(accountNumber: string): string {
  if (accountNumber.length <= 4) return "X".repeat(accountNumber.length);
  return `${"X".repeat(accountNumber.length - 4)}${accountNumber.slice(-4)}`;
}

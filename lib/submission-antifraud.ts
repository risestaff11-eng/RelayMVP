export function normalizeContactEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function normalizeContactPhone(value: unknown) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 10) digits = `7${digits}`;
  if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  return digits;
}

export function duplicateCutoff(days = 180) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

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

export function isSelfReferral(contact: { email?: unknown; phone?: unknown }, identities: Array<{ email?: unknown; phone?: unknown }>) {
  const email = normalizeContactEmail(contact.email);
  const phone = normalizeContactPhone(contact.phone);
  return identities.some((identity) =>
    (email !== "" && email === normalizeContactEmail(identity.email)) ||
    (phone.length >= 7 && phone === normalizeContactPhone(identity.phone)),
  );
}

export const SELF_REFERRAL_MESSAGE = "Нельзя указать собственный контакт как нового клиента. Укажите контакт клиента, которого вы рекомендуете.";

export function hasHoneypotValue(value: unknown) {
  return typeof value === "string" ? value.trim().length > 0 : value != null;
}

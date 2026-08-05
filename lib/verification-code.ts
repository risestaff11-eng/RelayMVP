export async function hashVerificationCode(partnerId: string, channel: string, code: string) {
  const bytes = new TextEncoder().encode(`${partnerId}:${channel}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createVerificationCode() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(100000 + (values[0] % 900000));
}

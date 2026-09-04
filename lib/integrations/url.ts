const privateHostPatterns = [
  /^localhost$/,
  /\.localhost$/,
  /\.local$/,
  /^0\.0\.0\.0$/,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^::1$/,
  /^f[cd][0-9a-f:]+$/i,
  /^fe[89ab][0-9a-f:]+$/i,
];

export function normalizeWebhookUrl(value: unknown) {
  const url = new URL(String(value ?? "").trim());
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (url.protocol !== "https:") throw new Error("Webhook должен использовать HTTPS");
  if (url.username || url.password) throw new Error("Логин и пароль нельзя передавать в адресе webhook");
  if (privateHostPatterns.some((pattern) => pattern.test(host))) throw new Error("Webhook должен вести на публичный адрес");
  if (host === "risestaff.kz" || host.endsWith(".risestaff.kz")) {
    throw new Error("Webhook не может вести обратно в RiseStaff");
  }
  url.hash = "";
  return url.toString();
}

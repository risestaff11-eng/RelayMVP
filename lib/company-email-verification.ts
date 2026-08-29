import { env } from "cloudflare:workers";
import { createVerificationCode, hashVerificationCode } from "./verification-code";

const CODE_TTL_MS = 10 * 60 * 1000;

type EmailRuntime = {
  RESEND_API_KEY?: string;
  MAGIC_FROM_EMAIL?: string;
};

export function createCompanyEmailCode() {
  return createVerificationCode();
}

export function companyEmailCodeExpiresAt(now = new Date()) {
  return new Date(now.getTime() + CODE_TTL_MS).toISOString();
}

export async function hashCompanyEmailCode(userId: string, code: string) {
  return hashVerificationCode(userId, "COMPANY_EMAIL", code);
}

export async function sendCompanyEmailCode(destination: string, code: string) {
  const runtime = env as unknown as EmailRuntime;
  if (!runtime.RESEND_API_KEY || !runtime.MAGIC_FROM_EMAIL) {
    throw new Error("Отправка email-кодов пока не подключена");
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${runtime.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: runtime.MAGIC_FROM_EMAIL,
      to: [destination],
      subject: "Код активации кабинета Relay",
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px;color:#11120f"><div style="font-size:18px;font-weight:800">Relay</div><h1 style="font-size:24px;margin:28px 0 10px">Подтвердите почту</h1><p style="font-size:15px;line-height:1.55">Введите этот код на странице регистрации:</p><div style="margin:22px 0;padding:18px;border-radius:14px;background:#c1ff36;font-size:32px;font-weight:900;letter-spacing:8px;text-align:center">${code}</div><p style="font-size:13px;line-height:1.55;color:#5f6359">Код действует 10 минут. Если вы не регистрировались в Relay, просто проигнорируйте письмо.</p></div>`,
    }),
  });
  if (!response.ok) throw new Error("Не удалось отправить код на email");
}

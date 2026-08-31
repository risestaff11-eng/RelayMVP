import { env } from "cloudflare:workers";

type EmailRuntime = { RESEND_API_KEY?: string; MAGIC_FROM_EMAIL?: string; ADMIN_NOTIFY_EMAIL?: string };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character] ?? character));
}

async function sendEmail(payload: { to: string; subject: string; html: string }) {
  const runtime = env as unknown as EmailRuntime;
  if (!runtime.RESEND_API_KEY || !runtime.MAGIC_FROM_EMAIL) throw new Error("Отправка писем временно недоступна");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${runtime.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: runtime.MAGIC_FROM_EMAIL, to: [payload.to], subject: payload.subject, html: payload.html }),
  });
  if (!response.ok) throw new Error("Не удалось отправить письмо");
}

export async function sendAgentLoginCode(email: string, code: string) {
  await sendEmail({
    to: email,
    subject: "Код входа агента Yaler",
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px;color:#11120f"><b style="font-size:18px">Yaler</b><h1 style="font-size:24px;margin:28px 0 10px">Вход в кабинет агента</h1><p>Введите код на странице входа:</p><div style="margin:22px 0;padding:18px;border-radius:14px;background:#c1ff36;font-size:32px;font-weight:900;letter-spacing:8px;text-align:center">${code}</div><p style="font-size:13px;color:#5f6359">Код действует 10 минут. Никому его не сообщайте.</p></div>`,
  });
}

export async function sendAgentApplicationNotification(application: { name: string; email: string; phone: string; city: string; industries: string[]; experience: string; network: string; preferredTypes: string[]; availability: string; comment: string }) {
  const runtime = env as unknown as EmailRuntime;
  const destination = runtime.ADMIN_NOTIFY_EMAIL?.trim() || "rtarzhakayev@gmail.com";
  const rows = [
    ["Имя", application.name], ["Email", application.email], ["Телефон", application.phone], ["Город", application.city],
    ["Сферы", application.industries.join(", ")], ["Опыт", application.experience], ["Контакты и окружение", application.network],
    ["Интересующие задания", application.preferredTypes.join(", ")], ["Доступность", application.availability], ["Комментарий", application.comment],
  ].map(([label, value]) => `<tr><td style="padding:8px 12px;color:#666;vertical-align:top">${escapeHtml(label)}</td><td style="padding:8px 12px;font-weight:600">${escapeHtml(value || "—")}</td></tr>`).join("");
  await sendEmail({ to: destination, subject: "Новый агент", html: `<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;padding:28px;color:#11120f"><b style="font-size:18px">Yaler</b><h1>Новая заявка агента</h1><table style="width:100%;border-collapse:collapse">${rows}</table><p style="margin-top:24px"><a href="https://company.risestaff.kz/system/users" style="display:inline-block;background:#11120f;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none">Открыть админку</a></p></div>` });
}


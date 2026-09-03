import { env } from "cloudflare:workers";

type EmailRuntime = { RESEND_API_KEY?: string; MAGIC_FROM_EMAIL?: string; ADMIN_NOTIFY_EMAIL?: string };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character] ?? character));
}

class EmailDeliveryError extends Error {
  constructor(readonly status: number, readonly retryAfterMs: number) { super("Не удалось отправить письмо"); }
}

async function sendEmail(payload: { to: string; subject: string; html: string; text?: string; timeoutMs?: number; idempotencyKey?: string; retryOnce?: boolean }) {
  const runtime = env as unknown as EmailRuntime;
  if (!runtime.RESEND_API_KEY || !runtime.MAGIC_FROM_EMAIL) throw new Error("Отправка писем временно недоступна");
  const body = JSON.stringify({ from: runtime.MAGIC_FROM_EMAIL, to: [payload.to], subject: payload.subject, html: payload.html, ...(payload.text ? { text: payload.text } : {}) });
  const attempts = payload.retryOnce && payload.idempotencyKey ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        ...(payload.timeoutMs ? { signal: AbortSignal.timeout(payload.timeoutMs) } : {}),
        headers: { authorization: `Bearer ${runtime.RESEND_API_KEY}`, "content-type": "application/json", ...(payload.idempotencyKey ? { "Idempotency-Key": payload.idempotencyKey } : {}) },
        body,
      });
      if (response.ok) return;
      const retryAfter = response.headers.get("retry-after");
      const retryAfterMs = retryAfter === null ? 500 : /^\d+(\.\d+)?$/.test(retryAfter) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now();
      throw new EmailDeliveryError(response.status, Number.isFinite(retryAfterMs) ? Math.max(500, retryAfterMs) : 500);
    } catch (error) {
      const transient = !(error instanceof EmailDeliveryError) || error.status === 429 || error.status >= 500;
      const delay = error instanceof EmailDeliveryError ? error.retryAfterMs : 500;
      // Never retry without the same provider idempotency key/body. Long outages
      // need an outbox; don't hold the agent's successful submission indefinitely.
      if (!transient || attempt + 1 >= attempts || delay > 2000) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export async function sendAgentLoginCode(email: string, code: string) {
  await sendEmail({
    to: email,
    subject: "Код входа агента RiseStaff",
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px;color:#11120f"><b style="font-size:18px">RiseStaff</b><h1 style="font-size:24px;margin:28px 0 10px">Вход в кабинет агента</h1><p>Введите код на странице входа:</p><div style="margin:22px 0;padding:18px;border-radius:14px;background:#c1ff36;font-size:32px;font-weight:900;letter-spacing:8px;text-align:center">${code}</div><p style="font-size:13px;color:#5f6359">Код действует 10 минут. Никому его не сообщайте.</p></div>`,
  });
}

export async function sendAgentWorkUpdate(input: { destination: string; companyName: string; updates: string[] }) {
  await sendEmail({
    to: input.destination,
    timeoutMs: 5000,
    subject: `Обновление заявки или выплаты · ${input.companyName}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:28px;color:#11120f"><b>RiseStaff</b><h1 style="font-size:24px">Есть новости от компании</h1><p>${escapeHtml(input.companyName)}</p><ul>${input.updates.map((update) => `<li style="margin:14px 0">${escapeHtml(update)}</li>`).join("")}</ul><p><a href="https://agents.risestaff.kz/agent-login">Открыть кабинет агента</a></p><p>Войдите через email и выберите эту компанию. Детали заявки и выплаты доступны в кабинете.</p></div>`,
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
  await sendEmail({ to: destination, subject: "Новый агент", html: `<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;padding:28px;color:#11120f"><b style="font-size:18px">RiseStaff</b><h1>Новая заявка агента</h1><table style="width:100%;border-collapse:collapse">${rows}</table><p style="margin-top:24px"><a href="https://company.risestaff.kz/system/users" style="display:inline-block;background:#11120f;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none">Открыть админку</a></p></div>` });
}

export async function sendCompanyApplicationNotification(application: { name: string; company: string; email: string; phone: string; comment: string }) {
  const destination = (env as unknown as EmailRuntime).ADMIN_NOTIFY_EMAIL?.trim();
  if (!destination) throw new Error("Не настроен адрес для уведомлений о заявках компаний");
  const rows = [
    ["Имя", application.name],
    ["Компания", application.company],
    ["Email", application.email],
    ["Телефон", application.phone],
    ["Кого хотят привлекать", application.comment],
  ].map(([label, value]) => `<tr><td style="padding:9px 12px;color:#666;vertical-align:top">${escapeHtml(label)}</td><td style="padding:9px 12px;font-weight:600">${escapeHtml(value || "—")}</td></tr>`).join("");

  await sendEmail({
    to: destination,
    subject: "Новая компания",
    html: `<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;padding:28px;color:#11120f"><b style="font-size:18px">RiseStaff</b><h1 style="font-size:25px;margin:26px 0 12px">Новая заявка компании</h1><table style="width:100%;border-collapse:collapse">${rows}</table><p style="margin-top:24px"><a href="https://company.risestaff.kz/system/users" style="display:inline-block;background:#11120f;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none">Открыть админку</a></p></div>`,
  });
}

export async function sendCompanyNewSubmissionNotification(input: { destination: string; companyName: string; agentName: string; missionTitle: string; programName: string; contactName: string; contactCompany: string; submissionId: string; type: string }) {
  const reviewUrl = `https://company.risestaff.kz/auth?returnTo=${encodeURIComponent(`/dashboard/crm?submission=${encodeURIComponent(input.submissionId)}`)}`;
  const isLead = ["LEAD", "DEAL"].includes(input.type);
  const title = isLead ? "Новый лид от агента" : "Новый результат от агента";
  const contact = input.contactCompany ? `${input.contactName || "Новый контакт"} · ${input.contactCompany}` : input.contactName || "Новый результат";
  const rows = [["Компания", input.companyName], ["Агент", input.agentName], ["Программа", input.programName], ["Задание", input.missionTitle], [isLead ? "Клиент" : "Контакт", contact]];
  const accessNote = "Для просмотра войдите в кабинет компании по email и паролю. Ссылка откроет именно эту заявку.";
  await sendEmail({
    to: input.destination,
    timeoutMs: 4000,
    retryOnce: true,
    // Resend deduplicates this event for 24 hours, including uncertain timeouts.
    // https://resend.com/docs/dashboard/emails/idempotency-keys
    idempotencyKey: `company-new-submission/${input.submissionId}`,
    subject: `${title} · ${input.programName.replace(/[\r\n]+/g, " ").slice(0, 120)}`,
    text: `${title}\n\nЗаявка сохранена и ждёт проверки.\n${rows.map(([label, value]) => `${label}: ${value || "—"}`).join("\n")}\n\nОткрыть заявку в CRM: ${reviewUrl}\n\n${accessNote}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:24px;color:#11120f;line-height:1.5"><b style="font-size:18px">RiseStaff</b><h1 style="font-size:24px;margin:26px 0 10px">${title}</h1><p>Заявка сохранена и ждёт проверки.</p><table style="width:100%;border-collapse:collapse;margin:20px 0">${rows.map(([label, value]) => `<tr><th align="left" style="padding:9px 12px 9px 0;color:#666;vertical-align:top;font-weight:400">${label}</th><td style="padding:9px 0;font-weight:600;word-break:break-word">${escapeHtml(value || "—")}</td></tr>`).join("")}</table><a href="${escapeHtml(reviewUrl)}" style="display:inline-block;background:#11120f;color:#fff;padding:14px 20px;border-radius:11px;text-decoration:none;font-weight:700">Открыть заявку в CRM →</a><p style="margin-top:18px;font-size:13px;color:#666">${accessNote}</p></div>`,
  });
}

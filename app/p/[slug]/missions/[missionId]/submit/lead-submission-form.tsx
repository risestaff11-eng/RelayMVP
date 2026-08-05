"use client";

import { useState } from "react";
import { SafeLink as Link } from "@/app/safe-link";

export function LeadSubmissionForm({ programSlug, missionId }: { programSlug: string; missionId: string }) {
  const [pending, setPending] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ trackingUrl: string; emailSent: boolean } | null>(null);

  async function checkDuplicate(event: React.FocusEvent<HTMLInputElement>) {
    const form = event.currentTarget.form;
    if (!form || !event.currentTarget.value.trim()) return;
    const values = new FormData(form);
    const response = await fetch("/api/public/submissions/duplicate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ programSlug, contactEmail: values.get("contactEmail"), contactPhone: values.get("contactPhone") }) });
    const data = await response.json() as { duplicate?: boolean };
    setDuplicate(Boolean(data.duplicate));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    form.set("programSlug", programSlug);
    form.set("missionId", missionId);
    try {
      const response = await fetch("/api/public/submissions", { method: "POST", body: form });
      const data = await response.json() as { trackingUrl?: string; emailSent?: boolean; error?: string };
      if (!response.ok || !data.trackingUrl) throw new Error(data.error || "Не удалось отправить рекомендацию");
      setResult({ trackingUrl: data.trackingUrl, emailSent: Boolean(data.emailSent) });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось отправить рекомендацию");
      setPending(false);
    }
  }

  async function copyLink() {
    if (result) await navigator.clipboard.writeText(result.trackingUrl);
  }

  if (result) return <section className="partner-submit-success"><span>✓</span><h2>Рекомендация зафиксирована</h2><p>Дата, миссия и владелец лида сохранены. Статус уже доступен в защищённом кабинете.</p><div className="magic-link-box"><small>ПЕРСОНАЛЬНАЯ ССЫЛКА · 90 ДНЕЙ</small><code>{result.trackingUrl}</code><button type="button" onClick={copyLink}>Скопировать ссылку</button></div><p className="delivery-note">{result.emailSent ? "Ссылка также отправлена на указанный email." : "Сохраните ссылку сейчас. Автоматическая email-доставка появится после подключения почтового домена."}</p><Link className="button button-primary" href={result.trackingUrl}>Открыть кабинет партнёра <span>→</span></Link></section>;

  return <form className="lead-submission-form" onSubmit={submit}>
    <section className="partner-form-section"><div><span>01</span><h2>Кто передаёт рекомендацию</h2></div><div className="partner-form-grid"><label><span>Ваше имя</span><input name="partnerName" required minLength={2} /></label><label><span>Ваш email</span><input name="partnerEmail" type="email" required /></label></div></section>
    <section className="partner-form-section"><div><span>02</span><h2>Данные потенциального клиента</h2></div><div className="partner-form-grid"><label><span>Имя</span><input name="contactName" required minLength={2} /></label><label><span>Компания</span><input name="contactCompany" required minLength={2} /></label><label><span>Рабочий email</span><input name="contactEmail" type="email" onBlur={checkDuplicate} /></label><label><span>Телефон</span><input name="contactPhone" inputMode="tel" onBlur={checkDuplicate} /></label></div>{duplicate && <div className="duplicate-warning" role="alert"><strong>Возможный дубликат</strong><p>Этот контакт уже закреплён в программе. Полные данные и имя другого партнёра не раскрываются.</p></div>}</section>
    <section className="partner-form-section"><div><span>03</span><h2>Контекст и подтверждения</h2></div><div className="partner-form-stack"><label><span>Комментарий компании</span><textarea name="partnerComment" rows={5} placeholder="Почему контакт подходит и о чём уже договорились" /></label><label><span>Ссылки</span><textarea name="externalLinks" rows={3} placeholder="Сайт, профиль, переписка или документ — по одной ссылке в строке" /></label><label className="file-drop"><span>Файлы</span><input name="files" type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" /><small>До 3 файлов, каждый до 10 МБ</small></label></div></section>
    <p className="privacy-note">Передавая контакт, вы подтверждаете корректность данных. Relay фиксирует дату и владельца рекомендации; компания увидит контакт только после отправки.</p>
    {error && <div className="inline-notice error" role="alert">{error}</div>}
    <button className="button button-primary partner-submit-button" disabled={pending || duplicate} type="submit">{pending ? "Фиксируем рекомендацию…" : duplicate ? "Контакт уже зарегистрирован" : "Подтвердить и передать лид"}<span>→</span></button>
  </form>;
}

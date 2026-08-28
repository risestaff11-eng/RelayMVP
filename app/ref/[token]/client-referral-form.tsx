"use client";

import { useState } from "react";

export function ClientReferralForm({ referralToken }: { referralToken: string }) {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/public/referrals/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ referralToken, name: form.get("name"), contact: form.get("contact"), comment: form.get("comment") }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось отправить контакт");
      setSent(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось отправить контакт"); }
    finally { setPending(false); }
  }

  if (sent) return <section className="client-referral-success"><span>✓</span><h2>Контакт передан</h2><p>Компания получила ваш запрос и увидит, от какого агента пришла рекомендация.</p></section>;
  return <form className="client-referral-form" onSubmit={submit}>
    <label><span>Ваше имя *</span><input name="name" required autoComplete="name" maxLength={120} placeholder="Как к вам обращаться" /></label>
    <label><span>Телефон или email *</span><input name="contact" required autoComplete="tel" inputMode="text" maxLength={160} placeholder="+7 700 000 00 00 или name@mail.kz" /></label>
    <label><span>Комментарий</span><textarea name="comment" rows={4} maxLength={1200} placeholder="Коротко опишите, что вас интересует" /></label>
    <p>Нажимая кнопку, вы передаёте эти данные компании для связи по вашему запросу.</p>
    {error && <div className="inline-notice error" role="alert">{error}</div>}
    <button className="button button-primary" type="submit" disabled={pending}>{pending ? "Передаём…" : "Передать контакт"}<span>→</span></button>
  </form>;
}

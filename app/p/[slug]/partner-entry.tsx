"use client";

import { useState } from "react";

export function PartnerEntry({ programSlug, companyName, programName, reward }: { programSlug: string; companyName: string; programName: string; reward: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch("/api/public/partners/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...values, programSlug }) });
      const data = await response.json() as { missionsUrl?: string; error?: string };
      if (!response.ok || !data.missionsUrl) throw new Error(data.error || "Не удалось открыть программу");
      window.location.assign(data.missionsUrl);
    } catch (reason) { setPending(false); setError(reason instanceof Error ? reason.message : "Не удалось продолжить"); }
  }
  return <main className="partner-entry-page"><div className="partner-entry-brand"><span className="brand-mark">R</span><span>Relay</span></div><section className="partner-entry-card"><div className="partner-entry-step"><span>ШАГ 1 ИЗ 2</span><i><b /></i></div><div className="partner-entry-company"><small>ПАРТНЁРСКАЯ ПРОГРАММА</small><strong>{companyName}</strong></div><h1>Откройте доступ к миссиям</h1><p>{programName}. После короткого знакомства вы увидите, кого искать, условия и вознаграждение.</p><div className="partner-entry-reward"><small>ВОЗНАГРАЖДЕНИЕ ДО</small><strong>{reward}</strong></div><form onSubmit={submit}><label><span>Имя и фамилия</span><input name="name" required minLength={2} autoComplete="name" placeholder="Алексей Петров" /></label><label><span>Email</span><input name="email" required type="email" autoComplete="email" placeholder="alex@example.com" /></label><label><span>Номер телефона</span><input name="phone" required type="tel" autoComplete="tel" minLength={7} placeholder="+7 700 000 00 00" /></label>{error && <div className="inline-notice error" role="alert">{error}</div>}<button className="button button-primary" disabled={pending} type="submit">{pending ? "Открываем программу…" : "Продолжить к миссиям"}<span>→</span></button></form><small className="partner-entry-note">Регистрация не создаёт пароль. Защищённая ссылка на кабинет действует 90 дней.</small></section></main>;
}

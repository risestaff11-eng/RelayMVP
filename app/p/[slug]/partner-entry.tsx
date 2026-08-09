"use client";

import { useState } from "react";

export function PartnerEntry({ programSlug, companyName, programName, reward }: { programSlug: string; companyName: string; programName: string; reward: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [accepted, setAccepted] = useState(false);
  const canContinue = /^\S+@\S+\.\S+$/.test(email) && accepted && !pending;
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
  return <main className="partner-entry-page"><section className="partner-entry-card"><header><div className="partner-entry-brand"><span className="brand-mark">R</span><span>Relay · {companyName}</span></div><small>АГЕНТСКАЯ ПРОГРАММА</small><h2>{programName}</h2><p>Вознаграждение: {reward}</p></header><div className="partner-entry-body"><h1>Откройте доступ к заданием</h1><p>Укажите email — на него будет сохранён ваш прогресс, лиды и выплаты.</p><form onSubmit={submit}><label><span>Email</span><input name="email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label><label className="partner-consent"><input name="acceptedTerms" type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>Принимаю <a href="/legal/license" target="_blank" rel="noreferrer">Лицензионное соглашение</a> и <a href="/legal/privacy" target="_blank" rel="noreferrer">Политику конфиденциальности</a></span></label>{error && <div className="inline-notice error" role="alert">{error}</div>}<button className="button button-primary" disabled={!canContinue} type="submit">{pending ? "Открываем программу…" : "Продолжить"}<span>→</span></button></form></div></section><small className="partner-entry-note">При повторном входе с этим email откроется сохранённый прогресс.</small></main>;
}

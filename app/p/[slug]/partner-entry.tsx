"use client";

import { useState } from "react";
import { CompanyLogo } from "@/app/dashboard/_components/company-brand";

type Props = { programSlug: string; companyId: string; companyName: string; logoObjectKey: string | null; programName: string; reward: string };

export function PartnerEntry({ programSlug, companyId, companyName, logoObjectKey, programName, reward }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  async function join(includeProfile: boolean) {
    setPending(true); setError("");
    try {
      const response = await fetch("/api/public/partners/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ programSlug, email, acceptedTerms: accepted, name: includeProfile ? name : undefined, phone: includeProfile ? phone : undefined }) });
      const data = await response.json() as { missionsUrl?: string; needsProfile?: boolean; error?: string };
      if (data.needsProfile) { setStep(2); setPending(false); return; }
      if (!response.ok || !data.missionsUrl) throw new Error(data.error || "Не удалось открыть программу");
      window.location.assign(data.missionsUrl);
    } catch (reason) { setPending(false); setError(reason instanceof Error ? reason.message : "Не удалось продолжить"); }
  }

  function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length < 2) return setError("Укажите имя");
    if (phone.replace(/\D/g, "").length < 7) return setError("Укажите корректный номер телефона");
    void join(true);
  }

  return <main className="partner-entry-page"><section className="partner-entry-card"><header><div className="partner-entry-brand"><CompanyLogo company={{ id: companyId, name: companyName, logoObjectKey }} /><span>{companyName} · Relay</span></div><small>АГЕНТСКАЯ ПРОГРАММА</small><h2>{programName}</h2><p>Можно заработать: {reward}</p></header><div className="partner-entry-body">{step === 1 ? <><span className="partner-entry-step">ШАГ 1 ИЗ 2</span><h1>Откройте доступ к заданиям</h1><p>Укажите email — на него будет сохранён ваш прогресс, лиды и выплаты.</p><form onSubmit={(event) => { event.preventDefault(); void join(false); }}><label><span>Email</span><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label><label className="partner-consent"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>Принимаю <a href="/legal/license" target="_blank" rel="noreferrer">Лицензионное соглашение</a> и <a href="/legal/privacy" target="_blank" rel="noreferrer">Политику конфиденциальности</a></span></label>{error && <div className="inline-notice error" role="alert">{error}</div>}<button className="button button-primary" disabled={!/^\S+@\S+\.\S+$/.test(email) || !accepted || pending} type="submit">{pending ? "Проверяем email…" : "Продолжить"}<span>→</span></button></form></> : <><span className="partner-entry-step">ШАГ 2 ИЗ 2</span><h1>Как с вами связаться?</h1><p>Имя и WhatsApp нужны компании для связи. Этот шаг показывается только при первом входе.</p><form onSubmit={submitProfile}><label><span>Имя</span><input required minLength={2} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ваше имя" /></label><label><span>WhatsApp</span><input required type="tel" inputMode="tel" autoComplete="tel" minLength={7} pattern="[+0-9() -]{7,40}" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+7 700 000 00 00" /></label>{error && <div className="inline-notice error" role="alert">{error}</div>}<button className="button button-primary" disabled={pending} type="submit">{pending ? "Создаём кабинет…" : "Открыть задания"}<span>→</span></button></form></>}</div></section><small className="partner-entry-note">При повторном входе с этим email профиль и прогресс откроются сразу.</small></main>;
}

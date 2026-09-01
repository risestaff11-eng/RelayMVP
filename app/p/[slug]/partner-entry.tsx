"use client";

import { useState } from "react";
import { CompanyLogo } from "@/app/dashboard/_components/company-brand";

type Props = { programSlug: string; missionId: string; companyId: string; companyName: string; logoObjectKey: string | null; programName: string; reward: string };

export function PartnerEntry({ programSlug, missionId, companyId, companyName, logoObjectKey, programName, reward }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  async function join(includeProfile: boolean) {
    setPending(true); setError("");
    try {
      const response = await fetch("/api/public/partners/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ programSlug, missionId, email, acceptedTerms: true, name: includeProfile ? name : undefined, phone: includeProfile ? phone : undefined }) });
      const data = await response.json() as { submitUrl?: string; needsProfile?: boolean; error?: string };
      if (data.needsProfile) { setStep(2); setPending(false); return; }
      if (!response.ok || !data.submitUrl) throw new Error(data.error || "Не удалось открыть форму заявки");
      window.location.assign(data.submitUrl);
    } catch (reason) { setPending(false); setError(reason instanceof Error ? reason.message : "Не удалось продолжить"); }
  }

  function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length < 2) return setError("Укажите имя");
    if (phone.replace(/\D/g, "").length < 7) return setError("Укажите корректный номер телефона");
    void join(true);
  }

  return <div className="partner-entry-overlay" role="dialog" aria-modal="true" aria-labelledby="partner-entry-title"><a className="partner-entry-dismiss" href={`/p/${programSlug}#missions`} aria-label="Закрыть" /><section className="partner-entry-card"><a className="partner-entry-close" href={`/p/${programSlug}#missions`} aria-label="Закрыть">×</a><header><div className="partner-entry-brand"><CompanyLogo company={{ id: companyId, name: companyName, logoObjectKey }} /><span>{companyName} · RiseStaff</span></div><small>ВЫ ВЫБРАЛИ ЗАДАНИЕ</small><h2>{programName}</h2><p>Вознаграждение: {reward}</p></header><div className="partner-entry-body">{step === 1 ? <><h1 id="partner-entry-title">Куда сохранить заявку?</h1><p>Укажите email. Мы закрепим заявку и выплаты за вами и пришлём ссылку для повторного входа.</p><form onSubmit={(event) => { event.preventDefault(); void join(false); }}><label><span>Email</span><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>{error && <div className="inline-notice error" role="alert">{error}</div>}<button className="button button-primary" disabled={!/^\S+@\S+\.\S+$/.test(email) || pending} type="submit">{pending ? "Проверяем email…" : "Продолжить к заявке"}<span>→</span></button><small className="partner-legal-note">Продолжая, вы принимаете <a href="/legal/license" target="_blank" rel="noreferrer">условия сервиса</a> и <a href="/legal/privacy" target="_blank" rel="noreferrer">политику конфиденциальности</a>.</small></form></> : <><h1 id="partner-entry-title">Как к вам обращаться?</h1><p>Имя и WhatsApp запрашиваются только при первой заявке.</p><form onSubmit={submitProfile}><label><span>Имя</span><input required minLength={2} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Например, Рустам" /></label><label><span>WhatsApp</span><input required type="tel" inputMode="tel" autoComplete="tel" minLength={7} pattern="[+0-9() -]{7,40}" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+7 (700) 000-00-00" /></label>{error && <div className="inline-notice error" role="alert">{error}</div>}<button className="button button-primary" disabled={pending} type="submit">{pending ? "Сохраняем…" : "Перейти к заявке"}<span>→</span></button></form></>}</div></section></div>;
}

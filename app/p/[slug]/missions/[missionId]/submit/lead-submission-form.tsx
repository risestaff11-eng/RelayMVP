"use client";

import { useRef, useState } from "react";

export function LeadSubmissionForm({ programSlug, missionId, token }: { programSlug: string; missionId: string; token: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(1);
  const [pending, setPending] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const [error, setError] = useState("");

  async function nextStep() {
    const form = formRef.current;
    if (!form || !form.reportValidity()) return;
    const values = new FormData(form);
    if (!String(values.get("contactEmail") || "").trim() && !String(values.get("contactPhone") || "").trim()) { setError("Добавьте рабочий email или телефон потенциального клиента"); return; }
    setPending(true); setError("");
    try {
      const response = await fetch("/api/public/submissions/duplicate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ programSlug, contactEmail: values.get("contactEmail"), contactPhone: values.get("contactPhone") }) });
      const data = await response.json() as { duplicate?: boolean };
      if (data.duplicate) { setDuplicate(true); setError("Такой контакт уже закреплён в программе. Данные другого агента не раскрываются."); return; }
      setDuplicate(false); setStep(2); window.scrollTo({ top: 0, behavior: "smooth" });
    } finally { setPending(false); }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step !== 2) return void nextStep();
    setPending(true); setError("");
    const form = new FormData(event.currentTarget);
    form.set("programSlug", programSlug); form.set("missionId", missionId); form.set("token", token);
    try {
      const response = await fetch("/api/public/submissions", { method: "POST", body: form });
      const data = await response.json() as { partnerUrl?: string; error?: string };
      if (!response.ok || !data.partnerUrl) throw new Error(data.error || "Не удалось отправить рекомендацию");
      window.location.assign(data.partnerUrl);
    } catch (reason) { setPending(false); setError(reason instanceof Error ? reason.message : "Не удалось отправить рекомендацию"); }
  }

  return <form ref={formRef} className="lead-submission-form two-step-lead-form" onSubmit={submit}><div className="lead-form-stepper"><span className={step === 1 ? "active" : "done"}><b>{step === 1 ? "1" : "✓"}</b> Данные клиента</span><i /><span className={step === 2 ? "active" : ""}><b>2</b> Контекст и подтверждения</span></div><div className={step === 1 ? "lead-step-panel active" : "lead-step-panel hidden"}><section className="partner-form-section"><div><span>01</span><h2>Данные потенциального клиента</h2></div><p className="lead-step-intro">Контакт закрепится за вами сразу после отправки. До этого Relay проверит возможный дубликат без раскрытия чужих данных.</p><div className="partner-form-grid"><label><span>Имя</span><input name="contactName" required minLength={2} /></label><label><span>Компания</span><input name="contactCompany" required minLength={2} /></label><label><span>Рабочий email</span><input name="contactEmail" type="email" /></label><label><span>Телефон</span><input name="contactPhone" inputMode="tel" /></label></div>{duplicate && <div className="duplicate-warning"><strong>Контакт уже зарегистрирован</strong><p>Выберите другого потенциального клиента.</p></div>}</section>{error && <div className="inline-notice error" role="alert">{error}</div>}<button className="button button-primary partner-submit-button" type="button" onClick={nextStep} disabled={pending}>{pending ? "Проверяем контакт…" : "Контекст и подтверждения — далее"}<span>→</span></button></div><div className={step === 2 ? "lead-step-panel active" : "lead-step-panel hidden"}><section className="partner-form-section"><div><span>02</span><h2>Контекст и подтверждения</h2></div><p className="lead-step-intro">Добавьте информацию, которая поможет компании быстро и честно проверить рекомендацию.</p><div className="partner-form-stack"><label><span>Комментарий компании</span><textarea name="partnerComment" rows={5} placeholder="Почему контакт подходит и о чём уже договорились" /></label><label><span>Ссылки</span><textarea name="externalLinks" rows={3} placeholder="Сайт, профиль, переписка или документ — по одной ссылке в строке" /></label><label className="file-drop"><span>Файлы</span><input name="files" type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" /><small>До 3 файлов, каждый до 10 МБ</small></label></div></section><p className="privacy-note">Relay зафиксирует дату и владельца рекомендации. Компания увидит контакт после отправки.</p>{error && <div className="inline-notice error" role="alert">{error}</div>}<div className="lead-final-actions"><button type="button" onClick={() => { setStep(1); setError(""); }}>← Назад</button><button className="button button-primary partner-submit-button" disabled={pending} type="submit">{pending ? "Передаём лид…" : "Передать лид"}<span>→</span></button></div></div></form>;
}

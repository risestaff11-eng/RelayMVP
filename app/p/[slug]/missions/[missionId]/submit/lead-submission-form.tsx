"use client";

import { useRef, useState } from "react";

export function LeadSubmissionForm({ programSlug, missionId, missionType, token }: { programSlug: string; missionId: string; missionType: string; token: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [pending, setPending] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const [error, setError] = useState("");
  const [fileNames, setFileNames] = useState<string[]>([]);
  const requiresContact = missionType === "LEAD" || missionType === "DEAL";

  async function nextStep() {
    const form = formRef.current;
    if (!form || !form.reportValidity()) return;
    const values = new FormData(form);
    if (requiresContact && String(values.get("contactPhone") || "").replace(/\D/g, "").length < 7) return setError("Укажите корректный телефон потенциального клиента");
    if (!requiresContact) { setStep(2); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
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

  function selectFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 5) { event.target.value = ""; setFileNames([]); return setError("Можно прикрепить не более 5 файлов"); }
    if (files.some((file) => file.size > 10 * 1024 * 1024)) { event.target.value = ""; setFileNames([]); return setError("Каждый файл должен быть не больше 10 МБ"); }
    setError(""); setFileNames(files.map((file) => file.name));
  }

  return <form ref={formRef} className="lead-submission-form two-step-lead-form" onSubmit={submit}>
    <div className="lead-form-stepper"><span className={step === 1 ? "active" : "done"}><b>{step === 1 ? "1" : "✓"}</b> {requiresContact ? "Данные клиента" : "Результат"}</span><i /><span className={step === 2 ? "active" : ""}><b>2</b> Подтверждения</span></div>
    <div className={step === 1 ? "lead-step-panel active" : "lead-step-panel hidden"}><section className="partner-form-section"><div><span>01</span><h2>{requiresContact ? "Данные потенциального клиента" : "Что вы выполнили"}</h2></div><p className="lead-step-intro">{requiresContact ? "Контакт закрепится за вами сразу после отправки. Relay заранее проверит возможный дубликат без раскрытия чужих данных." : "Кратко назовите результат. Ссылки, скриншоты и файлы вы добавите на следующем шаге."}</p><div className="partner-form-grid"><label><span>{requiresContact ? "Имя *" : "Название результата *"}</span><input name="contactName" required minLength={2} placeholder={requiresContact ? "Имя человека" : missionType === "IMAGE" ? "Например: публикация кейса в LinkedIn" : "Например: пройден продуктовый квиз"} /></label><label><span>{requiresContact ? "Компания · необязательно" : "Площадка или формат · необязательно"}</span><input name="contactCompany" /></label>{requiresContact && <><label><span>Рабочий email · необязательно</span><input name="contactEmail" type="email" /></label><label><span>Телефон *</span><input name="contactPhone" type="tel" inputMode="tel" autoComplete="tel" required minLength={7} pattern="[+0-9() -]{7,40}" /></label></>}</div>{duplicate && <div className="duplicate-warning"><strong>Контакт уже зарегистрирован</strong><p>Выберите другого потенциального клиента.</p></div>}</section>{error && <div className="inline-notice error" role="alert">{error}</div>}<button className="button button-primary partner-submit-button" type="button" onClick={nextStep} disabled={pending}>{pending ? "Проверяем контакт…" : "Добавить подтверждения — далее"}<span>→</span></button></div>
    <div className={step === 2 ? "lead-step-panel active" : "lead-step-panel hidden"}><section className="partner-form-section"><div><span>02</span><h2>Контекст и подтверждения</h2></div><p className="lead-step-intro">Добавьте информацию, которая поможет компании быстро и честно проверить результат.</p><div className="partner-form-stack"><label><span>Комментарий компании</span><textarea name="partnerComment" rows={5} placeholder={requiresContact ? "Почему контакт подходит и о чём уже договорились" : "Что именно сделано и где это можно проверить"} /></label><label><span>Ссылки</span><textarea name="externalLinks" rows={3} placeholder="Публикация, страница события или другой результат — по одной ссылке в строке" /></label><label className="file-drop"><span>Файлы</span><input ref={fileInputRef} name="files" type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" hidden onChange={selectFiles} /><button className="file-plus-button" type="button" onClick={() => fileInputRef.current?.click()}><b>＋</b><span>{fileNames.length ? "Изменить файлы" : "Прикрепить файлы"}</span></button><small>До 5 файлов, каждый до 10 МБ</small>{fileNames.length > 0 && <ul className="selected-file-list">{fileNames.map((name) => <li key={name}>{name}</li>)}</ul>}</label></div></section><p className="privacy-note">Relay зафиксирует дату, автора и историю проверки результата.</p>{error && <div className="inline-notice error" role="alert">{error}</div>}<div className="lead-final-actions"><button type="button" onClick={() => { setStep(1); setError(""); }}>← Назад</button><button className="button button-primary partner-submit-button" disabled={pending} type="submit">{pending ? "Передаём результат…" : "Передать результат"}<span>→</span></button></div></div>
  </form>;
}

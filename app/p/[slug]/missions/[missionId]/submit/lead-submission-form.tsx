"use client";

import { useMemo, useRef, useState } from "react";
import { visibleSubmissionFormFields, type SubmissionFormField } from "../../../../../../lib/submission-form";

export function LeadSubmissionForm({ programSlug, missionId, missionType, token, formFields }: { programSlug: string; missionId: string; missionType: string; token: string; formFields: SubmissionFormField[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [step, setStep] = useState<1 | 2>(1);
  const [pending, setPending] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const [error, setError] = useState("");
  const [fileNames, setFileNames] = useState<Record<string, string[]>>({});
  const commercial = missionType === "LEAD" || missionType === "DEAL";
  const visible = useMemo(() => visibleSubmissionFormFields(formFields, missionType), [formFields, missionType]);
  const contactFields = visible.filter((field) => field.stage === "CONTACT");
  const contextFields = visible.filter((field) => field.stage === "CONTEXT");

  function fieldName(field: SubmissionFormField) { return `field__${field.id}`; }
  function valueForSemantic(form: FormData, semantic: SubmissionFormField["semantic"]) {
    const field = visible.find((item) => item.semantic === semantic);
    return field ? String(form.get(fieldName(field)) || "") : "";
  }

  function validateStage(stage: 1 | 2) {
    const form = formRef.current;
    if (!form) return false;
    const fields = stage === 1 ? contactFields : contextFields;
    for (const field of fields) {
      const element = form.elements.namedItem(fieldName(field));
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
        if (!element.reportValidity()) return false;
      }
      if (field.required && field.type === "FILE" && !(fileNames[field.id]?.length)) { setError(`Прикрепите файл: «${field.label}»`); return false; }
    }
    return true;
  }

  async function nextStep() {
    const form = formRef.current;
    if (!form || !validateStage(1)) return;
    const values = new FormData(form);
    const phone = valueForSemantic(values, "CONTACT_PHONE");
    if (commercial && phone && phone.replace(/\D/g, "").length < 7) return setError("Укажите корректный телефон потенциального клиента");
    if (!commercial) { setStep(2); setError(""); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setPending(true); setError("");
    try {
      const response = await fetch("/api/public/submissions/duplicate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ programSlug, contactEmail: valueForSemantic(values, "CONTACT_EMAIL"), contactPhone: phone }) });
      const data = await response.json() as { duplicate?: boolean };
      if (data.duplicate) { setDuplicate(true); setError("Такой контакт уже закреплён в программе. Данные другого агента не раскрываются."); return; }
      setDuplicate(false); setStep(2); window.scrollTo({ top: 0, behavior: "smooth" });
    } finally { setPending(false); }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step !== 2) return void nextStep();
    if (!validateStage(2)) return;
    setPending(true); setError("");
    const form = new FormData(event.currentTarget);
    form.set("programSlug", programSlug); form.set("missionId", missionId); form.set("token", token);
    try {
      const response = await fetch("/api/public/submissions", { method: "POST", body: form });
      const data = await response.json() as { partnerUrl?: string; error?: string };
      if (!response.ok || !data.partnerUrl) throw new Error(data.error || "Не удалось отправить результат");
      window.location.assign(data.partnerUrl);
    } catch (reason) { setPending(false); setError(reason instanceof Error ? reason.message : "Не удалось отправить результат"); }
  }

  function selectFiles(field: SubmissionFormField, event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const otherCount = Object.entries(fileNames).filter(([id]) => id !== field.id).reduce((total, [, names]) => total + names.length, 0);
    if (files.length + otherCount > 5) { event.target.value = ""; return setError("Можно прикрепить не более 5 файлов ко всей форме"); }
    if (files.some((file) => file.size > 10 * 1024 * 1024)) { event.target.value = ""; return setError("Каждый файл должен быть не больше 10 МБ"); }
    setError(""); setFileNames((current) => ({ ...current, [field.id]: files.map((file) => file.name) }));
  }

  function renderField(field: SubmissionFormField) {
    const common = { name: fieldName(field), required: field.required, placeholder: field.placeholder, "aria-describedby": field.description ? `${field.id}-help` : undefined };
    let control: React.ReactNode;
    if (field.type === "TEXTAREA") control = <textarea {...common} rows={4} />;
    else if (field.type === "SELECT") control = <select {...common} defaultValue=""><option value="" disabled>Выберите вариант</option>{field.options.map((option) => <option key={option}>{option}</option>)}</select>;
    else if (field.type === "CHECKBOX") control = <input {...common} type="checkbox" value="yes" />;
    else if (field.type === "FILE") control = <div className="file-drop"><input ref={(node) => { fileInputs.current[field.id] = node; }} name={`file__${field.id}`} type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" hidden onChange={(event) => selectFiles(field, event)} /><button className="file-plus-button" type="button" onClick={() => fileInputs.current[field.id]?.click()}><b>＋</b><span>{fileNames[field.id]?.length ? "Изменить файлы" : "Прикрепить файлы"}</span></button>{fileNames[field.id]?.length ? <ul className="selected-file-list">{fileNames[field.id].map((name) => <li key={name}>{name}</li>)}</ul> : null}</div>;
    else control = <input {...common} type={field.type === "PHONE" ? "tel" : field.type === "EMAIL" ? "email" : field.type === "URL" ? "url" : "text"} inputMode={field.type === "PHONE" ? "tel" : undefined} pattern={field.type === "PHONE" ? "[+0-9() \\-]{7,40}" : undefined} />;
    return <label key={field.id} className={field.type === "CHECKBOX" ? "dynamic-checkbox-field" : undefined}><span>{field.label}{field.required ? " *" : ""}</span>{control}{field.description && <small id={`${field.id}-help`}>{field.description}</small>}</label>;
  }

  return <form ref={formRef} className="lead-submission-form two-step-lead-form" onSubmit={submit}>
    <div className="lead-form-stepper"><span className={step === 1 ? "active" : "done"}><b>{step === 1 ? "1" : "✓"}</b> {commercial ? "Данные клиента" : "Результат"}</span><i /><span className={step === 2 ? "active" : ""}><b>2</b> Подтверждения</span></div>
    <div className={step === 1 ? "lead-step-panel active" : "lead-step-panel hidden"}><section className="partner-form-section"><div><span>01</span><h2>{commercial ? "Данные потенциального клиента" : "Что вы выполнили"}</h2></div><p className="lead-step-intro">{commercial ? "Контакт закрепится за вами после отправки. Relay заранее проверит возможный дубликат без раскрытия чужих данных." : "Опишите результат. На следующем шаге добавьте контекст и подтверждения."}</p><div className="partner-form-grid dynamic-result-fields">{contactFields.map(renderField)}</div>{duplicate && <div className="duplicate-warning"><strong>Контакт уже зарегистрирован</strong><p>Выберите другого потенциального клиента.</p></div>}</section>{error && <div className="inline-notice error" role="alert">{error}</div>}<button className="button button-primary partner-submit-button" type="button" onClick={nextStep} disabled={pending}>{pending ? "Проверяем контакт…" : "Добавить подтверждения — далее"}<span>→</span></button></div>
    <div className={step === 2 ? "lead-step-panel active" : "lead-step-panel hidden"}><section className="partner-form-section"><div><span>02</span><h2>Контекст и подтверждения</h2></div><p className="lead-step-intro">Добавьте информацию, которая поможет компании быстро и честно проверить результат.</p><div className="partner-form-stack dynamic-result-fields">{contextFields.map(renderField)}</div></section><p className="privacy-note">Relay зафиксирует дату, автора и историю проверки результата.</p>{error && <div className="inline-notice error" role="alert">{error}</div>}<div className="lead-final-actions"><button type="button" onClick={() => { setStep(1); setError(""); }}>← Назад</button><button className="button button-primary partner-submit-button" disabled={pending} type="submit">{pending ? "Передаём результат…" : "Передать результат"}<span>→</span></button></div></div>
  </form>;
}

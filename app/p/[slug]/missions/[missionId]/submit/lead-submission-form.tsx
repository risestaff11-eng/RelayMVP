"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { visibleSubmissionFormFields, type SubmissionFormField } from "../../../../../../lib/submission-form";

type FieldValue = string | boolean;
type VoiceAnswer = { fieldId: string; value: string; confidence: number };

export function LeadSubmissionForm({ programSlug, missionId, missionType, token, formFields }: { programSlug: string; missionId: string; missionType: string; token: string; formFields: SubmissionFormField[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const voiceInput = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingSecondsRef = useRef(0);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pending, setPending] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [voiceUrl, setVoiceUrl] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceDurationSeconds, setVoiceDurationSeconds] = useState(0);
  const [voicePending, setVoicePending] = useState(false);
  const [includeVoice, setIncludeVoice] = useState(true);
  const [voiceNotice, setVoiceNotice] = useState("");
  const commercial = missionType === "LEAD" || missionType === "DEAL";
  const visible = useMemo(() => visibleSubmissionFormFields(formFields, missionType), [formFields, missionType]);
  const contactFields = visible.filter((field) => field.stage === "CONTACT");
  const contextFields = visible.filter((field) => field.stage === "CONTEXT");
  const [values, setValues] = useState<Record<string, FieldValue>>(() => Object.fromEntries(visible.map((field) => [field.id, field.type === "CHECKBOX" ? false : ""])));

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (voiceUrl) URL.revokeObjectURL(voiceUrl);
  }, [voiceUrl]);

  function fieldName(field: SubmissionFormField) { return `field__${field.id}`; }
  function setFieldValue(fieldId: string, value: FieldValue) { setValues((current) => ({ ...current, [fieldId]: value })); }
  function valueForSemantic(semantic: SubmissionFormField["semantic"]) {
    const field = visible.find((item) => item.semantic === semantic);
    return field ? String(values[field.id] || "") : "";
  }

  function validateStage(stageToValidate: 1 | 2) {
    const form = formRef.current;
    if (!form) return false;
    const stageFields = stageToValidate === 1 ? contactFields : contextFields;
    for (const field of stageFields) {
      if (field.type === "FILE") {
        if (field.required && !(files[field.id]?.length)) { setError(`Прикрепите файл: «${field.label}»`); return false; }
        continue;
      }
      const element = form.elements.namedItem(fieldName(field));
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
        if (!element.reportValidity()) return false;
      }
    }
    setError("");
    return true;
  }

  async function nextFromContact() {
    if (!validateStage(1)) return;
    const phone = valueForSemantic("CONTACT_PHONE");
    if (commercial && phone && phone.replace(/\D/g, "").length < 7) return setError("Укажите корректный телефон потенциального клиента");
    if (!commercial) { setStep(2); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setPending(true); setError("");
    try {
      const response = await fetch("/api/public/submissions/duplicate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ programSlug, contactEmail: valueForSemantic("CONTACT_EMAIL"), contactPhone: phone }) });
      const data = await response.json() as { duplicate?: boolean };
      if (data.duplicate) { setDuplicate(true); setError("Такой контакт уже закреплён в программе. Данные другого агента не раскрываются."); return; }
      setDuplicate(false); setStep(2); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch { setError("Не удалось проверить контакт. Попробуйте ещё раз."); }
    finally { setPending(false); }
  }

  function reviewResult() {
    if (!validateStage(2)) return;
    setStep(3); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 1) return void nextFromContact();
    if (step === 2) return void reviewResult();
    if (!validateStage(1) || !validateStage(2)) return;
    setPending(true); setError("");
    const form = new FormData(event.currentTarget);
    form.set("programSlug", programSlug); form.set("missionId", missionId); form.set("token", token);
    form.set("audioTranscript", voiceTranscript);
    form.set("audioDurationSeconds", String(voiceDurationSeconds));
    for (const [fieldId, selected] of Object.entries(files)) for (const file of selected) form.append(`file__${fieldId}`, file);
    if (voiceFile && includeVoice) form.set("voiceNote", voiceFile);
    try {
      const response = await fetch("/api/public/submissions", { method: "POST", body: form });
      const data = await response.json() as { partnerUrl?: string; submissionId?: string; error?: string };
      if (!response.ok || !data.partnerUrl) throw new Error(data.error || "Не удалось отправить результат");
      window.location.assign(data.submissionId ? `/partner/${token}/submissions/${data.submissionId}` : data.partnerUrl);
    } catch (reason) { setPending(false); setError(reason instanceof Error ? reason.message : "Не удалось отправить результат"); }
  }

  function addFiles(field: SubmissionFormField, event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!selected.length) return;
    const currentTotal = Object.values(files).reduce((total, list) => total + list.length, 0);
    if (currentTotal + selected.length > 5) return setError("Можно прикрепить не более 5 файлов ко всей форме");
    if (selected.some((file) => file.size > 10 * 1024 * 1024)) return setError("Каждый файл должен быть не больше 10 МБ");
    setError("");
    setFiles((current) => {
      const existing = current[field.id] ?? [];
      const merged = [...existing, ...selected].filter((file, index, all) => all.findIndex((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified) === index);
      return { ...current, [field.id]: merged };
    });
  }

  function removeFile(fieldId: string, target: File) {
    setFiles((current) => ({ ...current, [fieldId]: (current[fieldId] ?? []).filter((file) => file !== target) }));
  }

  async function analyzeVoice(file: File, durationSeconds: number) {
    setVoicePending(true); setVoiceNotice("Rela расшифровывает запись и заполняет ответы…"); setError("");
    const form = new FormData(); form.set("token", token); form.set("missionId", missionId); form.set("audio", file); form.set("durationSeconds", String(durationSeconds));
    try {
      const response = await fetch("/api/partner/audio/transcribe", { method: "POST", body: form });
      const data = await response.json() as { transcript?: string; answers?: VoiceAnswer[]; missingFields?: string[]; durationSeconds?: number; error?: string };
      if (!response.ok || !data.transcript) throw new Error(data.error || "Не удалось расшифровать запись");
      setVoiceTranscript(data.transcript);
      setVoiceDurationSeconds(Math.max(0, Math.min(60, Math.round(data.durationSeconds || durationSeconds))));
      setValues((current) => {
        const next = { ...current };
        for (const answer of data.answers ?? []) {
          const field = visible.find((item) => item.id === answer.fieldId && item.type !== "FILE");
          if (!field || !answer.value.trim()) continue;
          next[field.id] = field.type === "CHECKBOX" ? /^(да|yes|true|1)$/i.test(answer.value.trim()) : answer.value.trim();
        }
        return next;
      });
      setVoiceNotice(data.missingFields?.length ? "Черновик заполнен. Проверьте ответы и дополните отмеченные поля." : "Черновик заполнен. Проверьте каждый ответ перед отправкой.");
    } catch (reason) { setVoiceNotice(""); setError(reason instanceof Error ? reason.message : "Не удалось обработать аудио"); }
    finally { setVoicePending(false); }
  }

  async function readAudioDuration(file: File) {
    const url = URL.createObjectURL(file);
    try {
      return await new Promise<number>((resolve, reject) => {
        const audio = new Audio();
        audio.preload = "metadata";
        audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
        audio.onerror = () => reject(new Error("Не удалось прочитать аудиофайл"));
        audio.src = url;
      });
    } finally { URL.revokeObjectURL(url); }
  }

  async function acceptVoiceFile(file: File, knownDuration?: number) {
    if (file.size > 10 * 1024 * 1024) return setError("Аудиозапись должна быть не больше 10 МБ");
    let durationSeconds = knownDuration || 0;
    try { if (!durationSeconds) durationSeconds = await readAudioDuration(file); }
    catch { return setError("Не удалось прочитать аудиофайл. Выберите WEBM, M4A, MP3, OGG, AAC или WAV."); }
    if (durationSeconds > 60.5) return setError("Аудиозапись должна быть не длиннее 60 секунд");
    if (voiceUrl) URL.revokeObjectURL(voiceUrl);
    setVoiceFile(file); setVoiceUrl(URL.createObjectURL(file)); setIncludeVoice(true); setVoiceTranscript(""); setVoiceDurationSeconds(Math.round(durationSeconds));
    await analyzeVoice(file, durationSeconds);
  }

  async function startRecording() {
    setError(""); setVoiceNotice("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return voiceInput.current?.click();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream; chunksRef.current = [];
      const preferred = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop()); streamRef.current = null;
        const mime = recorder.mimeType || chunksRef.current[0]?.type || "audio/webm";
        const extension = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
        const file = new File(chunksRef.current, `voice-${Date.now()}.${extension}`, { type: mime });
        setRecording(false); void acceptVoiceFile(file, recordingSecondsRef.current);
      };
      recorder.start(500); setRecording(true); setRecordingSeconds(0); recordingSecondsRef.current = 0;
      timerRef.current = setInterval(() => setRecordingSeconds((seconds) => {
        const next = Math.min(60, seconds + 1); recordingSecondsRef.current = next;
        if (next >= 60) window.setTimeout(() => stopRecording(), 0);
        return next;
      }), 1000);
    } catch { setError("Не удалось получить доступ к микрофону. Разрешите доступ или загрузите аудиофайл."); }
  }

  function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function clearVoice() {
    if (voiceUrl) URL.revokeObjectURL(voiceUrl);
    setVoiceFile(null); setVoiceUrl(""); setVoiceTranscript(""); setVoiceNotice(""); setRecordingSeconds(0); setVoiceDurationSeconds(0); recordingSecondsRef.current = 0;
  }

  function renderField(field: SubmissionFormField) {
    if (field.type === "FILE") return <label key={field.id} className="dialog-field dialog-file-field"><span>{field.label}{field.required ? " *" : ""}</span>{field.description && <small>{field.description}</small>}<div className="file-drop"><input ref={(node) => { fileInputs.current[field.id] = node; }} type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" hidden onChange={(event) => addFiles(field, event)} /><button className="file-plus-button" type="button" onClick={() => fileInputs.current[field.id]?.click()}><b>＋</b><span>Добавить файлы</span></button>{files[field.id]?.length ? <ul className="selected-file-list">{files[field.id].map((file) => <li key={`${file.name}-${file.size}-${file.lastModified}`}><span>{file.name}<small>{Math.max(1, Math.round(file.size / 1024))} КБ</small></span><button type="button" onClick={() => removeFile(field.id, file)} aria-label={`Удалить ${file.name}`}>×</button></li>)}</ul> : <p>До 5 файлов по 10 МБ. Каждый файл можно удалить до отправки.</p>}</div></label>;
    const common = { name: fieldName(field), required: field.required, placeholder: field.placeholder, "aria-describedby": field.description ? `${field.id}-help` : undefined };
    if (field.type === "CHECKBOX") return <label key={field.id} className="dialog-field dynamic-checkbox-field"><input {...common} type="checkbox" value="yes" checked={Boolean(values[field.id])} onChange={(event) => setFieldValue(field.id, event.target.checked)} /><span>{field.label}{field.required ? " *" : ""}</span>{field.description && <small id={`${field.id}-help`}>{field.description}</small>}</label>;
    let control: React.ReactNode;
    if (field.type === "TEXTAREA") control = <textarea {...common} rows={4} value={String(values[field.id] ?? "")} onChange={(event) => setFieldValue(field.id, event.target.value)} />;
    else if (field.type === "SELECT") control = <select {...common} value={String(values[field.id] ?? "")} onChange={(event) => setFieldValue(field.id, event.target.value)}><option value="" disabled>Выберите вариант</option>{field.options.map((option) => <option key={option}>{option}</option>)}</select>;
    else control = <input {...common} type={field.type === "PHONE" ? "tel" : field.type === "EMAIL" ? "email" : field.type === "URL" ? "url" : "text"} inputMode={field.type === "PHONE" ? "tel" : undefined} pattern={field.type === "PHONE" ? "[+0-9() \\-]{7,40}" : undefined} value={String(values[field.id] ?? "")} onChange={(event) => setFieldValue(field.id, event.target.value)} />;
    return <label key={field.id} className="dialog-field"><span>{field.label}{field.required ? " *" : ""}</span>{control}{field.description && <small id={`${field.id}-help`}>{field.description}</small>}</label>;
  }

  const reviewFields = visible.filter((field) => field.type !== "FILE");
  const selectedFiles = Object.values(files).flat();

  return <form ref={formRef} className="lead-submission-form agent-dialog-form" onSubmit={submit}>
    <div className="lead-form-stepper"><span className={step === 1 ? "active" : "done"}><b>{step > 1 ? "✓" : "1"}</b> Контакт</span><i /><span className={step === 2 ? "active" : step > 2 ? "done" : ""}><b>{step > 2 ? "✓" : "2"}</b> Контекст</span><i /><span className={step === 3 ? "active" : ""}><b>3</b> Проверка</span></div>

    {step < 3 && <section className="voice-answer-card"><div className="dialog-system-message"><span>R</span><div><strong>Можно рассказать всё голосом</strong><p>Запишите сообщение до 60 секунд. Rela расшифрует его, разложит данные по полям и попросит вас всё проверить.</p></div></div><div className="voice-controls">{recording ? <button className="voice-record-button recording" type="button" onClick={stopRecording}><i>■</i><span>Остановить · 0:{String(recordingSeconds).padStart(2, "0")}</span></button> : <button className="voice-record-button" type="button" disabled={voicePending} onClick={() => void startRecording()}><i>●</i><span>{voiceFile ? "Записать заново" : "Записать ответ"}</span></button>}<button type="button" className="voice-upload-button" disabled={recording || voicePending} onClick={() => voiceInput.current?.click()}>Загрузить аудио</button><input ref={voiceInput} type="file" accept="audio/*" capture hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void acceptVoiceFile(file); }} /></div>{voicePending && <div className="voice-processing"><i /><span>Расшифровываем и готовим черновик ответов…</span></div>}{voiceFile && !voicePending && <div className="voice-result"><audio controls src={voiceUrl}><track kind="captions" srcLang="ru" label="Расшифровка" src={`data:text/vtt;charset=utf-8,${encodeURIComponent(`WEBVTT\\n\\n00:00.000 --> 00:59.999\\n${voiceTranscript || "Голосовой ответ агента"}`)}`} /></audio><small>{voiceDurationSeconds ? `${voiceDurationSeconds} сек.` : "до 60 сек."}</small><button type="button" onClick={clearVoice}>Удалить запись</button><label><input type="checkbox" checked={includeVoice} onChange={(event) => setIncludeVoice(event.target.checked)} /><span>Передать оригинал записи компании</span></label></div>}{voiceTranscript && <details className="voice-transcript"><summary>Расшифровка записи</summary><textarea value={voiceTranscript} onChange={(event) => setVoiceTranscript(event.target.value)} rows={5} /></details>}{voiceNotice && <p className="voice-notice">✓ {voiceNotice}</p>}</section>}

    {step === 1 && <div className="lead-step-panel active"><div className="dialog-system-message"><span>R</span><div><strong>{commercial ? "Кого вы рекомендуете?" : "Какой результат вы получили?"}</strong><p>{commercial ? "Укажите контакт. Система проверит дубликат до передачи данных компании." : "Заполните основные данные результата. Можно использовать готовую расшифровку выше."}</p></div></div><section className="dialog-answer-card"><div className="partner-form-grid dynamic-result-fields">{contactFields.map(renderField)}</div></section>{duplicate && <div className="duplicate-warning"><strong>Контакт уже зарегистрирован</strong><p>Выберите другого потенциального клиента.</p></div>}{error && <div className="inline-notice error" role="alert">{error}</div>}<button className="button button-primary partner-submit-button" type="button" onClick={() => void nextFromContact()} disabled={pending}>{pending ? "Проверяем контакт…" : "Продолжить"}<span>→</span></button></div>}

    {step === 2 && <div className="lead-step-panel active"><div className="dialog-system-message"><span>R</span><div><strong>Добавьте контекст и подтверждения</strong><p>Компания увидит эти ответы вместе с контактом, файлами и ожидаемой наградой.</p></div></div><section className="dialog-answer-card"><div className="partner-form-stack dynamic-result-fields">{contextFields.map(renderField)}</div></section>{error && <div className="inline-notice error" role="alert">{error}</div>}<div className="lead-final-actions"><button type="button" onClick={() => { setStep(1); setError(""); }}>← Назад</button><button className="button button-primary partner-submit-button" type="button" onClick={reviewResult}>Проверить ответы <span>→</span></button></div></div>}

    {step === 3 && <div className="lead-step-panel active"><div className="dialog-system-message"><span>R</span><div><strong>Проверьте результат перед отправкой</strong><p>Ничего не будет отправлено, пока вы не подтвердите данные.</p></div></div><section className="submission-review-card">{reviewFields.map((field) => <div key={field.id}><small>{field.label}</small><strong>{field.type === "CHECKBOX" ? values[field.id] ? "Да" : "Нет" : String(values[field.id] || "Не заполнено")}</strong><button type="button" onClick={() => setStep(field.stage === "CONTACT" ? 1 : 2)}>Изменить</button></div>)}{selectedFiles.length > 0 && <div><small>Файлы</small><strong>{selectedFiles.map((file) => file.name).join(", ")}</strong><button type="button" onClick={() => setStep(2)}>Изменить</button></div>}{voiceTranscript && <div><small>Голосовая расшифровка</small><strong>{includeVoice ? "Текст и оригинал записи" : "Только подтверждённый текст"}</strong><button type="button" onClick={() => setStep(2)}>Изменить</button></div>}</section><p className="privacy-note">Relay зафиксирует дату, автора, выбранное задание и историю проверки результата.</p>{error && <div className="inline-notice error" role="alert">{error}</div>}<div className="lead-final-actions"><button type="button" onClick={() => { setStep(2); setError(""); }}>← Назад</button><button className="button button-primary partner-submit-button" disabled={pending} type="submit">{pending ? "Передаём результат…" : "Подтвердить и отправить"}<span>→</span></button></div></div>}
  </form>;
}

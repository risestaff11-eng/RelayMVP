"use client";

import { SafeLink as Link } from "@/app/safe-link";
import { useMemo, useRef, useState } from "react";
import type { MissionRecord, ProgramRecord } from "../../../../db/programs";
import { agentUrl } from "../../../../lib/public-origins";
import { SUBMISSION_FIELD_TYPES, type SubmissionFormField } from "../../../../lib/submission-form";

type BuilderStep = "basics" | "missions" | "settings" | "review";
type Notice = { type: "success" | "error"; text: string };

const steps: Array<{ id: BuilderStep; number: string; label: string; hint: string }> = [
  { id: "basics", number: "1", label: "Основное", hint: "Название и смысл" },
  { id: "missions", number: "2", label: "Задания", hint: "Что делает агент" },
  { id: "settings", number: "3", label: "Условия", hint: "Выплата и проверка" },
  { id: "review", number: "4", label: "Проверка", hint: "Что увидит агент" },
];

const typeNames: Record<string, string> = { LEAD: "Люди", DEAL: "Сделки", IMAGE: "Имидж", ENGAGEMENT: "Вовлечение" };
const typeIcons: Record<string, string> = { LEAD: "↗", DEAL: "◇", IMAGE: "◎", ENGAGEMENT: "✦" };
const formTypeNames: Record<string, string> = { TEXT: "Короткий текст", TEXTAREA: "Развёрнутый текст", PHONE: "Телефон", EMAIL: "Email", URL: "Ссылка", FILE: "Файл", SELECT: "Выбор из списка", CHECKBOX: "Чекбокс" };
const typeCopy: Record<string, { summary: string; result: string; proof: string; template: Omit<MissionRecord, "id" | "sortOrder" | "resources"> }> = {
  LEAD: { summary: "Квалифицированный контакт или знакомство", result: "Кого и с какими данными нужно передать", proof: "Что подтверждает качество контакта", template: { type: "LEAD", title: "Познакомьте с подходящей компанией", description: "Передайте контакт человека, который соответствует портрету клиента и согласен на знакомство.", instructions: ["Найдите подходящего потенциального клиента", "Получите согласие на передачу контакта", "Передайте данные через Relay"], proofRequirements: ["Имя и рабочий телефон", "Комментарий: почему клиент подходит"], rewardMode: "FIXED", rewardValue: 0, rewardLabel: "Награда за принятый контакт", verificationRules: "Компания проверит соответствие портрету клиента, согласие на контакт и отсутствие дубликата.", status: "ACTIVE" } },
  DEAL: { summary: "Оплаченная сделка или подтверждённый договор", result: "Какой коммерческий результат должен состояться", proof: "Что подтверждает договорённость или оплату", template: { type: "DEAL", title: "Помогите довести клиента до сделки", description: "Сопроводите знакомство до договора, оплаты или другого согласованного коммерческого результата.", instructions: ["Организуйте знакомство с ответственным лицом", "Помогите согласовать следующий коммерческий шаг", "Передайте подтверждение результата через Relay"], proofRequirements: ["Номер договора, счёта или подтверждение оплаты", "Комментарий о роли агента в сделке"], rewardMode: "PERCENT", rewardValue: 0, rewardLabel: "Процент от подтверждённой сделки", verificationRules: "Награда подтверждается после коммерческого события, указанного в условиях программы.", status: "ACTIVE" } },
  IMAGE: { summary: "Публикация, кейс, отзыв или упоминание", result: "Какой публичный материал должен появиться", proof: "Что подтверждает публикацию материала", template: { type: "IMAGE", title: "Расскажите о продукте своей аудитории", description: "Создайте полезную публикацию, кейс или отзыв, который честно показывает ценность продукта.", instructions: ["Выберите подходящий формат и площадку", "Подготовьте материал без неподтверждённых обещаний", "Опубликуйте и передайте ссылку через Relay"], proofRequirements: ["Ссылка на публикацию", "Скриншот или файл материала"], rewardMode: "FIXED", rewardValue: 0, rewardLabel: "Награда после проверки публикации", verificationRules: "Компания проверит соответствие брифу, факт публикации и доступность материала аудитории.", status: "ACTIVE" } },
  ENGAGEMENT: { summary: "Обучение, мероприятие, тест или активность", result: "Какое полезное действие должен выполнить агент", proof: "Что подтверждает выполнение активности", template: { type: "ENGAGEMENT", title: "Выполните полезную продуктовую активность", description: "Пройдите обучение, посетите событие или выполните действие, которое помогает лучше работать с продуктом.", instructions: ["Откройте материал или событие", "Выполните указанную активность", "Передайте подтверждение через Relay"], proofRequirements: ["Скриншот результата или подтверждение участия"], rewardMode: "NON_MONETARY", rewardValue: 0, rewardLabel: "Доступ к новым заданиям", verificationRules: "Компания проверит завершение активности по указанному подтверждению.", status: "ACTIVE" } },
};

function newFieldDraft(sortOrder: number): SubmissionFormField {
  return { id: "", stage: "CONTEXT", type: "TEXT", scope: "ALL", semantic: "CUSTOM", label: "", description: "", placeholder: "", required: false, options: [], sortOrder };
}

function missionComplete(mission: MissionRecord) {
  return Boolean(mission.title.trim() && mission.description.trim() && mission.instructions.some((item) => item.trim()) && mission.proofRequirements.some((item) => item.trim()) && mission.rewardLabel.trim() && mission.verificationRules.trim() && (mission.rewardMode === "NON_MONETARY" || mission.rewardValue > 0));
}

function rewardText(mission: MissionRecord, currency: string) {
  if (mission.rewardMode === "PERCENT") return `${mission.rewardValue || "—"}%`;
  if (mission.rewardMode === "POINTS") return `${mission.rewardValue || "—"} баллов`;
  if (mission.rewardMode === "NON_MONETARY") return mission.rewardLabel || "Неденежная награда";
  return mission.rewardValue ? `${mission.rewardValue.toLocaleString("ru-RU")} ${currency}` : "Награда не указана";
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function ProgramEditor({ initialProgram }: { initialProgram: ProgramRecord }) {
  const [program, setProgram] = useState(initialProgram);
  const [step, setStep] = useState<BuilderStep>("missions");
  const [pending, setPending] = useState<"save" | "publish" | "pause" | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [publicUrl, setPublicUrl] = useState(program.status === "ACTIVE" ? agentUrl(`/p/${program.slug}`) : null);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [missionDraft, setMissionDraft] = useState<MissionRecord | null>(null);
  const [missionDraftIsNew, setMissionDraftIsNew] = useState(false);
  const [formDraft, setFormDraft] = useState<SubmissionFormField[] | null>(null);
  const [showFieldBuilder, setShowFieldBuilder] = useState(false);
  const [fieldDraft, setFieldDraft] = useState<SubmissionFormField>(newFieldDraft(initialProgram.formFields.length));
  const [aiPending, setAiPending] = useState<"mission" | "form" | "field" | null>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [showQr, setShowQr] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const completedMissionCount = useMemo(() => program.missions.filter(missionComplete).length, [program.missions]);
  const currentStepIndex = steps.findIndex((item) => item.id === step);

  function updateProgram(field: keyof ProgramRecord, value: string) { setProgram((current) => ({ ...current, [field]: value })); }
  function setStepSafely(next: BuilderStep) { setNotice(null); setStep(next); window.scrollTo({ top: 0, behavior: "smooth" }); }

  function openMission(mission: MissionRecord) {
    setMissionDraft({ ...mission, instructions: [...mission.instructions], proofRequirements: [...mission.proofRequirements], resources: [...mission.resources] });
    setMissionDraftIsNew(false); setNotice(null);
  }

  function startMission(type: string) {
    if (program.missions.length >= 12) return setNotice({ type: "error", text: "В одной программе может быть не больше 12 заданий." });
    const mission: MissionRecord = { id: `new-${crypto.randomUUID()}`, ...typeCopy[type].template, sortOrder: program.missions.length, resources: [] };
    setMissionDraft(mission); setMissionDraftIsNew(true); setShowTypePicker(false); setNotice(null);
  }

  function applyMissionDraft() {
    if (!missionDraft) return;
    const normalized = { ...missionDraft, instructions: missionDraft.instructions, proofRequirements: missionDraft.proofRequirements };
    setProgram((current) => ({ ...current, missions: missionDraftIsNew ? [...current.missions, normalized] : current.missions.map((mission) => mission.id === normalized.id ? normalized : mission) }));
    setMissionDraft(null); setMissionDraftIsNew(false);
    setNotice({ type: "success", text: "Задание добавлено в черновик программы. Нажмите «Сохранить», чтобы зафиксировать изменения." });
  }

  function updateMissionDraft(field: keyof MissionRecord, value: string | number | string[]) {
    setMissionDraft((current) => current ? { ...current, [field]: value } : current);
  }

  async function removeMission(mission: MissionRecord) {
    if (program.missions.length <= 1) return setNotice({ type: "error", text: "В программе должно остаться хотя бы одно задание." });
    if (!window.confirm(`Удалить задание «${mission.title}»?`)) return;
    try {
      if (!mission.id.startsWith("new-")) {
        const response = await fetch(`/api/programs/${program.id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ missionId: mission.id }) });
        const data = await response.json() as { error?: string }; if (!response.ok) throw new Error(data.error || "Не удалось удалить задание");
      }
      setProgram((current) => ({ ...current, missions: current.missions.filter((item) => item.id !== mission.id).map((item, sortOrder) => ({ ...item, sortOrder })) }));
      setNotice({ type: "success", text: "Задание удалено." });
    } catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : "Не удалось удалить задание" }); }
  }

  function moveMission(id: string, direction: -1 | 1) {
    setProgram((current) => { const index = current.missions.findIndex((mission) => mission.id === id); const target = index + direction; if (target < 0 || target >= current.missions.length) return current; const missions = [...current.missions]; [missions[index], missions[target]] = [missions[target], missions[index]]; return { ...current, missions: missions.map((mission, sortOrder) => ({ ...mission, sortOrder })) }; });
  }

  async function callRela(body: Record<string, unknown>) {
    const response = await fetch(`/api/programs/${program.id}/ai`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json() as { mission?: Omit<MissionRecord, "id" | "type" | "status" | "sortOrder" | "resources">; formFields?: SubmissionFormField[]; field?: SubmissionFormField; error?: string };
    if (!response.ok) throw new Error(data.error || "Rela не смогла подготовить вариант");
    return data;
  }

  async function generateMissionDraft() {
    if (!missionDraft) return;
    setAiPending("mission"); setNotice(null);
    try {
      const data = await callRela({ action: "MISSION", missionType: missionDraft.type, currentMissionId: missionDraft.id });
      if (!data.mission) throw new Error("Rela вернула неполный вариант задания");
      setMissionDraft((current) => current ? { ...current, ...data.mission } : current);
    } catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : "Не удалось создать задание" }); }
    finally { setAiPending(null); }
  }

  async function uploadResource(file: File) {
    if (!missionDraft || missionDraft.id.startsWith("new-")) return setNotice({ type: "error", text: "Сначала примените и сохраните новое задание, затем приложите файл." });
    if (file.size > 10 * 1024 * 1024) return setNotice({ type: "error", text: "Файл должен быть не больше 10 МБ." });
    setFileBusy(true); setNotice(null);
    try {
      const form = new FormData(); form.set("file", file);
      const response = await fetch(`/api/programs/${program.id}/missions/${missionDraft.id}/files`, { method: "POST", body: form });
      const data = await response.json() as { resource?: MissionRecord["resources"][number]; error?: string }; if (!response.ok || !data.resource) throw new Error(data.error || "Не удалось загрузить файл");
      setMissionDraft((current) => current ? { ...current, resources: [...current.resources, data.resource!] } : current);
      setProgram((current) => ({ ...current, missions: current.missions.map((mission) => mission.id === missionDraft.id ? { ...mission, resources: [...mission.resources, data.resource!] } : mission) }));
    } catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : "Не удалось загрузить файл" }); }
    finally { setFileBusy(false); if (fileInput.current) fileInput.current.value = ""; }
  }

  async function removeResource(resourceId: string) {
    if (!missionDraft || !window.confirm("Удалить файл из задания?")) return;
    const response = await fetch(`/api/programs/${program.id}/missions/${missionDraft.id}/files?resource=${encodeURIComponent(resourceId)}`, { method: "DELETE" });
    const data = await response.json() as { error?: string }; if (!response.ok) return setNotice({ type: "error", text: data.error || "Не удалось удалить файл" });
    setMissionDraft((current) => current ? { ...current, resources: current.resources.filter((resource) => resource.id !== resourceId) } : current);
    setProgram((current) => ({ ...current, missions: current.missions.map((mission) => mission.id === missionDraft.id ? { ...mission, resources: mission.resources.filter((resource) => resource.id !== resourceId) } : mission) }));
  }

  function openFormEditor() { setFormDraft(program.formFields.map((field) => ({ ...field, options: [...field.options] }))); setShowFieldBuilder(false); setNotice(null); }
  function updateFormField(id: string, patch: Partial<SubmissionFormField>) { setFormDraft((current) => current?.map((field) => field.id === id ? { ...field, ...patch } : field) ?? null); }
  function moveFormField(id: string, direction: -1 | 1) { setFormDraft((current) => { if (!current) return current; const index = current.findIndex((field) => field.id === id); const target = index + direction; if (target < 0 || target >= current.length) return current; const fields = [...current]; [fields[index], fields[target]] = [fields[target], fields[index]]; return fields.map((field, sortOrder) => ({ ...field, sortOrder })); }); }
  function removeFormField(field: SubmissionFormField) { if (field.semantic !== "CUSTOM" || !window.confirm(`Удалить поле «${field.label}»?`)) return; setFormDraft((current) => current?.filter((item) => item.id !== field.id).map((item, sortOrder) => ({ ...item, sortOrder })) ?? null); }

  async function generateForm() {
    if (!window.confirm("Rela заменит текущий черновик формы новым вариантом. Продолжить?")) return;
    setAiPending("form");
    try { const data = await callRela({ action: "FORM" }); if (!data.formFields) throw new Error("Rela вернула неполную форму"); setFormDraft(data.formFields); }
    catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : "Не удалось собрать форму" }); }
    finally { setAiPending(null); }
  }

  async function fillFieldWithAi() {
    setAiPending("field");
    try { const data = await callRela({ action: "FIELD", stage: fieldDraft.stage, type: fieldDraft.type, scope: fieldDraft.scope }); if (!data.field) throw new Error("Rela не смогла заполнить поле"); setFieldDraft((current) => ({ ...current, ...data.field, id: current.id })); }
    catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : "Не удалось заполнить поле" }); }
    finally { setAiPending(null); }
  }

  function addFormField() {
    if (!formDraft || !fieldDraft.label.trim()) return setNotice({ type: "error", text: "Укажите название нового поля." });
    const field = { ...fieldDraft, id: `custom-${crypto.randomUUID()}`, semantic: "CUSTOM" as const, sortOrder: formDraft.length };
    setFormDraft((current) => current ? [...current, field] : current); setFieldDraft(newFieldDraft(formDraft.length + 1)); setShowFieldBuilder(false);
  }

  function applyFormDraft() {
    if (!formDraft) return; setProgram((current) => ({ ...current, formFields: formDraft })); setFormDraft(null); setShowFieldBuilder(false); setNotice({ type: "success", text: "Настройки формы добавлены в черновик. Сохраните программу, чтобы зафиксировать их." });
  }

  function validateForPublish() {
    if (program.name.trim().length < 3 || !program.description.trim()) return "Заполните название и описание программы.";
    if (!program.missions.length) return "Добавьте хотя бы одно задание.";
    if (completedMissionCount !== program.missions.length) return "Завершите настройку всех заданий: результат, шаги, подтверждение, награда и правила проверки.";
    if (program.payoutTerms.trim().length < 10 || program.legalTerms.trim().length < 10) return "Заполните условия выплаты и ограничения.";
    return "";
  }

  async function persist(action: "save" | "publish" | "pause") {
    if (action === "publish") { const error = validateForPublish(); if (error) { setNotice({ type: "error", text: error }); return; } }
    setPending(action); setNotice(null);
    try {
      const response = await fetch(`/api/programs/${program.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...program, publish: action === "publish", pause: action === "pause", missions: program.missions }) });
      const data = await response.json() as { status?: string; publicUrl?: string | null; error?: string; program?: ProgramRecord }; if (!response.ok || !data.status) throw new Error(data.error || "Не удалось сохранить программу");
      setProgram(data.program ?? { ...program, status: data.status }); setPublicUrl(data.publicUrl ?? null);
      setNotice({ type: "success", text: action === "publish" ? "Программа опубликована. Ссылка готова для агентов." : action === "pause" ? "Программа поставлена на паузу." : "Черновик сохранён. Можно безопасно продолжить позже." });
    } catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : "Не удалось сохранить программу" }); }
    finally { setPending(null); }
  }

  function nextStep() {
    if (step === "basics" && (program.name.trim().length < 3 || !program.description.trim())) return setNotice({ type: "error", text: "Заполните название и короткое описание программы." });
    if (step === "missions" && !program.missions.length) return setNotice({ type: "error", text: "Добавьте хотя бы одно задание." });
    const next = steps[currentStepIndex + 1]?.id; if (next) setStepSafely(next);
  }

  async function copyLink() { if (publicUrl) { await navigator.clipboard.writeText(publicUrl); setNotice({ type: "success", text: "Публичная ссылка скопирована." }); } }
  async function prepareQr() { if (!publicUrl) return; const QRCode = await import("qrcode"); setQrUrl(await QRCode.toDataURL(publicUrl, { width: 900, margin: 2, color: { dark: "#171914", light: "#ffffff" } })); setShowQr(true); }
  async function downloadPoster() {
    if (!publicUrl) return; const QRCode = await import("qrcode"); const { PDFDocument } = await import("pdf-lib"); const qr = await QRCode.toDataURL(publicUrl, { width: 900, margin: 1, color: { dark: "#171914", light: "#ffffff" } });
    const canvas = document.createElement("canvas"); canvas.width = 1240; canvas.height = 1754; const context = canvas.getContext("2d"); if (!context) return; context.fillStyle = "#f4f2ea"; context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = "#b8ff32"; context.fillRect(0, 0, canvas.width, 235); context.fillStyle = "#171914"; context.font = "800 42px Arial"; context.fillText("Relay", 90, 105); context.font = "700 24px Arial"; context.fillText("АГЕНТСКАЯ ПРОГРАММА", 90, 160); context.font = "700 58px Arial"; context.fillText(program.name.length > 36 ? `${program.name.slice(0, 34)}…` : program.name, 90, 330); context.font = "32px Arial"; context.fillText("Сканируйте QR-код и выберите задание", 90, 390);
    const image = new Image(); image.src = qr; await image.decode(); context.fillStyle = "#fff"; context.fillRect(170, 465, 900, 900); context.drawImage(image, 210, 505, 820, 820); context.fillStyle = "#171914"; context.font = "700 34px Arial"; context.textAlign = "center"; context.fillText(program.missions[0]?.rewardLabel || "Получайте награды за полезные действия", 620, 1450); context.font = "25px Arial"; context.fillText("Условия, статус и выплата — в кабинете агента", 620, 1510); context.font = "20px Arial"; context.fillStyle = "#66685f"; context.fillText(new URL(publicUrl).host, 620, 1630);
    const pngBytes = await fetch(canvas.toDataURL("image/png")).then((response) => response.arrayBuffer()); const pdf = await PDFDocument.create(); const page = pdf.addPage([595.28, 841.89]); const png = await pdf.embedPng(pngBytes); page.drawImage(png, { x: 0, y: 0, width: 595.28, height: 841.89 }); const saved = await pdf.save(); const pdfBytes = saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer; downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), `relay-${program.slug}-qr.pdf`);
  }

  function renderFormField(field: SubmissionFormField, index: number) {
    const system = field.semantic !== "CUSTOM";
    return <article className="form-field-editor" key={field.id}><header><div><small>{field.stage === "CONTACT" ? "ШАГ 1 · ДАННЫЕ" : "ШАГ 2 · ПОДТВЕРЖДЕНИЯ"}</small><strong>{field.label}</strong></div><div className="form-field-order"><button type="button" onClick={() => moveFormField(field.id, -1)} disabled={index === 0} aria-label="Поднять поле">↑</button><button type="button" onClick={() => moveFormField(field.id, 1)} disabled={index === (formDraft?.length ?? 0) - 1} aria-label="Опустить поле">↓</button>{!system && <button className="danger" type="button" onClick={() => removeFormField(field)} aria-label="Удалить поле">×</button>}</div></header><div className="form-field-editor-grid"><label className="builder-field"><span>Название</span><input value={field.label} onChange={(event) => updateFormField(field.id, { label: event.target.value })} /></label><label className="builder-field"><span>Тип</span><select value={field.type} disabled={system} onChange={(event) => updateFormField(field.id, { type: event.target.value as SubmissionFormField["type"] })}>{SUBMISSION_FIELD_TYPES.map((type) => <option value={type} key={type}>{formTypeNames[type]}</option>)}</select></label><label className="builder-field full"><span>Подсказка агенту</span><input value={field.description} onChange={(event) => updateFormField(field.id, { description: event.target.value })} /></label><label className="builder-field full"><span>Пример ответа</span><input value={field.placeholder} onChange={(event) => updateFormField(field.id, { placeholder: event.target.value })} /></label>{field.type === "SELECT" && <label className="builder-field full"><span>Варианты · по одному в строке</span><textarea rows={3} value={field.options.join("\n")} onChange={(event) => updateFormField(field.id, { options: event.target.value.split("\n") })} /></label>}</div><label className="form-required-toggle"><input type="checkbox" checked={field.required} onChange={(event) => updateFormField(field.id, { required: event.target.checked })} /><span>Обязательное поле</span></label></article>;
  }

  return <div className="dashboard-content module-content program-builder-page program-flow-page">
    <div className="builder-back"><Link href="/dashboard/programs">← Все программы</Link><span className={`program-status status-${program.status.toLowerCase()}`}>● {program.status === "ACTIVE" ? "Опубликована" : program.status === "PAUSED" ? "На паузе" : "Черновик"}</span></div>
    <div className="module-heading program-flow-heading"><div><span className="module-kicker">СОЗДАНИЕ ПРОГРАММЫ</span><h1>{steps[currentStepIndex].label}</h1><p>{steps[currentStepIndex].hint}. Шаг {currentStepIndex + 1} из {steps.length}.</p></div>{publicUrl && <div className="published-link-actions"><Link className="button button-ghost compact-button" href={publicUrl} target="_blank">Открыть страницу ↗</Link><button className="button button-ghost compact-button" type="button" onClick={prepareQr}>QR-код</button><button className="button button-primary compact-button" type="button" onClick={copyLink}>Копировать ссылку</button></div>}</div>
    <nav className="program-flow-stepper" aria-label="Этапы создания программы">{steps.map((item, index) => <button className={`${step === item.id ? "active" : ""} ${index < currentStepIndex || program.status === "ACTIVE" ? "done" : ""}`} type="button" onClick={() => setStepSafely(item.id)} key={item.id}><b>{index < currentStepIndex || program.status === "ACTIVE" ? "✓" : item.number}</b><span><strong>{item.label}</strong><small>{item.hint}</small></span></button>)}</nav>
    {notice && <div className={`inline-notice ${notice.type}`} role="status">{notice.text}</div>}

    {step === "basics" && <section className="panel program-flow-card program-basics-focus"><div className="program-flow-card-head"><span>01</span><div><h2>Что вы запускаете</h2><p>Эти три ответа помогают агенту сразу понять предложение.</p></div></div><div className="program-flow-fields"><label className="builder-field"><span>Название программы *</span><input value={program.name} onChange={(event) => updateProgram("name", event.target.value)} maxLength={100} /></label><label className="builder-field"><span>Короткое описание *</span><textarea rows={5} value={program.description} onChange={(event) => updateProgram("description", event.target.value)} placeholder="Что предлагает компания и кому это полезно" /></label><div className="builder-field-row"><label className="builder-field"><span>Главная цель</span><select value={program.goal} onChange={(event) => updateProgram("goal", event.target.value)}><option value="MIXED">Смешанная программа</option><option value="LEADS">Квалифицированные лиды</option><option value="DEALS">Оплаченные сделки</option><option value="BRAND">Узнаваемость и доверие</option><option value="ENGAGEMENT">Вовлечение агентов</option></select></label><label className="builder-field"><span>Валюта</span><select value={program.currency} onChange={(event) => updateProgram("currency", event.target.value)}><option>KZT</option><option>RUB</option><option>USD</option><option>EUR</option></select></label></div></div></section>}

    {step === "missions" && <section className="program-missions-stage"><div className="program-stage-intro"><div><span className="module-kicker">ЧТО ДЕЛАЕТ АГЕНТ</span><h2>Задания программы</h2><p>Все задания видны компактно. Откройте только то, которое хотите настроить.</p></div><button className="button button-primary" type="button" onClick={() => setShowTypePicker(true)}>＋ Добавить задание</button></div><div className="compact-mission-list">{program.missions.map((mission, index) => <article className={`compact-mission-card type-${mission.type.toLowerCase()}`} key={mission.id}><span className="compact-mission-number">{String(index + 1).padStart(2, "0")}</span><i>{typeIcons[mission.type]}</i><div className="compact-mission-main"><small>{typeNames[mission.type]}</small><h3>{mission.title || "Новое задание"}</h3><p>{mission.description || typeCopy[mission.type].summary}</p></div><div className="compact-mission-reward"><small>ВОЗНАГРАЖДЕНИЕ</small><strong>{rewardText(mission, program.currency)}</strong></div><span className={`compact-mission-status ${missionComplete(mission) ? "complete" : "attention"}`}>{missionComplete(mission) ? "✓ Готово" : "Нужно заполнить"}</span><div className="compact-mission-actions"><button type="button" onClick={() => moveMission(mission.id, -1)} disabled={index === 0} aria-label="Поднять задание">↑</button><button type="button" onClick={() => moveMission(mission.id, 1)} disabled={index === program.missions.length - 1} aria-label="Опустить задание">↓</button><button type="button" onClick={() => openMission(mission)}>Редактировать</button><button className="danger" type="button" onClick={() => void removeMission(mission)} aria-label="Удалить задание">×</button></div></article>)}</div><div className="mission-list-summary"><span><b>{completedMissionCount}</b> из {program.missions.length} заданий готовы</span><p>{completedMissionCount === program.missions.length ? "Можно переходить к условиям." : "Незаполненные задания можно сохранить как черновик, но нельзя опубликовать."}</p></div></section>}

    {step === "settings" && <section className="program-settings-stage"><div className="program-stage-intro"><div><span className="module-kicker">ВАЖНЫЕ НАСТРОЙКИ</span><h2>Условия и проверка</h2><p>Основные условия видит агент до начала работы. Редкие настройки раскрываются отдельно.</p></div></div><section className="panel program-flow-card"><div className="program-flow-card-head"><span>01</span><div><h2>Выплата и ограничения</h2><p>Укажите, когда агент получает награду и что ему нельзя делать.</p></div></div><div className="publication-grid"><label className="builder-field"><span>Когда и как выплачивается награда *</span><textarea rows={5} value={program.payoutTerms} onChange={(event) => updateProgram("payoutTerms", event.target.value)} /></label><label className="builder-field"><span>Юридические и этические ограничения *</span><textarea rows={5} value={program.legalTerms} onChange={(event) => updateProgram("legalTerms", event.target.value)} /></label></div></section><details className="panel program-advanced-settings"><summary><span><b>Дополнительные настройки</b><small>Срок программы и форма передачи результата</small></span><i>↓</i></summary><div className="program-advanced-content"><label className="builder-field publication-date"><span>Дата завершения · необязательно</span><input type="date" value={program.expiresAt?.slice(0, 10) ?? ""} onChange={(event) => updateProgram("expiresAt", event.target.value)} /></label><div className="result-form-summary"><div><span>ФОРМА РЕЗУЛЬТАТА</span><h3>{program.formFields.length} полей для агента</h3><p>{program.formFields.filter((field) => field.required).length} обязательных · данные и подтверждения</p></div><button className="button button-ghost" type="button" onClick={openFormEditor}>Настроить форму →</button></div></div></details></section>}

    {step === "review" && <section className="program-review-stage"><div className="program-stage-intro"><div><span className="module-kicker">ПЕРЕД ПУБЛИКАЦИЕЙ</span><h2>Что увидит агент</h2><p>Проверьте предложение человеческим взглядом — без внутренних настроек.</p></div></div><article className="program-review-hero"><span>АГЕНТСКАЯ ПРОГРАММА</span><h2>{program.name}</h2><p>{program.description}</p><div><small>КОМПАНИЯ ПРЕДЛАГАЕТ</small><strong>{program.missions.length} {program.missions.length === 1 ? "задание" : "задания"}</strong></div></article><div className="program-review-grid"><section><span className="module-kicker">ДОСТУПНЫЕ ЗАДАНИЯ</span><div>{program.missions.map((mission, index) => <article key={mission.id}><b>{String(index + 1).padStart(2, "0")}</b><div><small>{typeNames[mission.type]}</small><strong>{mission.title}</strong><p>{mission.description}</p></div><em>{rewardText(mission, program.currency)}</em></article>)}</div></section><aside><div><small>КАК ПОЛУЧИТЬ НАГРАДУ</small><p>{program.payoutTerms || "Условия выплаты ещё не заполнены."}</p></div><div><small>ПРАВИЛА</small><p>{program.legalTerms || "Ограничения ещё не заполнены."}</p></div><div><small>ФОРМА РЕЗУЛЬТАТА</small><p>{program.formFields.filter((field) => field.required).length} обязательных полей из {program.formFields.length}</p></div></aside></div>{validateForPublish() && <div className="publish-readiness"><span>Перед публикацией</span><p>{validateForPublish()}</p><button type="button" onClick={() => setStepSafely(completedMissionCount !== program.missions.length ? "missions" : "settings")}>Исправить →</button></div>}</section>}

    <footer className="program-flow-footer"><button className="button button-ghost" type="button" onClick={() => void persist("save")} disabled={pending !== null}>{pending === "save" ? "Сохраняем…" : "Сохранить черновик"}</button><span>{notice?.type === "success" ? notice.text : "Изменения хранятся в черновике до сохранения."}</span><div>{currentStepIndex > 0 && <button className="button button-ghost" type="button" onClick={() => setStepSafely(steps[currentStepIndex - 1].id)}>← Назад</button>}{step !== "review" ? <button className="button button-primary" type="button" onClick={nextStep}>Продолжить →</button> : program.status === "ACTIVE" ? <button className="button button-ghost" type="button" onClick={() => void persist("pause")} disabled={pending !== null}>{pending === "pause" ? "Ставим на паузу…" : "Поставить на паузу"}</button> : <button className="button button-primary" type="button" onClick={() => { if (window.confirm(`Опубликовать программу «${program.name}»?`)) void persist("publish"); }} disabled={pending !== null || Boolean(validateForPublish())}>{pending === "publish" ? "Публикуем…" : "Опубликовать программу"}</button>}</div></footer>

    {showTypePicker && <div className="relay-modal-backdrop"><button className="relay-modal-dismiss-layer" type="button" onClick={() => setShowTypePicker(false)} aria-label="Закрыть выбор типа" /><section className="relay-modal mission-type-modal" role="dialog" aria-modal="true" aria-labelledby="type-title"><button className="relay-modal-close" type="button" onClick={() => setShowTypePicker(false)} aria-label="Закрыть">×</button><span className="module-kicker">НОВОЕ ЗАДАНИЕ</span><h2 id="type-title">Что должен сделать агент?</h2><p>Выберите один тип. Дальше покажем только подходящие поля.</p><div className="mission-type-choice">{Object.entries(typeNames).map(([type, name]) => <button className={`type-${type.toLowerCase()}`} type="button" onClick={() => startMission(type)} key={type}><i>{typeIcons[type]}</i><span><strong>{name}</strong><small>{typeCopy[type].summary}</small></span><b>→</b></button>)}</div></section></div>}

    {missionDraft && <div className="program-drawer-backdrop"><button type="button" onClick={() => setMissionDraft(null)} aria-label="Закрыть редактор" /><aside className="program-drawer mission-editor-drawer" role="dialog" aria-modal="true" aria-labelledby="mission-drawer-title"><header><div><span>{typeIcons[missionDraft.type]} {typeNames[missionDraft.type]}</span><h2 id="mission-drawer-title">{missionDraftIsNew ? "Новое задание" : "Редактирование задания"}</h2><p>Изменения попадут в программу только после нажатия «Применить».</p></div><button type="button" onClick={() => setMissionDraft(null)} aria-label="Закрыть">×</button></header><div className="drawer-ai-assist"><div><strong>Нужен готовый черновик?</strong><span>Rela учтёт программу и не повторит существующие задания.</span></div><button type="button" onClick={() => void generateMissionDraft()} disabled={aiPending !== null}>{aiPending === "mission" ? "Rela создаёт…" : "✦ Создать с Rela"}</button></div><div className="drawer-form"><section><span className="drawer-section-label">ОБЯЗАТЕЛЬНОЕ</span><label className="builder-field"><span>Название задания *</span><input value={missionDraft.title} onChange={(event) => updateMissionDraft("title", event.target.value)} /></label><label className="builder-field"><span>{typeCopy[missionDraft.type].result} *</span><textarea rows={4} value={missionDraft.description} onChange={(event) => updateMissionDraft("description", event.target.value)} /></label><div className="reward-editor"><label className="builder-field"><span>Тип награды *</span><select value={missionDraft.rewardMode} onChange={(event) => updateMissionDraft("rewardMode", event.target.value)}><option value="FIXED">Фиксированная сумма</option><option value="PERCENT">Процент</option><option value="POINTS">Баллы</option><option value="NON_MONETARY">Неденежная</option></select></label><label className="builder-field"><span>Значение</span><input type="number" min="0" value={missionDraft.rewardValue} onChange={(event) => updateMissionDraft("rewardValue", Number(event.target.value))} /></label></div><label className="builder-field"><span>Как награду увидит агент *</span><input value={missionDraft.rewardLabel} onChange={(event) => updateMissionDraft("rewardLabel", event.target.value)} /></label></section><details open><summary><span>Инструкции и проверка</span><i>↓</i></summary><div><label className="builder-field"><span>Действия агента · по одному в строке</span><textarea rows={6} value={missionDraft.instructions.join("\n")} onChange={(event) => updateMissionDraft("instructions", event.target.value.split("\n"))} /></label><label className="builder-field"><span>{typeCopy[missionDraft.type].proof} · по одному в строке</span><textarea rows={4} value={missionDraft.proofRequirements.join("\n")} onChange={(event) => updateMissionDraft("proofRequirements", event.target.value.split("\n"))} /></label><label className="builder-field"><span>Правила проверки</span><textarea rows={4} value={missionDraft.verificationRules} onChange={(event) => updateMissionDraft("verificationRules", event.target.value)} /></label></div></details><details><summary><span>Материалы для агента</span><i>↓</i></summary><div className="mission-resource-box"><div><strong>Файл до 10 МБ</strong><p>Бриф, шаблон или пример. Для нового задания файл можно добавить после первого сохранения.</p></div><input ref={fileInput} type="file" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadResource(file); }} /><button type="button" disabled={fileBusy || missionDraft.id.startsWith("new-")} onClick={() => fileInput.current?.click()}>{fileBusy ? "Загружаем…" : "＋ Загрузить файл"}</button>{missionDraft.resources.length > 0 && <ul>{missionDraft.resources.map((resource) => <li key={resource.id}><a href={`/api/programs/${program.id}/missions/${missionDraft.id}/files?resource=${resource.id}`}>{resource.fileName}</a><button type="button" onClick={() => void removeResource(resource.id)}>×</button></li>)}</ul>}</div></details></div><footer><button className="button button-ghost" type="button" onClick={() => setMissionDraft(null)}>Отмена</button><button className="button button-primary" type="button" onClick={applyMissionDraft}>Применить задание</button></footer></aside></div>}

    {formDraft && <div className="program-drawer-backdrop"><button type="button" onClick={() => setFormDraft(null)} aria-label="Закрыть настройки формы" /><aside className="program-drawer form-editor-drawer" role="dialog" aria-modal="true" aria-labelledby="form-drawer-title"><header><div><span>ФОРМА РЕЗУЛЬТАТА</span><h2 id="form-drawer-title">Что заполнит агент</h2><p>Оставьте только данные, которые действительно нужны для проверки.</p></div><button type="button" onClick={() => setFormDraft(null)} aria-label="Закрыть">×</button></header><div className="drawer-ai-assist"><div><strong>Собрать форму автоматически</strong><span>Rela предложит короткий набор полей под текущие задания.</span></div><button type="button" onClick={() => void generateForm()} disabled={aiPending !== null}>{aiPending === "form" ? "Rela собирает…" : "✦ Собрать с Rela"}</button></div><div className="drawer-form form-drawer-content"><div className="form-drawer-toolbar"><span>{formDraft.length} полей · {formDraft.filter((field) => field.required).length} обязательных</span><button type="button" onClick={() => setShowFieldBuilder((value) => !value)}>＋ Добавить поле</button></div>{showFieldBuilder && <section className="inline-field-builder"><div className="form-field-editor-grid"><label className="builder-field"><span>Этап</span><select value={fieldDraft.stage} onChange={(event) => setFieldDraft((field) => ({ ...field, stage: event.target.value as SubmissionFormField["stage"] }))}><option value="CONTACT">Данные и результат</option><option value="CONTEXT">Подтверждения</option></select></label><label className="builder-field"><span>Тип поля</span><select value={fieldDraft.type} onChange={(event) => setFieldDraft((field) => ({ ...field, type: event.target.value as SubmissionFormField["type"] }))}>{SUBMISSION_FIELD_TYPES.map((type) => <option value={type} key={type}>{formTypeNames[type]}</option>)}</select></label><label className="builder-field full"><span>Название</span><input value={fieldDraft.label} onChange={(event) => setFieldDraft((field) => ({ ...field, label: event.target.value }))} /></label><label className="builder-field full"><span>Подсказка агенту</span><input value={fieldDraft.description} onChange={(event) => setFieldDraft((field) => ({ ...field, description: event.target.value }))} /></label></div><label className="form-required-toggle"><input type="checkbox" checked={fieldDraft.required} onChange={(event) => setFieldDraft((field) => ({ ...field, required: event.target.checked }))} /><span>Обязательное поле</span></label><div><button className="button button-ghost" type="button" onClick={() => void fillFieldWithAi()} disabled={aiPending !== null}>{aiPending === "field" ? "Rela думает…" : "✦ Заполнить с Rela"}</button><button className="button button-primary" type="button" onClick={addFormField}>Добавить</button></div></section>}<div className="submission-fields-list">{formDraft.map(renderFormField)}</div></div><footer><button className="button button-ghost" type="button" onClick={() => setFormDraft(null)}>Отмена</button><button className="button button-primary" type="button" onClick={applyFormDraft}>Применить форму</button></footer></aside></div>}

    {showQr && <div className="relay-modal-backdrop"><button className="relay-modal-dismiss-layer" type="button" onClick={() => setShowQr(false)} aria-label="Закрыть QR-код" /><section className="relay-modal qr-program-modal" role="dialog" aria-modal="true" aria-labelledby="qr-title"><button className="relay-modal-close" type="button" onClick={() => setShowQr(false)} aria-label="Закрыть">×</button><span className="module-kicker">ОФЛАЙН-ПРИГЛАШЕНИЕ</span><h2 id="qr-title">QR-код программы</h2><p>Код ведёт прямо на публичную страницу «{program.name}».</p>{qrUrl && <img src={qrUrl} alt={`QR-код программы ${program.name}`} />}<strong>{program.missions[0]?.rewardLabel}</strong><div><button className="button button-primary" type="button" onClick={() => void downloadPoster()}>Скачать A4 PDF</button><button className="button button-ghost" type="button" onClick={() => setShowQr(false)}>Готово</button></div></section></div>}
  </div>;
}

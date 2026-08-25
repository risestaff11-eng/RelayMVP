"use client";

import { useMemo, useRef, useState } from "react";
import { formatInteger } from "@/lib/format-display";
import type { MethodologyBrief } from "@/db/knowledge";

type Item = { id: string; kind: string; title: string; summary: string; content: string; agentAction: string; channel: string; salesStage: string; audience: string; sourceBasisJson: string; warningsJson: string; externalUrl: string | null; fileName: string | null; objectKey: string | null; status: string };
type Draft = { kind: string; title: string; summary: string; content: string; agentAction: string; channel: string; salesStage: string; audience: string; sourceBasis: string[]; warnings: string[] };
type Question = { id: string; label: string; question: string; placeholder: string };
type Answer = { question: string; answer: string };
type Flow = "idle" | "analyzing" | "questions" | "review" | "generating" | "materials" | "publishing" | "done";

const KIND_OPTIONS = [["OFFER", "Ценность продукта"], ["ICP", "Идеальный клиент"], ["SCRIPT", "Первый контакт"], ["DISCOVERY", "Квалификация"], ["OBJECTION", "Возражения"], ["PROCESS", "Сценарий продажи"], ["FOLLOW_UP", "Повторный контакт"], ["FAQ", "Вопросы и ответы"], ["CASE", "Кейс"], ["CHECKLIST", "Полевой чек-лист"], ["COMPLIANCE", "Ограничения"], ["LINK", "Ссылка"], ["FILE", "Файл"]] as const;
const CHANNELS = [["ALL", "Все каналы"], ["WHATSAPP", "WhatsApp"], ["CALL", "Звонок"], ["MEETING", "Встреча"], ["EMAIL", "Email"], ["SOCIAL", "Соцсети"]] as const;
const STAGES = [["PREPARE", "Подготовка"], ["OUTREACH", "Первый контакт"], ["QUALIFY", "Квалификация"], ["PRESENT", "Презентация"], ["FOLLOW_UP", "Повторный контакт"], ["CLOSE", "Передача результата"]] as const;
const CORE_KINDS = ["OFFER", "ICP", "SCRIPT", "DISCOVERY", "OBJECTION", "PROCESS"];
const KIND_LABELS = Object.fromEntries(KIND_OPTIONS);
const CHANNEL_LABELS = Object.fromEntries(CHANNELS);
const STAGE_LABELS = Object.fromEntries(STAGES);

function parseList(value: string) { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; } }

export function MethodologistEditor({ initialItems, initialBrief, tokenBalance, profileStatus }: { initialItems: Item[]; initialBrief: MethodologyBrief; tokenBalance: number; profileStatus: "CONFIRMED" | "DRAFT" | "MISSING" }) {
  const [items, setItems] = useState(initialItems);
  const [brief, setBrief] = useState(initialBrief);
  const [flow, setFlow] = useState<Flow>("idle");
  const [assistantMessage, setAssistantMessage] = useState("");
  const [summary, setSummary] = useState("");
  const [uncertainties, setUncertainties] = useState<string[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [manualBrief, setManualBrief] = useState(false);
  const [notice, setNotice] = useState("");
  const [balance, setBalance] = useState(tokenBalance);
  const [libraryFilter, setLibraryFilter] = useState("ALL");
  const [editing, setEditing] = useState<Item | null>(null);
  const [manualPending, setManualPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const publishedKinds = useMemo(() => new Set(items.filter((item) => item.status === "PUBLISHED").map((item) => item.kind)), [items]);
  const coverage = CORE_KINDS.filter((kind) => publishedKinds.has(kind)).length;
  const readiness = Math.round(coverage / CORE_KINDS.length * 100);
  const visibleItems = libraryFilter === "ALL" ? items : items.filter((item) => item.kind === libraryFilter);

  function updateBrief<K extends keyof MethodologyBrief>(key: K, value: MethodologyBrief[K]) { setBrief((current) => ({ ...current, [key]: value })); }
  function updateDraft(index: number, patch: Partial<Draft>) { setDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)); }

  async function runIntake(nextAnswers: Answer[] = answers) {
    setFlow("analyzing"); setNotice(""); setManualBrief(false);
    const response = await fetch("/api/company/knowledge/intake", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers: nextAnswers }) });
    const data = await response.json() as { needsInput?: boolean; message?: string; summary?: string; questions?: Question[]; uncertainties?: string[]; brief?: MethodologyBrief; tokenBalance?: number; error?: string };
    if (!response.ok || !data.brief) {
      setAssistantMessage(data.error || "Мне не удалось собрать достаточно данных автоматически. Давайте уточним главное.");
      setQuestions([{ id: "recovery", label: "Расскажите своими словами", question: "Что вы продаёте, кому это полезно и к какому следующему шагу должен привести агент?", placeholder: "Например: внедрение CRM для строительных компаний; агент должен познакомить нас с собственником…" }]);
      setQuestionIndex(0); setFlow("questions"); return;
    }
    setBrief(data.brief); setAssistantMessage(data.message || "Проверьте, правильно ли я понял задачу."); setSummary(data.summary || ""); setUncertainties(data.uncertainties || []);
    if (typeof data.tokenBalance === "number") setBalance(data.tokenBalance);
    if (data.needsInput && data.questions?.length) { setQuestions(data.questions); setQuestionIndex(0); setFlow("questions"); }
    else setFlow("review");
  }

  async function submitAnswer(event: React.FormEvent) {
    event.preventDefault();
    const value = answer.trim(); if (!value) return;
    const current = questions[questionIndex];
    const nextAnswers = [...answers, { question: current.question, answer: value }];
    setAnswers(nextAnswers); setAnswer("");
    if (questionIndex < questions.length - 1) setQuestionIndex((index) => index + 1);
    else await runIntake(nextAnswers);
  }

  async function saveBrief(value = brief) {
    const response = await fetch("/api/company/knowledge/brief", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value) });
    const data = await response.json() as { error?: string };
    if (!response.ok) { setNotice(data.error || "Не удалось сохранить подготовленный бриф"); return false; }
    return true;
  }

  async function createMaterials() {
    setFlow("generating"); setNotice("");
    if (!(await saveBrief())) { setFlow("review"); return; }
    const response = await fetch("/api/company/knowledge/generate", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const data = await response.json() as { items?: Draft[]; tokenBalance?: number; error?: string };
    if (!response.ok || !data.items) {
      setAssistantMessage(data.error || "Не получилось собрать материалы. Уточним контекст и попробуем ещё раз.");
      setQuestions([{ id: "generation-focus", label: "Что нужно учесть", question: "Что обязательно должен знать агент перед первым разговором с клиентом?", placeholder: "Ключевые условия, ограничения, важные факты…" }]);
      setQuestionIndex(0); setFlow("questions"); return;
    }
    setDrafts(data.items); if (typeof data.tokenBalance === "number") setBalance(data.tokenBalance); setFlow("materials");
  }

  async function publishDrafts() {
    setFlow("publishing"); setNotice("");
    const response = await fetch("/api/company/knowledge/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: drafts }) });
    const data = await response.json() as { items?: Item[]; error?: string };
    if (response.ok && data.items) { setItems((current) => [...current, ...data.items!]); setDrafts([]); setFlow("done"); setNotice("Готово. База знаний опубликована в кабинете агента."); }
    else { setNotice(data.error || "Не удалось опубликовать материалы"); setFlow("materials"); }
  }

  async function saveManual(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setManualPending(true); setNotice("");
    const response = await fetch("/api/company/knowledge", { method: "POST", body: new FormData(event.currentTarget) });
    const data = await response.json() as { item?: Item; error?: string };
    if (response.ok && data.item) { setItems((current) => [...current, data.item!]); formRef.current?.reset(); setNotice("Материал опубликован для агентов."); }
    else setNotice(data.error || "Не удалось сохранить материал");
    setManualPending(false);
  }

  async function saveEditing() {
    if (!editing) return; setManualPending(true); setNotice("");
    const response = await fetch("/api/company/knowledge", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(editing) });
    const data = await response.json() as { item?: Item; error?: string };
    if (response.ok && data.item) { setItems((current) => current.map((item) => item.id === data.item!.id ? data.item! : item)); setEditing(null); setNotice("Изменения опубликованы для агентов."); }
    else setNotice(data.error || "Не удалось обновить материал"); setManualPending(false);
  }

  async function remove(id: string) {
    if (!window.confirm("Удалить материал из базы знаний?")) return;
    const response = await fetch(`/api/company/knowledge?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (response.ok) { setItems((current) => current.filter((item) => item.id !== id)); setNotice("Материал удалён."); }
  }

  return <div className="dashboard-content module-content methodologist-page">
    <div className="module-heading methodologist-heading"><div><span className="module-kicker">AI-МЕТОДОЛОГ</span><h1>Подготовьте агентов к продажам</h1><p>AI сам изучит компанию, задаст только необходимые вопросы и соберёт готовую полевую базу.</p></div><div className="assistant-token-balance"><small>AI-КРЕДИТЫ</small><strong>{formatInteger(balance)}</strong></div></div>

    <section className="methodologist-simple-start">
      <div className="methodologist-ai-intro"><span>✦</span><div><small>RELA СДЕЛАЕТ ЗА ВАС</small><h2>От профиля компании до готовых материалов</h2><p>Rela определит, что продаёт компания, кому это нужно, что говорить агенту, какие вопросы задавать и как отвечать на возражения.</p><ul><li>сама заполнит методологический бриф;</li><li>уточнит только недостающие факты;</li><li>даст готовый вариант на подтверждение;</li><li>опубликует материалы только после вашего решения.</li></ul></div></div>
      <div className="methodologist-start-side"><div><small>ГОТОВНОСТЬ БАЗЫ</small><strong>{readiness}%</strong><span>{coverage} из {CORE_KINDS.length} основных блоков опубликовано</span><i><b style={{ width: `${readiness}%` }} /></i></div><button className="button button-primary" disabled={["analyzing", "generating", "publishing"].includes(flow)} type="button" onClick={() => void runIntake([])}>{flow === "analyzing" ? "Изучаю компанию…" : "✦ Подготовить материалы"}</button><small className={`profile-source-status status-${profileStatus.toLowerCase()}`}>{profileStatus === "CONFIRMED" ? "Профиль компании подтверждён" : "AI дополнит данные в диалоге"}</small></div>
    </section>

    {flow === "analyzing" && <section className="panel methodologist-thinking" aria-live="polite"><span>✦</span><div><strong>AI-методолог изучает компанию</strong><p>Проверяю профиль, программы и задания. Это может занять до минуты.</p></div><i /></section>}

    {flow === "questions" && questions[questionIndex] && <section className="methodologist-chat"><header><div><span>✦</span><div><strong>AI-Методолог</strong><small>уточняет только важное</small></div></div><b>{questionIndex + 1} из {questions.length}</b></header><div className="methodologist-chat-body">{assistantMessage && <p className="ai-bubble">{assistantMessage}</p>}{answers.map((item) => <div className="chat-history" key={`${item.question}-${item.answer}`}><p>{item.question}</p><strong>{item.answer}</strong></div>)}<div className="ai-question"><small>{questions[questionIndex].label}</small><h2>{questions[questionIndex].question}</h2></div><form onSubmit={submitAnswer}><textarea rows={4} value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder={questions[questionIndex].placeholder} /><button className="button button-primary" disabled={!answer.trim()} type="submit">Ответить <span>→</span></button></form></div></section>}

    {(flow === "review" || manualBrief) && <section className="panel methodologist-confirm"><header><span>✦</span><div><small>AI-МЕТОДОЛОГ</small><h2>Вот что я понял</h2><p>{summary || "Проверьте ключевые выводы. Если всё верно — просто нажмите «Готово»."}</p></div></header>{!manualBrief ? <><div className="methodologist-confirm-grid"><article><small>ЧТО ПРЕДЛАГАЕМ</small><p>{brief.offer || "Нужно уточнить"}</p></article><article><small>КОГО ИЩЕМ</small><p>{brief.idealCustomer || "Нужно уточнить"}</p></article><article><small>С КЕМ ГОВОРИМ</small><p>{brief.decisionMakers || "Будет определено по ситуации"}</p></article><article><small>СЛЕДУЮЩИЙ ШАГ</small><p>{brief.nextStep || "Нужно уточнить"}</p></article></div>{uncertainties.length > 0 && <details className="methodologist-uncertainties"><summary>Что можно дополнить позже · {uncertainties.length}</summary><ul>{uncertainties.map((item) => <li key={item}>{item}</li>)}</ul></details>}<div className="methodologist-confirm-actions"><button className="button button-primary" type="button" onClick={() => void createMaterials()}>Готово — создать материалы</button><button className="button button-secondary" type="button" onClick={() => setManualBrief(true)}>Редактировать вручную</button></div></> : <BriefEditor brief={brief} updateBrief={updateBrief} onCancel={() => setManualBrief(false)} onContinue={async () => { if (await saveBrief()) { setManualBrief(false); setFlow("review"); setSummary("Изменения сохранены. Теперь можно создать материалы."); } }} />}</section>}

    {flow === "generating" && <section className="panel methodologist-thinking" aria-live="polite"><span>✦</span><div><strong>Создаю полевой комплект</strong><p>Готовлю ценность продукта, портрет клиента, скрипты, квалификацию, возражения и чек-лист.</p></div><i /></section>}

    {flow === "materials" && <section className="panel knowledge-review"><div className="panel-header"><div><span className="methodologist-step-number">ПРОВЕРКА</span><h2>Материалы готовы</h2><p>Можно сразу подтвердить весь комплект или открыть любой материал и исправить формулировку.</p></div><strong>{drafts.length} материалов</strong></div><div className="knowledge-drafts simple-drafts">{drafts.map((draft, index) => <details key={`${draft.kind}-${index}`} open={index === 0}><summary><span>{String(index + 1).padStart(2, "0")}</span><div><small>{KIND_LABELS[draft.kind] || draft.kind}</small><strong>{draft.title}</strong><p>{draft.summary}</p></div><b>Редактировать</b></summary><div className="draft-editor"><div className="draft-meta-row"><label><span>Этап</span><select value={draft.salesStage} onChange={(event) => updateDraft(index, { salesStage: event.target.value })}>{STAGES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Канал</span><select value={draft.channel} onChange={(event) => updateDraft(index, { channel: event.target.value })}>{CHANNELS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div><label><span>Название</span><input value={draft.title} onChange={(event) => updateDraft(index, { title: event.target.value })} /></label><label><span>Когда использовать</span><input value={draft.summary} onChange={(event) => updateDraft(index, { summary: event.target.value })} /></label><label><span>Материал для агента</span><textarea rows={10} value={draft.content} onChange={(event) => updateDraft(index, { content: event.target.value })} /></label><label><span>Следующее действие</span><textarea rows={2} value={draft.agentAction} onChange={(event) => updateDraft(index, { agentAction: event.target.value })} /></label>{draft.warnings.length > 0 && <div className="draft-warning"><strong>Проверьте:</strong>{draft.warnings.map((item) => <span key={item}>! {item}</span>)}</div>}</div></details>)}</div><div className="knowledge-publish-bar"><div><strong>Решение всегда остаётся за вами</strong><span>До подтверждения агенты не видят эти материалы.</span></div><button className="button button-primary" type="button" onClick={() => void publishDrafts()}>Готово — опубликовать всё</button></div></section>}

    {flow === "publishing" && <section className="panel methodologist-thinking"><span>✓</span><div><strong>Публикую подтверждённую базу</strong><p>Материалы появятся у агентов после завершения.</p></div><i /></section>}
    {notice && <div className="inline-notice methodologist-notice" role="status" aria-live="polite">{notice}</div>}

    <section className="panel knowledge-library"><div className="panel-header"><div><span className="methodologist-step-number">ОПУБЛИКОВАНО</span><h2>База агента</h2><p>{items.filter((item) => item.status === "PUBLISHED").length} материалов доступны агентам.</p></div><label className="knowledge-library-filter"><span>Показать</span><select value={libraryFilter} onChange={(event) => setLibraryFilter(event.target.value)}><option value="ALL">Все материалы</option>{KIND_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>{visibleItems.length ? <div className="knowledge-library-list">{visibleItems.map((item) => editing?.id === item.id ? <article className="knowledge-library-edit" key={item.id}><div className="draft-meta-row"><label><span>Тип</span><select value={editing.kind} onChange={(event) => setEditing({ ...editing, kind: event.target.value })}>{KIND_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Этап</span><select value={editing.salesStage} onChange={(event) => setEditing({ ...editing, salesStage: event.target.value })}>{STAGES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div><input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} /><input value={editing.summary} onChange={(event) => setEditing({ ...editing, summary: event.target.value })} /><textarea rows={8} value={editing.content} onChange={(event) => setEditing({ ...editing, content: event.target.value })} /><textarea rows={2} value={editing.agentAction} onChange={(event) => setEditing({ ...editing, agentAction: event.target.value })} /><div className="knowledge-edit-actions"><button className="button button-primary" type="button" disabled={manualPending} onClick={() => void saveEditing()}>Сохранить</button><button className="button button-secondary" type="button" onClick={() => setEditing(null)}>Отмена</button></div></article> : <article key={item.id}><div className="knowledge-item-type"><span>{KIND_LABELS[item.kind] || item.kind}</span><small>{STAGE_LABELS[item.salesStage] || "Подготовка"} · {CHANNEL_LABELS[item.channel] || "Все каналы"}</small></div><div><strong>{item.title}</strong>{item.summary && <p>{item.summary}</p>}<div className="knowledge-item-preview">{item.content || item.fileName || item.externalUrl}</div>{item.agentAction && <em>→ {item.agentAction}</em>}{parseList(item.warningsJson).length > 0 && <span className="knowledge-review-flag">Нужно проверить: {parseList(item.warningsJson).length}</span>}</div><div className="knowledge-item-actions"><button type="button" onClick={() => setEditing({ ...item })}>Изменить</button><button className="danger" type="button" onClick={() => void remove(item.id)}>Удалить</button></div></article>)}</div> : <div className="partner-empty-state"><strong>База знаний пока пуста</strong><p>Нажмите «Подготовить материалы» — AI сделает основную работу.</p></div>}</section>

    <details className="panel methodologist-own-material"><summary><span>＋</span><div><strong>Добавить свой материал</strong><small>Необязательно: файл, ссылка или готовый внутренний скрипт</small></div></summary><form ref={formRef} className="methodologist-form" onSubmit={saveManual}><div className="methodologist-form-row"><label><span>Тип</span><select name="kind" defaultValue="SCRIPT">{KIND_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Этап</span><select name="salesStage" defaultValue="PREPARE">{STAGES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Канал</span><select name="channel" defaultValue="ALL">{CHANNELS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div><label><span>Название *</span><input name="title" required maxLength={120} /></label><label><span>Когда использовать</span><input name="summary" maxLength={300} /></label><label><span>Содержание</span><textarea name="content" rows={7} /></label><label><span>Действие агента</span><input name="agentAction" maxLength={500} /></label><label><span>Ссылка</span><input name="externalUrl" type="url" placeholder="https://" /></label><label><span>Файл до 10 МБ</span><input name="file" type="file" /></label><button className="button button-secondary" disabled={manualPending} type="submit">Опубликовать материал</button></form></details>
  </div>;
}

function BriefEditor({ brief, updateBrief, onCancel, onContinue }: { brief: MethodologyBrief; updateBrief: <K extends keyof MethodologyBrief>(key: K, value: MethodologyBrief[K]) => void; onCancel: () => void; onContinue: () => void }) {
  return <div className="simple-brief-editor"><div className="methodologist-brief-grid"><label className="span-2"><span>Что предлагает агент *</span><textarea rows={3} value={brief.offer} onChange={(event) => updateBrief("offer", event.target.value)} /></label><label><span>Идеальный клиент *</span><textarea rows={3} value={brief.idealCustomer} onChange={(event) => updateBrief("idealCustomer", event.target.value)} /></label><label><span>С кем говорить</span><textarea rows={3} value={brief.decisionMakers} onChange={(event) => updateBrief("decisionMakers", event.target.value)} /></label><label><span>Какие проблемы распознавать</span><textarea rows={3} value={brief.customerProblems} onChange={(event) => updateBrief("customerProblems", event.target.value)} /></label><label><span>Следующий шаг *</span><textarea rows={3} value={brief.nextStep} onChange={(event) => updateBrief("nextStep", event.target.value)} /></label><label><span>Факты и доказательства</span><textarea rows={3} value={brief.proofPoints} onChange={(event) => updateBrief("proofPoints", event.target.value)} /></label><label><span>Что запрещено обещать</span><textarea rows={3} value={brief.mustNotSay} onChange={(event) => updateBrief("mustNotSay", event.target.value)} /></label></div><div className="methodologist-confirm-actions"><button className="button button-primary" type="button" onClick={onContinue}>Сохранить и продолжить</button><button className="button button-secondary" type="button" onClick={onCancel}>Отмена</button></div></div>;
}

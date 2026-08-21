"use client";

import { useMemo, useRef, useState } from "react";
import { formatInteger } from "@/lib/format-display";
import type { MethodologyBrief } from "@/db/knowledge";

type Item = {
  id: string;
  kind: string;
  title: string;
  summary: string;
  content: string;
  agentAction: string;
  channel: string;
  salesStage: string;
  audience: string;
  sourceBasisJson: string;
  warningsJson: string;
  externalUrl: string | null;
  fileName: string | null;
  objectKey: string | null;
  status: string;
};

type Draft = {
  kind: string;
  title: string;
  summary: string;
  content: string;
  agentAction: string;
  channel: string;
  salesStage: string;
  audience: string;
  sourceBasis: string[];
  warnings: string[];
};

const KIND_OPTIONS = [
  ["OFFER", "Ценность продукта"], ["ICP", "Идеальный клиент"], ["SCRIPT", "Первый контакт"],
  ["DISCOVERY", "Квалификация"], ["OBJECTION", "Возражения"], ["PROCESS", "Сценарий продажи"],
  ["FOLLOW_UP", "Повторный контакт"], ["FAQ", "Вопросы и ответы"], ["CASE", "Кейс"],
  ["CHECKLIST", "Полевой чек-лист"], ["COMPLIANCE", "Ограничения"], ["LINK", "Ссылка"], ["FILE", "Файл"],
] as const;
const AI_KINDS = KIND_OPTIONS.filter(([kind]) => !["LINK", "FILE"].includes(kind));
const CORE_KINDS = ["OFFER", "ICP", "SCRIPT", "DISCOVERY", "OBJECTION", "PROCESS"];
const DEFAULT_KINDS = [...CORE_KINDS, "FOLLOW_UP", "CHECKLIST"];
const CHANNELS = [["ALL", "Все каналы"], ["WHATSAPP", "WhatsApp"], ["CALL", "Звонок"], ["MEETING", "Встреча"], ["EMAIL", "Email"], ["SOCIAL", "Соцсети"]] as const;
const STAGES = [["PREPARE", "Подготовка"], ["OUTREACH", "Первый контакт"], ["QUALIFY", "Квалификация"], ["PRESENT", "Презентация"], ["FOLLOW_UP", "Повторный контакт"], ["CLOSE", "Передача результата"]] as const;
const CHANNEL_LABELS = Object.fromEntries(CHANNELS);
const STAGE_LABELS = Object.fromEntries(STAGES);
const KIND_LABELS = Object.fromEntries(KIND_OPTIONS);

function parseList(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function MethodologistEditor({ initialItems, initialBrief, tokenBalance, profileStatus }: { initialItems: Item[]; initialBrief: MethodologyBrief; tokenBalance: number; profileStatus: "CONFIRMED" | "DRAFT" | "MISSING" }) {
  const [items, setItems] = useState(initialItems);
  const [brief, setBrief] = useState(initialBrief);
  const [selectedKinds, setSelectedKinds] = useState(DEFAULT_KINDS);
  const [focus, setFocus] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [packSummary, setPackSummary] = useState("");
  const [missingFacts, setMissingFacts] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<"" | "brief" | "generate" | "publish" | "manual" | "edit">("");
  const [balance, setBalance] = useState(tokenBalance);
  const [libraryFilter, setLibraryFilter] = useState("ALL");
  const [editing, setEditing] = useState<Item | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const publishedKinds = useMemo(() => new Set(items.filter((item) => item.status === "PUBLISHED").map((item) => item.kind)), [items]);
  const coverage = CORE_KINDS.filter((kind) => publishedKinds.has(kind)).length;
  const readiness = Math.round(coverage / CORE_KINDS.length * 100);
  const briefFields = [brief.offer, brief.idealCustomer, brief.decisionMakers, brief.customerProblems, brief.nextStep, brief.proofPoints];
  const briefReadiness = Math.round(briefFields.filter((value) => value.trim()).length / briefFields.length * 100);
  const visibleItems = libraryFilter === "ALL" ? items : items.filter((item) => item.kind === libraryFilter);

  function updateBrief<K extends keyof MethodologyBrief>(key: K, value: MethodologyBrief[K]) {
    setBrief((current) => ({ ...current, [key]: value }));
  }

  async function saveBrief(showNotice = true) {
    setPending("brief");
    if (showNotice) setNotice("");
    const response = await fetch("/api/company/knowledge/brief", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(brief) });
    const data = await response.json() as { error?: string };
    setPending("");
    if (!response.ok) { setNotice(data.error || "Не удалось сохранить бриф"); return false; }
    if (showNotice) setNotice("Бриф сохранён. Gemini будет использовать его как источник фактов.");
    return true;
  }

  async function saveManual(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending("manual"); setNotice("");
    const response = await fetch("/api/company/knowledge", { method: "POST", body: new FormData(event.currentTarget) });
    const data = await response.json() as { item?: Item; error?: string };
    if (response.ok && data.item) { setItems((current) => [...current, data.item!]); formRef.current?.reset(); setNotice("Материал опубликован для агентов."); }
    else setNotice(data.error || "Не удалось сохранить материал");
    setPending("");
  }

  async function generate() {
    if (!(await saveBrief(false))) return;
    setPending("generate"); setNotice("Gemini собирает полевой комплект из подтверждённых фактов…"); setMissingFacts([]);
    const response = await fetch("/api/company/knowledge/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kinds: selectedKinds, focus }) });
    const data = await response.json() as { items?: Draft[]; packSummary?: string; missingFacts?: string[]; tokenBalance?: number; creditsSpent?: number; error?: string };
    if (response.ok && data.items) {
      setDrafts(data.items); setPackSummary(data.packSummary || ""); setMissingFacts(data.missingFacts || []);
      if (typeof data.tokenBalance === "number") setBalance(data.tokenBalance);
      setNotice(`Черновики готовы. Проверьте факты и формулировки перед публикацией${data.creditsSpent ? ` · списано ${formatInteger(data.creditsSpent)} AI-кредитов` : ""}.`);
    } else setNotice(data.error || "Не удалось создать материалы");
    setPending("");
  }

  async function publishDrafts() {
    setPending("publish"); setNotice("");
    const response = await fetch("/api/company/knowledge/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: drafts }) });
    const data = await response.json() as { items?: Item[]; error?: string };
    if (response.ok && data.items) { setItems((current) => [...current, ...data.items!]); setDrafts([]); setMissingFacts([]); setPackSummary(""); setNotice("Комплект подтверждён и опубликован в кабинете агента."); }
    else setNotice(data.error || "Не удалось опубликовать черновики");
    setPending("");
  }

  async function saveEditing() {
    if (!editing) return;
    setPending("edit"); setNotice("");
    const response = await fetch("/api/company/knowledge", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(editing) });
    const data = await response.json() as { item?: Item; error?: string };
    if (response.ok && data.item) { setItems((current) => current.map((item) => item.id === data.item!.id ? data.item! : item)); setEditing(null); setNotice("Изменения опубликованы для агентов."); }
    else setNotice(data.error || "Не удалось обновить материал");
    setPending("");
  }

  async function remove(id: string) {
    if (!window.confirm("Удалить материал из базы знаний?")) return;
    const response = await fetch(`/api/company/knowledge?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (response.ok) { setItems((current) => current.filter((item) => item.id !== id)); setNotice("Материал удалён."); }
  }

  function updateDraft(index: number, patch: Partial<Draft>) {
    setDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  return <div className="dashboard-content module-content methodologist-page">
    <div className="module-heading methodologist-heading"><div><span className="module-kicker">AI-МЕТОДОЛОГ</span><h1>Подготовьте агента к продаже</h1><p>Соберите единый полевой playbook: кого искать, что говорить, как квалифицировать и какой следующий шаг получить.</p></div><div className="assistant-token-balance"><small>AI-КРЕДИТЫ</small><strong>{formatInteger(balance)}</strong></div></div>

    <section className="methodologist-readiness">
      <div><span>ГОТОВНОСТЬ ПОЛЕВОЙ БАЗЫ</span><strong>{readiness}%</strong><p>{coverage} из {CORE_KINDS.length} обязательных блоков опубликовано</p></div>
      <div className="readiness-track" aria-label={`Готовность ${readiness}%`}><i style={{ width: `${readiness}%` }} /></div>
      <div className="coverage-chips">{CORE_KINDS.map((kind) => <span className={publishedKinds.has(kind) ? "is-ready" : ""} key={kind}>{publishedKinds.has(kind) ? "✓" : "+"} {KIND_LABELS[kind]}</span>)}</div>
    </section>

    <div className="methodologist-steps" aria-label="Этапы подготовки"><span className="is-active">01 · Бриф</span><span>02 · Генерация</span><span>03 · Проверка</span><span>04 · Публикация</span></div>

    <section className="panel methodologist-brief">
      <div className="panel-header"><div><span className="methodologist-step-number">01</span><h2>Контекст для методолога</h2><p>Чем точнее факты, тем меньше общих фраз и ручных исправлений.</p></div><div className={`profile-source-status status-${profileStatus.toLowerCase()}`}><i />{profileStatus === "CONFIRMED" ? "AI-профиль подтверждён" : profileStatus === "DRAFT" ? "AI-профиль не подтверждён" : "AI-профиля пока нет"}</div></div>
      <div className="brief-progress"><span>Бриф заполнен на {briefReadiness}%</span><i><b style={{ width: `${briefReadiness}%` }} /></i></div>
      <div className="methodologist-brief-grid">
        <label className="span-2"><span>Что именно агент предлагает *</span><textarea rows={3} value={brief.offer} onChange={(event) => updateBrief("offer", event.target.value)} placeholder="Продукт, услуга, формат и ключевая ценность без рекламных обещаний" /></label>
        <label><span>Идеальный клиент *</span><textarea rows={3} value={brief.idealCustomer} onChange={(event) => updateBrief("idealCustomer", event.target.value)} placeholder="Тип компании, отрасль, размер, ситуация" /></label>
        <label><span>С кем нужно говорить</span><textarea rows={3} value={brief.decisionMakers} onChange={(event) => updateBrief("decisionMakers", event.target.value)} placeholder="Роли и должности принимающих решение" /></label>
        <label><span>Какие проблемы распознавать</span><textarea rows={3} value={brief.customerProblems} onChange={(event) => updateBrief("customerProblems", event.target.value)} placeholder="Наблюдаемые симптомы и триггеры покупки" /></label>
        <label><span>Цель работы агента</span><input value={brief.salesGoal} onChange={(event) => updateBrief("salesGoal", event.target.value)} /></label>
        <label><span>Желаемый следующий шаг *</span><input value={brief.nextStep} onChange={(event) => updateBrief("nextStep", event.target.value)} placeholder="Например: договориться о 20-минутной встрече" /></label>
        <label><span>Факты и доказательства</span><textarea rows={3} value={brief.proofPoints} onChange={(event) => updateBrief("proofPoints", event.target.value)} placeholder="Цифры, результаты, кейсы и условия — только то, что можно подтвердить" /></label>
        <label><span>Что обязательно сказать</span><textarea rows={3} value={brief.mustSay} onChange={(event) => updateBrief("mustSay", event.target.value)} placeholder="Важные условия и корректные формулировки" /></label>
        <label><span>Что запрещено обещать</span><textarea rows={3} value={brief.mustNotSay} onChange={(event) => updateBrief("mustNotSay", event.target.value)} placeholder="Гарантии, цены или заявления, которые агент не должен использовать" /></label>
        <label><span>Тон общения</span><select value={brief.tone} onChange={(event) => updateBrief("tone", event.target.value)}><option>Деловой и человеческий</option><option>Короткий и прямой</option><option>Экспертный и спокойный</option><option>Дружелюбный и неформальный</option></select></label>
        <label><span>Язык материалов</span><select value={brief.language} onChange={(event) => updateBrief("language", event.target.value)}><option>Русский</option><option>Казахский</option><option>Русский и казахский</option><option>Английский</option></select></label>
        <fieldset className="span-2 channel-picker"><legend>Где агент общается с клиентом</legend>{CHANNELS.filter(([value]) => value !== "ALL").map(([value, label]) => <label key={value}><input type="checkbox" checked={brief.channels.includes(value)} onChange={(event) => updateBrief("channels", event.target.checked ? [...brief.channels, value] : brief.channels.filter((channel) => channel !== value))} /><span>{label}</span></label>)}</fieldset>
      </div>
      <button className="button button-secondary" disabled={Boolean(pending)} type="button" onClick={() => void saveBrief()}>Сохранить бриф <span>→</span></button>
    </section>

    <section className="methodologist-grid methodologist-generation-grid">
      <div className="panel ai-methodologist-panel"><div className="panel-header"><div><span className="methodologist-step-number">02</span><h2>Собрать комплект с Gemini</h2><p>Выберите только то, что агенту действительно понадобится в поле.</p></div></div>
        <div className="knowledge-pack-picker">{AI_KINDS.map(([kind, label]) => <label className={selectedKinds.includes(kind) ? "is-selected" : ""} key={kind}><input type="checkbox" checked={selectedKinds.includes(kind)} onChange={(event) => setSelectedKinds((current) => event.target.checked ? [...current, kind] : current.filter((item) => item !== kind))} /><span><b>{label}</b><small>{CORE_KINDS.includes(kind) ? "основной блок" : "дополнительно"}</small></span></label>)}</div>
        <label className="generation-focus"><span>Особый фокус</span><textarea rows={3} value={focus} onChange={(event) => setFocus(event.target.value)} placeholder="Например: холодный звонок собственнику небольшой клиники. Поле можно оставить пустым." /></label>
        <button className="button button-primary generate-playbook-button" disabled={Boolean(pending) || selectedKinds.length < 3} type="button" onClick={() => void generate()}>✦ {pending === "generate" ? "Gemini готовит комплект…" : `Создать ${selectedKinds.length} материалов`}</button>
        <p className="ai-grounding-note">Gemini использует профиль, бриф, активные программы и задания. Неподтверждённые данные помечаются для проверки.</p>
      </div>

      <div className="panel methodologist-manual"><div className="panel-header"><div><h2>Добавить свой материал</h2><p>Для готового скрипта, документа, ссылки или внутренней инструкции.</p></div></div>
        <form ref={formRef} className="methodologist-form" onSubmit={saveManual}>
          <div className="methodologist-form-row"><label><span>Тип</span><select name="kind" defaultValue="SCRIPT">{KIND_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Этап</span><select name="salesStage" defaultValue="PREPARE">{STAGES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Канал</span><select name="channel" defaultValue="ALL">{CHANNELS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
          <label><span>Название *</span><input name="title" required maxLength={120} placeholder="Что агент найдёт внутри" /></label>
          <label><span>Когда использовать</span><input name="summary" maxLength={300} placeholder="Одна короткая подсказка" /></label>
          <label><span>Для кого</span><input name="audience" maxLength={500} placeholder="Роль клиента или ситуация" /></label>
          <label><span>Содержание</span><textarea name="content" rows={7} placeholder="Готовые фразы, шаги, вопросы или инструкция" /></label>
          <label><span>Действие агента</span><input name="agentAction" maxLength={500} placeholder="Что сделать после изучения материала" /></label>
          <label><span>Основание, по одному факту в строке</span><textarea name="sourceBasis" rows={3} placeholder="Подтверждённый факт о продукте или клиенте" /></label>
          <label><span>Внешняя ссылка</span><input name="externalUrl" type="url" placeholder="https://" /></label>
          <label className="knowledge-file-picker"><span>Файл до 10 МБ</span><input name="file" type="file" /></label>
          <button className="button button-secondary" disabled={Boolean(pending)} type="submit">Опубликовать материал <span>→</span></button>
        </form>
      </div>
    </section>

    {notice && <div className="inline-notice methodologist-notice" role="status" aria-live="polite">{notice}</div>}

    {drafts.length > 0 && <section className="panel knowledge-review"><div className="panel-header"><div><span className="methodologist-step-number">03</span><h2>Проверка перед публикацией</h2><p>{packSummary || "Проверьте каждый материал: агент увидит его именно в таком виде."}</p></div><strong>{drafts.length} черновиков</strong></div>
      {missingFacts.length > 0 && <div className="knowledge-gaps"><strong>Gemini не хватает фактов</strong><ul>{missingFacts.map((fact) => <li key={fact}>{fact}</li>)}</ul><p>Дополните бриф или аккуратно исправьте черновики ниже.</p></div>}
      <div className="knowledge-drafts">{drafts.map((draft, index) => <article key={`${draft.kind}-${index}`}>
        <header><span>{String(index + 1).padStart(2, "0")} · {KIND_LABELS[draft.kind] || draft.kind}</span><button type="button" onClick={() => setDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Удалить ${draft.title}`}>×</button></header>
        <div className="draft-meta-row"><label><span>Тип</span><select value={draft.kind} onChange={(event) => updateDraft(index, { kind: event.target.value })}>{AI_KINDS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Этап</span><select value={draft.salesStage} onChange={(event) => updateDraft(index, { salesStage: event.target.value })}>{STAGES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Канал</span><select value={draft.channel} onChange={(event) => updateDraft(index, { channel: event.target.value })}>{CHANNELS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
        <label><span>Название</span><input value={draft.title} onChange={(event) => updateDraft(index, { title: event.target.value })} /></label>
        <label><span>Когда использовать</span><input value={draft.summary} onChange={(event) => updateDraft(index, { summary: event.target.value })} /></label>
        <label><span>Для кого</span><input value={draft.audience} onChange={(event) => updateDraft(index, { audience: event.target.value })} /></label>
        <label><span>Материал для агента</span><textarea rows={10} value={draft.content} onChange={(event) => updateDraft(index, { content: event.target.value })} /></label>
        <label><span>Следующее действие агента</span><textarea rows={2} value={draft.agentAction} onChange={(event) => updateDraft(index, { agentAction: event.target.value })} /></label>
        <div className="draft-fact-check"><div><strong>Основано на фактах</strong>{draft.sourceBasis.map((fact) => <span key={fact}>✓ {fact}</span>)}</div>{draft.warnings.length > 0 && <div className="has-warnings"><strong>Проверить перед публикацией</strong>{draft.warnings.map((warning) => <span key={warning}>! {warning}</span>)}</div>}</div>
      </article>)}</div>
      <div className="knowledge-publish-bar"><div><strong>Публикация требует подтверждения</strong><span>Черновики не видны агентам, пока вы не нажмёте кнопку.</span></div><button className="button button-primary" disabled={Boolean(pending) || drafts.length === 0} type="button" onClick={() => void publishDrafts()}>{pending === "publish" ? "Публикуем…" : "Подтвердить и опубликовать"}</button></div>
    </section>}

    <section className="panel knowledge-library"><div className="panel-header"><div><span className="methodologist-step-number">04</span><h2>База агента</h2><p>{items.filter((item) => item.status === "PUBLISHED").length} материалов уже доступны агентам.</p></div><label className="knowledge-library-filter"><span>Показать</span><select value={libraryFilter} onChange={(event) => setLibraryFilter(event.target.value)}><option value="ALL">Все материалы</option>{KIND_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
      {visibleItems.length ? <div className="knowledge-library-list">{visibleItems.map((item) => editing?.id === item.id ? <article className="knowledge-library-edit" key={item.id}>
        <div className="draft-meta-row"><label><span>Тип</span><select value={editing.kind} onChange={(event) => setEditing({ ...editing, kind: event.target.value })}>{KIND_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Этап</span><select value={editing.salesStage} onChange={(event) => setEditing({ ...editing, salesStage: event.target.value })}>{STAGES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Канал</span><select value={editing.channel} onChange={(event) => setEditing({ ...editing, channel: event.target.value })}>{CHANNELS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
        <input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} />
        <input value={editing.summary} onChange={(event) => setEditing({ ...editing, summary: event.target.value })} placeholder="Когда использовать" />
        <input value={editing.audience} onChange={(event) => setEditing({ ...editing, audience: event.target.value })} placeholder="Для кого" />
        <textarea rows={8} value={editing.content} onChange={(event) => setEditing({ ...editing, content: event.target.value })} />
        <textarea rows={2} value={editing.agentAction} onChange={(event) => setEditing({ ...editing, agentAction: event.target.value })} placeholder="Следующее действие агента" />
        <div className="knowledge-edit-actions"><button className="button button-primary" type="button" disabled={pending === "edit"} onClick={() => void saveEditing()}>Сохранить</button><button className="button button-secondary" type="button" onClick={() => setEditing(null)}>Отмена</button></div>
      </article> : <article key={item.id}>
        <div className="knowledge-item-type"><span>{KIND_LABELS[item.kind] || item.kind}</span><small>{STAGE_LABELS[item.salesStage] || "Подготовка"} · {CHANNEL_LABELS[item.channel] || "Все каналы"}</small></div>
        <div><strong>{item.title}</strong>{item.summary && <p>{item.summary}</p>}<div className="knowledge-item-preview">{item.content || item.fileName || item.externalUrl}</div>{item.agentAction && <em>→ {item.agentAction}</em>}{parseList(item.warningsJson).length > 0 && <span className="knowledge-review-flag">Требует проверки: {parseList(item.warningsJson).length}</span>}</div>
        <div className="knowledge-item-actions"><button type="button" onClick={() => setEditing({ ...item })}>Изменить</button><button className="danger" type="button" onClick={() => void remove(item.id)}>Удалить</button></div>
      </article>)}</div> : <div className="partner-empty-state"><strong>В этом разделе пока нет материалов</strong><p>Соберите комплект с Gemini или добавьте первый материал вручную.</p></div>}
    </section>
  </div>;
}

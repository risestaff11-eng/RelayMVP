"use client";

import { useMemo, useState } from "react";
import { calculateCrmGoal, CRM_STAGES, crmStage, potentialForLead, type CrmStageId } from "@/lib/crm";
import { countRu, formatDateTime, formatMoney } from "@/lib/format-display";
import { reviewStatusNames, salesStatusNames, slaState } from "@/lib/workflow";

type Reward = { amount: number; currency: string; status: string; paidAt: string | null; partnerConfirmedAt: string | null; plannedAt: string | null } | null;
type Attachment = { id: string; objectKey: string | null; externalUrl: string | null; fileName: string; mimeType: string; size: number };
type Event = { id: string; fromStatus: string | null; toStatus: string; actorType: string; comment: string; createdAt: string };
type Answer = { fieldId: string; label: string; type: string; value: string | string[] };

export type CrmLead = {
  id: string; partnerName: string; partnerEmail: string; partnerPhone: string; missionTitle: string; programName: string;
  rewardMode: string; rewardValue: number; rewardLabel: string; currency: string; contactName: string; contactCompany: string;
  contactEmail: string; contactPhone: string; partnerComment: string; audioTranscript: string; submittedByClient: boolean;
  referralSource: string; customAnswers: Answer[]; companyComment: string; status: string; reviewStatus: string; salesStatus: string;
  ownershipStatus: string; reviewDueAt: string | null; estimatedDealAmount: number; dealAmount: number; createdAt: string;
  events: Event[]; attachments: Attachment[]; reward: Reward;
};

export type CrmSettings = { monthlyGoal: number; averageCheck: number; conversionRate: number; leadsPerAmbassador: number; currency: string };

const quickFilters = [
  ["ALL", "Все"], ["ACTION", "Ждут решения"], ["WORK", "В работе"], ["WAITING", "Ожидают оплаты"], ["CLOSED", "Закрыты"],
] as const;

function digits(value: string) {
  const raw = value.replace(/\D/g, "");
  return raw.length === 11 && raw.startsWith("8") ? `7${raw.slice(1)}` : raw;
}

function whatsapp(phone: string, text: string) {
  const normalized = digits(phone);
  return normalized ? `https://wa.me/${normalized}?text=${encodeURIComponent(text)}` : "";
}

function leadTitle(item: CrmLead) { return item.contactName || item.contactCompany || "Заявка без имени"; }
function sourceLabel(item: CrmLead) { return item.submittedByClient || item.referralSource === "CLIENT_SELF_SERVICE" ? "Клиент заполнил по ссылке" : "Передал рекомендатель"; }

function compactMoneyByCurrency(items: Array<{ amount: number; currency: string }>) {
  const totals = new Map<string, number>();
  for (const item of items) if (item.amount > 0) totals.set(item.currency, (totals.get(item.currency) || 0) + item.amount);
  return totals.size ? [...totals].map(([currency, amount]) => formatMoney(amount, currency)).join(" · ") : "Сумма не задана";
}

export function CrmWorkspace({ companyName, initialItems, initialSettings, initialSelectedId = "" }: { companyName: string; initialItems: CrmLead[]; initialSettings: CrmSettings; initialSelectedId?: string }) {
  const [items, setItems] = useState(initialItems);
  const [settings, setSettings] = useState(initialSettings);
  const [goalOpen, setGoalOpen] = useState(false);
  const [selected, setSelected] = useState<CrmLead | null>(() => initialItems.find((item) => item.id === initialSelectedId) || null);
  const [query, setQuery] = useState("");
  const [quick, setQuick] = useState<(typeof quickFilters)[number][0]>("ALL");
  const [program, setProgram] = useState("ALL");
  const [ambassador, setAmbassador] = useState("ALL");
  const [mobileStage, setMobileStage] = useState<CrmStageId>("NEW");
  const [pending, setPending] = useState("");
  const [notice, setNotice] = useState("");

  const programs = [...new Set(items.map((item) => item.programName))];
  const ambassadors = [...new Map(items.map((item) => [item.partnerEmail, item.partnerName || item.partnerEmail])).entries()];
  const filtered = useMemo(() => items.filter((item) => {
    const stage = crmStage(item);
    const haystack = `${leadTitle(item)} ${item.contactPhone} ${item.contactEmail} ${item.partnerName} ${item.partnerEmail} ${item.programName} ${item.missionTitle}`.toLowerCase();
    const quickMatch = quick === "ALL" || (quick === "ACTION" && ["NEW", "REVIEW"].includes(stage)) || (quick === "WORK" && stage === "WORK") || (quick === "WAITING" && stage === "WON") || (quick === "CLOSED" && stage === "CLOSED");
    return haystack.includes(query.trim().toLowerCase()) && quickMatch && (program === "ALL" || item.programName === program) && (ambassador === "ALL" || item.partnerEmail === ambassador);
  }), [items, query, quick, program, ambassador]);

  const goal = calculateCrmGoal(settings.monthlyGoal, settings.averageCheck, settings.conversionRate, settings.leadsPerAmbassador);
  const won = items.filter((item) => ["WON", "PAID"].includes(crmStage(item)) && item.currency === settings.currency);
  const fact = won.reduce((sum, item) => sum + Math.max(0, item.dealAmount || 0), 0);
  const openItems = items.filter((item) => !["WON", "PAID", "CLOSED"].includes(crmStage(item)) && item.currency === settings.currency);
  const potential = openItems.reduce((sum, item) => sum + potentialForLead(item, settings.averageCheck).amount, 0);
  const progress = goal.goal > 0 ? Math.min(100, Math.round(fact / goal.goal * 100)) : 0;

  async function patchLead(item: CrmLead, payload: Record<string, unknown>, success = "Карточка обновлена") {
    setPending(item.id); setNotice("");
    try {
      const body = { amount: item.rewardValue, estimatedDealAmount: item.estimatedDealAmount, dealAmount: item.dealAmount, comment: item.companyComment, ...payload };
      const response = await fetch(`/api/submissions/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(String(data.error || "Не удалось сохранить"));
      const next: CrmLead = { ...item, ...body, status: String(data.status || item.status), reviewStatus: String(data.reviewStatus || body.reviewStatus || item.reviewStatus), salesStatus: String(data.salesStatus || body.salesStatus || item.salesStatus), estimatedDealAmount: Number(data.estimatedDealAmount ?? body.estimatedDealAmount ?? item.estimatedDealAmount), dealAmount: Number(data.dealAmount ?? body.dealAmount ?? item.dealAmount), companyComment: String(body.comment ?? item.companyComment) };
      setItems((current) => current.map((row) => row.id === item.id ? next : row));
      setSelected((current) => current?.id === item.id ? next : current);
      setNotice(success);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Не удалось сохранить"); }
    finally { setPending(""); }
  }

  function move(item: CrmLead, stage: string) {
    if (stage === "WON" && item.rewardMode === "PERCENT" && !item.dealAmount) { setSelected(item); setNotice("Укажите сумму сделки перед фиксацией продажи."); return; }
    if (stage === "CLOSED" && ["PENDING", "REVIEWING"].includes(item.reviewStatus)) { setSelected(item); setNotice("При отказе укажите причину в комментарии и сохраните карточку."); return; }
    const payload = stage === "NEW" ? { reviewStatus: "PENDING", salesStatus: "NONE" } : stage === "REVIEW" ? { reviewStatus: "REVIEWING", salesStatus: "NONE" } : stage === "WORK" ? { reviewStatus: "ACCEPTED", salesStatus: "IN_PROGRESS" } : stage === "WON" ? { reviewStatus: "ACCEPTED", salesStatus: "WON" } : { reviewStatus: "ACCEPTED", salesStatus: "LOST" };
    void patchLead(item, payload, "Этап изменён");
  }

  return <div className="crm-workspace">
    <section className="crm-commandbar">
      <button className="crm-goal-card" type="button" onClick={() => setGoalOpen(true)}>
        <span><small>ЦЕЛЬ НА МЕСЯЦ</small><strong>{goal.goal ? formatMoney(goal.goal, settings.currency) : "Настроить цель"}</strong></span>
        <span className="crm-goal-progress"><i style={{ width: `${progress}%` }} /><em>{progress}%</em></span>
        <span className="crm-goal-edit">Изменить →</span>
      </button>
      <div className="crm-economics"><article><small>ФАКТ СДЕЛОК</small><strong>{formatMoney(fact, settings.currency)}</strong><span>Только состоявшиеся продажи</span></article><article><small>ПОТЕНЦИАЛ В РАБОТЕ</small><strong>{formatMoney(potential, settings.currency)}</strong><span>Точные и расчётные суммы</span></article><article><small>ОСТАЛОСЬ ДО ЦЕЛИ</small><strong>{formatMoney(Math.max(0, goal.goal - fact), settings.currency)}</strong><span>{goal.goal ? `${goal.payments} оплат · ${goal.leads} лидов · ${goal.ambassadors} амбассадоров` : "Задайте цель и средний чек"}</span></article></div>
    </section>

    <section className="crm-toolbar" aria-label="Поиск и фильтры CRM">
      <label className="crm-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Имя, телефон, компания или рекомендатель" /></label>
      <div className="crm-quick-filters">{quickFilters.map(([value, label]) => <button className={quick === value ? "active" : ""} onClick={() => setQuick(value)} type="button" key={value}>{label}</button>)}</div>
      <select value={program} onChange={(event) => setProgram(event.target.value)} aria-label="Программа"><option value="ALL">Все программы</option>{programs.map((item) => <option key={item}>{item}</option>)}</select>
      <select value={ambassador} onChange={(event) => setAmbassador(event.target.value)} aria-label="Рекомендатель"><option value="ALL">Все рекомендатели</option>{ambassadors.map(([email, name]) => <option value={email} key={email}>{name}</option>)}</select>
    </section>

    {notice && <div className="crm-notice" role="status">{notice}<button type="button" onClick={() => setNotice("")}>×</button></div>}
    <nav className="crm-mobile-stages" aria-label="Этап воронки">{CRM_STAGES.map((stage) => <button type="button" className={mobileStage === stage.id ? "active" : ""} onClick={() => setMobileStage(stage.id)} key={stage.id}>{stage.label}<b>{filtered.filter((item) => crmStage(item) === stage.id).length}</b></button>)}</nav>
    <section className="crm-board" aria-label="Воронка лидов">{CRM_STAGES.map((stage) => {
      const leads = filtered.filter((item) => crmStage(item) === stage.id);
      const money = leads.map((item) => ({ ...potentialForLead(item, settings.averageCheck), currency: item.currency }));
      return <article className={`crm-column crm-stage-${stage.id.toLowerCase()} ${mobileStage === stage.id ? "mobile-active" : ""}`} key={stage.id}>
        <header><div><span>{stage.label}</span><b>{leads.length}</b></div><strong>{compactMoneyByCurrency(money)}</strong><small>{stage.hint}</small></header>
        <div className="crm-column-body">{leads.map((item) => { const amount = potentialForLead(item, settings.averageCheck); const clientWa = whatsapp(item.contactPhone, `Здравствуйте, ${item.contactName || "добрый день"}! Это ${companyName}. Связываемся по вашей заявке «${item.missionTitle}».`); const agentWa = whatsapp(item.partnerPhone, `Здравствуйте, ${item.partnerName}! Это ${companyName}. Уточняем детали по клиенту ${leadTitle(item)}.`); return <div className="crm-lead-card" role="button" tabIndex={0} onClick={() => { setSelected(item); setNotice(""); }} onKeyDown={(event) => { if (event.key === "Enter") setSelected(item); }} key={item.id}>
          <div className="crm-card-top"><span className="crm-source-dot" title={sourceLabel(item)}>{item.submittedByClient ? "↗" : "R"}</span><small>{sourceLabel(item)}</small><time>{formatDateTime(item.createdAt).split(",")[0]}</time></div>
          <h3>{leadTitle(item)}</h3><p>{item.partnerComment || item.contactCompany || item.missionTitle}</p>
          <div className="crm-card-contact">{clientWa ? <a href={clientWa} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>{item.contactPhone} · WhatsApp ↗</a> : <span>{item.contactEmail || "Контакт не указан"}</span>}</div>
          <div className="crm-card-money"><span><small>{amount.kind === "EXACT" ? "ТОЧНО" : amount.kind === "NONE" ? "СУММА" : "ОЦЕНКА"}</small><strong>{amount.amount ? formatMoney(amount.amount, item.currency) : "Не задана"}</strong></span><span><small>ПРИВЁЛ</small>{agentWa ? <a href={agentWa} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>{item.partnerName} ↗</a> : <b>{item.partnerName}</b>}</span></div>
          <select aria-label="Изменить этап" value={stage.id === "PAID" ? "WON" : stage.id} disabled={pending === item.id || stage.id === "PAID"} onClick={(event) => event.stopPropagation()} onChange={(event) => move(item, event.target.value)}><option value="NEW">Новый</option><option value="REVIEW">Проверка</option><option value="WORK">В работе</option><option value="WON">Сделка</option><option value="CLOSED">Закрыт</option></select>
        </div>; })}{!leads.length && <div className="crm-stage-empty">{items.length ? "На этом этапе лидов нет" : "Здесь появится первый лид из программы"}</div>}</div>
      </article>;
    })}</section>

    {goalOpen && <GoalModal value={settings} onClose={() => setGoalOpen(false)} onSaved={(next) => { setSettings(next); setGoalOpen(false); setNotice("Цель и параметры прогноза сохранены"); }} />}
    {selected && <LeadDrawer companyName={companyName} item={selected} pending={pending === selected.id} notice={notice} onClose={() => { setSelected(null); setNotice(""); }} onSave={(payload) => patchLead(selected, payload, "Карточка лида сохранена")} />}
  </div>;
}

function GoalModal({ value, onClose, onSaved }: { value: CrmSettings; onClose: () => void; onSaved: (value: CrmSettings) => void }) {
  const [draft, setDraft] = useState(value);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const math = calculateCrmGoal(draft.monthlyGoal, draft.averageCheck, draft.conversionRate, draft.leadsPerAmbassador);
  const rangeMax = Math.max(1_000_000, Math.ceil(Math.max(draft.monthlyGoal * 2, draft.averageCheck * 20) / 100_000) * 100_000);
  const rangeStep = rangeMax >= 10_000_000 ? 100_000 : 10_000;
  async function save() { setPending(true); setError(""); try { const response = await fetch("/api/company/crm-settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) }); const data = await response.json() as { error?: string }; if (!response.ok) throw new Error(data.error || "Не удалось сохранить"); onSaved({ ...draft, monthlyGoal: math.goal, averageCheck: math.check, conversionRate: math.conversion, leadsPerAmbassador: math.perAmbassador }); } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось сохранить"); } finally { setPending(false); } }
  return <div className="relay-modal-backdrop"><button className="relay-modal-dismiss-layer" type="button" onClick={onClose} aria-label="Закрыть" /><section className="relay-modal crm-goal-modal" role="dialog" aria-modal="true" aria-labelledby="crm-goal-title"><button className="relay-modal-close" type="button" onClick={onClose}>×</button><small>ПЛАН ПРОДАЖ</small><h2 id="crm-goal-title">Моя цель в месяц</h2><p>Задайте ориентиры — RiseStaff посчитает, сколько нужно оплат, лидов и активных амбассадоров.</p>
    <div className="crm-goal-main"><input type="number" min="0" value={draft.monthlyGoal || ""} onChange={(event) => setDraft({ ...draft, monthlyGoal: Number(event.target.value) })} placeholder="0" /><select value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value })}><option>KZT</option><option>RUB</option><option>USD</option><option>EUR</option></select><span>/ мес</span></div>
    <input className="crm-goal-range" type="range" min="0" max={rangeMax} step={rangeStep} value={Math.min(rangeMax, draft.monthlyGoal)} onChange={(event) => setDraft({ ...draft, monthlyGoal: Number(event.target.value) })} /><div className="crm-goal-checkpoints"><span>0</span><span>{formatMoney(rangeMax / 2, draft.currency)}</span><span>{formatMoney(rangeMax, draft.currency)}</span></div>
    <div className="crm-goal-inputs"><label><span>Средний чек</span><input type="number" min="0" value={draft.averageCheck || ""} onChange={(event) => setDraft({ ...draft, averageCheck: Number(event.target.value) })} /></label><label><span>Конверсия в оплату, %</span><input type="number" min="0" max="100" value={draft.conversionRate || ""} onChange={(event) => setDraft({ ...draft, conversionRate: Number(event.target.value) })} /></label><label><span>Лидов на амбассадора</span><input type="number" min="0" value={draft.leadsPerAmbassador || ""} onChange={(event) => setDraft({ ...draft, leadsPerAmbassador: Number(event.target.value) })} /></label></div>
    <div className="crm-goal-chain"><span><b>{math.payments}</b><small>{countRu(math.payments, "оплата", "оплаты", "оплат").replace(/^\d+\s/, "")}</small></span><i>→</i><span><b>{math.leads}</b><small>{countRu(math.leads, "лид", "лида", "лидов").replace(/^\d+\s/, "")}</small></span><i>→</i><span><b>{math.ambassadors}</b><small>{countRu(math.ambassadors, "амбассадор", "амбассадора", "амбассадоров").replace(/^\d+\s/, "")}</small></span></div>
    {error && <div className="form-error">{error}</div>}<button className="button button-primary crm-save-goal" type="button" disabled={pending} onClick={() => void save()}>{pending ? "Сохраняем…" : `Зафиксировать цель — ${formatMoney(math.goal, draft.currency)}`}</button>
  </section></div>;
}

function LeadDrawer({ companyName, item, pending, notice, onClose, onSave }: { companyName: string; item: CrmLead; pending: boolean; notice: string; onClose: () => void; onSave: (payload: Record<string, unknown>) => void }) {
  const [reviewStatus, setReviewStatus] = useState(item.reviewStatus);
  const [salesStatus, setSalesStatus] = useState(item.salesStatus);
  const clientWa = whatsapp(item.contactPhone, `Здравствуйте, ${item.contactName || "добрый день"}! Это ${companyName}. Связываемся по вашей заявке «${item.missionTitle}».`);
  const agentWa = whatsapp(item.partnerPhone, `Здравствуйте, ${item.partnerName}! Это ${companyName}. Уточняем детали по клиенту ${leadTitle(item)}.`);
  return <div className="relay-modal-backdrop crm-drawer-backdrop"><button className="relay-modal-dismiss-layer" type="button" onClick={onClose} aria-label="Закрыть" /><section className="crm-lead-drawer" role="dialog" aria-modal="true" aria-labelledby="crm-lead-title"><button className="relay-modal-close" type="button" onClick={onClose}>×</button>
    <header><span>{sourceLabel(item)}</span><h2 id="crm-lead-title">{leadTitle(item)}</h2><p>{item.programName} · {item.missionTitle}</p><div>{clientWa && <a href={clientWa} target="_blank" rel="noreferrer">Клиент в WhatsApp ↗</a>}{agentWa && <a href={agentWa} target="_blank" rel="noreferrer">Амбассадор в WhatsApp ↗</a>}</div></header>
    {notice && <div className="crm-notice">{notice}</div>}
    <div className="crm-lead-facts"><article><small>КЛИЕНТ</small><strong>{item.contactCompany || item.contactName || "Не указано"}</strong><span>{item.contactPhone || item.contactEmail || "Контакт не указан"}</span></article><article><small>КТО ПРИВЁЛ</small><strong>{item.partnerName}</strong><span>{item.partnerPhone || item.partnerEmail}</span></article><article><small>ИСТОЧНИК</small><strong>{sourceLabel(item)}</strong><span>{formatDateTime(item.createdAt)}</span></article><article><small>АВТОРСТВО</small><strong>{item.ownershipStatus === "CLEAR" ? "Закреплено" : "Требует проверки"}</strong><span>SLA: {slaState(item.reviewDueAt, !["PENDING", "REVIEWING"].includes(item.reviewStatus)).label}</span></article></div>
    <div className="crm-lead-context"><small>КОММЕНТАРИЙ</small><p>{item.partnerComment || "Комментарий не оставлен"}</p></div>
    {item.customAnswers.length > 0 && <details className="crm-drawer-details"><summary>Данные формы · {item.customAnswers.length}</summary>{item.customAnswers.map((answer) => <p key={answer.fieldId}><small>{answer.label}</small><strong>{Array.isArray(answer.value) ? answer.value.join(", ") : answer.value || "Не заполнено"}</strong></p>)}</details>}
    {item.attachments.length > 0 && <details className="crm-drawer-details"><summary>Файлы · {item.attachments.length}</summary>{item.attachments.map((file) => <a href={file.externalUrl || `/api/company/files/${file.id}`} target="_blank" rel="noreferrer" key={file.id}>{file.fileName} · {Math.max(1, Math.round(file.size / 1024))} КБ ↗</a>)}</details>}
    {item.events.length > 0 && <details className="crm-drawer-details"><summary>История · {item.events.length}</summary>{item.events.map((event) => <p key={event.id}><strong>{event.comment || event.toStatus}</strong><small>{formatDateTime(event.createdAt)}</small></p>)}</details>}
    <form className="crm-lead-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); onSave({ reviewStatus, salesStatus, estimatedDealAmount: data.get("estimatedDealAmount"), dealAmount: data.get("dealAmount"), amount: item.rewardValue, plannedAt: data.get("plannedAt"), comment: data.get("comment") }); }}><div className="crm-status-pair"><label><span>Проверка</span><select value={reviewStatus} onChange={(event) => { const value = event.target.value; setReviewStatus(value); if (value !== "ACCEPTED") setSalesStatus(value === "REJECTED" ? "LOST" : "NONE"); }}>{Object.entries(reviewStatusNames).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Продажа</span><select value={salesStatus} disabled={reviewStatus !== "ACCEPTED"} onChange={(event) => setSalesStatus(event.target.value)}>{Object.entries(salesStatusNames).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
      <div className="crm-status-pair"><label><span>Ориентир сделки</span><input name="estimatedDealAmount" type="number" min="0" defaultValue={item.estimatedDealAmount || ""} placeholder="Потенциальная сумма" /><small>Прогноз, пока точная сумма неизвестна</small></label><label><span>Точная сумма сделки</span><input name="dealAmount" type="number" min="0" defaultValue={item.dealAmount || ""} placeholder="После согласования" /><small>Попадает в факт только при состоявшейся сделке</small></label></div>
      <label><span>Плановая выплата амбассадору</span><input name="plannedAt" type="date" defaultValue={item.reward?.plannedAt?.slice(0, 10) || ""} /></label><label><span>Комментарий</span><textarea name="comment" defaultValue={item.companyComment} rows={4} placeholder="Следующий шаг, причина решения или важная договорённость" /></label>
      <button className="button button-primary" disabled={pending} type="submit">{pending ? "Сохраняем…" : "Сохранить карточку"}</button>
    </form>
  </section></div>;
}

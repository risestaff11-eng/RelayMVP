"use client";

import { useMemo, useState } from "react";
import { calculateCrmGoal, conversionFromLeadsPerPayment, CRM_STAGES, crmStage, crmStageMutation, leadsPerPaymentFromConversion, potentialForLead, type CrmStageId } from "@/lib/crm";
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

export type CrmSettings = { monthlyGoal: number; averageCheck: number; conversionRate: number; currency: string };

const quickFilters = [
  ["ALL", "Все клиенты"], ["ACTION", "Требуют внимания"], ["WORK", "В работе"], ["MONEY", "Деньги в воронке"], ["CLOSED", "Отказ / брак"],
] as const;

function digits(value: string) {
  const raw = value.replace(/\D/g, "");
  return raw.length === 11 && raw.startsWith("8") ? `7${raw.slice(1)}` : raw;
}

function formatPhone(value: string) {
  const raw = digits(value);
  if (raw.length === 11 && raw.startsWith("7")) return `+7 ${raw.slice(1, 4)} ${raw.slice(4, 7)} ${raw.slice(7, 9)} ${raw.slice(9, 11)}`;
  return value;
}

function whatsapp(phone: string, text: string) {
  const normalized = digits(phone);
  return normalized ? `https://wa.me/${normalized}?text=${encodeURIComponent(text)}` : "";
}

function leadTitle(item: CrmLead) { return item.contactName || item.contactCompany || "Клиент без имени"; }
function sourceLabel(item: CrmLead) { return item.submittedByClient || item.referralSource === "CLIENT_SELF_SERVICE" ? "Реферальная ссылка амбассадора" : "Амбассадор"; }
function shortDate(value: string) { return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" }).format(new Date(value)).replace(".", ""); }

function compactMoneyByCurrency(items: Array<{ amount: number; currency: string }>) {
  const totals = new Map<string, number>();
  for (const item of items) if (item.amount > 0) totals.set(item.currency, (totals.get(item.currency) || 0) + item.amount);
  return totals.size ? [...totals].map(([currency, amount]) => formatMoney(amount, currency)).join(" · ") : "Сумма не задана";
}

function payoutState(reward: Reward) {
  if (!reward || reward.status === "PENDING") return { label: "Будет рассчитано после выполнения условий", tone: "muted" };
  if (reward.status === "CANCELLED") return { label: "Не начислено", tone: "muted" };
  if (reward.status === "APPROVED") return { label: "Ожидает выплаты", tone: "waiting" };
  if (reward.partnerConfirmedAt) return { label: `Получение подтверждено${reward.paidAt ? ` · ${shortDate(reward.paidAt)}` : ""}`, tone: "paid" };
  return { label: "Компания отметила перевод", tone: "waiting" };
}

function humanEvent(event: Event) {
  const names: Record<string, string> = {
    PENDING: "ждёт проверки", REVIEWING: "проверяется", ACCEPTED: "принята компанией", REJECTED: "отклонена",
    NONE: "продажа не началась", IN_PROGRESS: "клиент в работе", AGREEMENT: "договор / предоплата", WON: "оплачено клиентом", LOST: "отказ / брак",
    SUBMITTED: "новый", DEAL: "оплачено клиентом", REWARDED: "вознаграждение начислено",
  };
  const raw = event.comment || `Статус изменён на ${event.toStatus}`;
  return Object.entries(names).reduce((text, [status, label]) => text.replaceAll(status, `«${label}»`), raw);
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
  const [dragged, setDragged] = useState("");
  const [dragOver, setDragOver] = useState<CrmStageId | "">("");
  const [closing, setClosing] = useState<CrmLead | null>(null);

  const programs = [...new Set(items.map((item) => item.programName))];
  const ambassadors = [...new Map(items.map((item) => [item.partnerEmail, item.partnerName || item.partnerEmail])).entries()];
  const filtered = useMemo(() => items.filter((item) => {
    const stage = crmStage(item);
    const haystack = `${leadTitle(item)} ${item.contactCompany} ${item.contactPhone} ${item.contactEmail} ${item.partnerName} ${item.partnerEmail} ${item.programName} ${item.missionTitle}`.toLowerCase();
    const quickMatch = quick === "ALL" || (quick === "ACTION" && ["NEW", "REVIEW"].includes(stage)) || (quick === "WORK" && ["WORK", "AGREEMENT"].includes(stage)) || (quick === "MONEY" && ["AGREEMENT", "PAID"].includes(stage)) || (quick === "CLOSED" && stage === "CLOSED");
    return haystack.includes(query.trim().toLowerCase()) && quickMatch && (program === "ALL" || item.programName === program) && (ambassador === "ALL" || item.partnerEmail === ambassador);
  }), [items, query, quick, program, ambassador]);

  const goal = calculateCrmGoal(settings.monthlyGoal, settings.averageCheck, settings.conversionRate);
  const paid = items.filter((item) => crmStage(item) === "PAID" && item.currency === settings.currency);
  const fact = paid.reduce((sum, item) => sum + Math.max(0, item.dealAmount || 0), 0);
  const openItems = items.filter((item) => !["PAID", "CLOSED"].includes(crmStage(item)) && item.currency === settings.currency);
  const potential = openItems.reduce((sum, item) => sum + potentialForLead(item, settings.averageCheck).amount, 0);
  const progress = goal.goal > 0 ? Math.min(100, Math.round(fact / goal.goal * 100)) : 0;

  function optimisticLead(item: CrmLead, body: Record<string, unknown>) {
    return { ...item, reviewStatus: String(body.reviewStatus || item.reviewStatus), salesStatus: String(body.salesStatus || item.salesStatus), estimatedDealAmount: Number(body.estimatedDealAmount ?? item.estimatedDealAmount), dealAmount: Number(body.dealAmount ?? item.dealAmount), companyComment: String(body.comment ?? item.companyComment) };
  }

  async function patchLead(item: CrmLead, payload: Record<string, unknown>, success = "Карточка обновлена", optimistic = false) {
    setPending(item.id); setNotice("");
    const body = { amount: item.rewardValue, estimatedDealAmount: item.estimatedDealAmount, dealAmount: item.dealAmount, comment: item.companyComment, ...payload };
    const optimisticItem = optimisticLead(item, body);
    if (optimistic) setItems((current) => current.map((row) => row.id === item.id ? optimisticItem : row));
    try {
      const response = await fetch(`/api/submissions/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(String(data.error || "Не удалось сохранить"));
      const rewardAmount = Number(data.rewardAmount ?? item.reward?.amount ?? 0);
      const nextReward = rewardAmount > 0 || item.reward ? { amount: rewardAmount, currency: item.reward?.currency || item.currency, status: String(data.rewardStatus || item.reward?.status || "PENDING"), paidAt: item.reward?.paidAt || null, partnerConfirmedAt: item.reward?.partnerConfirmedAt || null, plannedAt: String(body.plannedAt || item.reward?.plannedAt || "") || null } : null;
      const next: CrmLead = { ...optimisticItem, status: String(data.status || item.status), reviewStatus: String(data.reviewStatus || optimisticItem.reviewStatus), salesStatus: String(data.salesStatus || optimisticItem.salesStatus), estimatedDealAmount: Number(data.estimatedDealAmount ?? optimisticItem.estimatedDealAmount), dealAmount: Number(data.dealAmount ?? optimisticItem.dealAmount), reward: nextReward };
      setItems((current) => current.map((row) => row.id === item.id ? next : row));
      setSelected((current) => current?.id === item.id ? next : current);
      setNotice(success);
      return true;
    } catch (error) {
      if (optimistic) setItems((current) => current.map((row) => row.id === item.id ? item : row));
      setSelected((current) => current?.id === item.id ? item : current);
      setNotice(error instanceof Error ? `${error.message}. Карточка возвращена на прежний этап.` : "Не удалось сохранить. Карточка возвращена на прежний этап.");
      return false;
    } finally { setPending(""); }
  }

  function move(item: CrmLead, stage: CrmStageId) {
    if (crmStage(item) === stage) return;
    if (stage === "PAID" && !item.dealAmount) { setSelected(item); setNotice("Укажите фактическую сумму оплаты перед переводом клиента в «Оплачено»."); return; }
    if (stage === "CLOSED") { setClosing(item); return; }
    void patchLead(item, crmStageMutation(stage), `Клиент переведён в «${CRM_STAGES.find((value) => value.id === stage)?.label}»`, true);
  }

  return <div className="crm-workspace">
    <header className="crm-compact-header">
      <h1>CRM</h1>
      <button className="crm-goal-summary" type="button" onClick={() => setGoalOpen(true)} aria-label="Открыть настройку цели"><span>Цель <strong>{goal.goal ? formatMoney(goal.goal, settings.currency) : "не задана"}</strong></span><span>Факт <strong>{formatMoney(fact, settings.currency)}</strong></span><span className="crm-goal-percent">{progress}%</span></button>
      <div className="crm-money-summary"><span>Потенциал <strong>{formatMoney(potential, settings.currency)}</strong></span><span>До цели <strong>{formatMoney(Math.max(0, goal.goal - fact), settings.currency)}</strong></span></div>
    </header>

    <section className="crm-toolbar" aria-label="Поиск и фильтры CRM">
      <label className="crm-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Имя, телефон, программа или амбассадор" /></label>
      <select value={quick} onChange={(event) => setQuick(event.target.value as (typeof quickFilters)[number][0])} aria-label="Состояние">{quickFilters.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
      <select value={program} onChange={(event) => setProgram(event.target.value)} aria-label="Программа"><option value="ALL">Все программы</option>{programs.map((item) => <option key={item}>{item}</option>)}</select>
      <select value={ambassador} onChange={(event) => setAmbassador(event.target.value)} aria-label="Амбассадор"><option value="ALL">Все амбассадоры</option>{ambassadors.map(([email, name]) => <option value={email} key={email}>{name}</option>)}</select>
    </section>

    {notice && <div className="crm-notice" role="status">{notice}<button type="button" onClick={() => setNotice("")} aria-label="Закрыть сообщение">×</button></div>}
    <nav className="crm-mobile-stages" aria-label="Этап воронки">{CRM_STAGES.map((stage) => <button type="button" className={mobileStage === stage.id ? "active" : ""} onClick={() => setMobileStage(stage.id)} key={stage.id}>{stage.label}<b>{filtered.filter((item) => crmStage(item) === stage.id).length}</b></button>)}</nav>
    <section className="crm-board" aria-label="Воронка клиентов">{CRM_STAGES.map((stage) => {
      const leads = filtered.filter((item) => crmStage(item) === stage.id);
      const money = leads.map((item) => ({ ...potentialForLead(item, settings.averageCheck), currency: item.currency }));
      return <article className={`crm-column crm-stage-${stage.id.toLowerCase()} ${mobileStage === stage.id ? "mobile-active" : ""} ${dragOver === stage.id ? "drag-over" : ""}`} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDragOver(stage.id); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOver(""); }} onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData("text/plain") || dragged; const item = items.find((value) => value.id === id); setDragOver(""); setDragged(""); if (item) move(item, stage.id); }} key={stage.id}>
        <header><div><span>{stage.label}</span><b>{leads.length}</b></div><strong>{compactMoneyByCurrency(money)}</strong><small>{stage.hint}</small></header>
        <div className="crm-column-body">{leads.map((item) => {
          const amount = potentialForLead(item, settings.averageCheck);
          const clientWa = whatsapp(item.contactPhone, `Здравствуйте, ${item.contactName || "добрый день"}! Это ${companyName}. Связываемся по вашей заявке «${item.missionTitle}».`);
          const agentWa = whatsapp(item.partnerPhone, `Здравствуйте, ${item.partnerName}! Это ${companyName}. Уточняем детали по клиенту ${leadTitle(item)}.`);
          const payout = payoutState(item.reward);
          return <div className={`crm-lead-card ${dragged === item.id ? "dragging" : ""}`} draggable={pending !== item.id} onDragStart={(event) => { setDragged(item.id); event.dataTransfer.setData("text/plain", item.id); event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { setDragged(""); setDragOver(""); }} onClick={() => { setSelected(item); setNotice(""); }} onKeyDown={(event) => { if (event.key === "Enter") setSelected(item); }} role="button" tabIndex={0} aria-label={`Открыть карточку клиента ${leadTitle(item)}`} key={item.id}>
            <div className="crm-card-top"><span><strong>{item.programName}</strong><small>{item.missionTitle}</small></span><time dateTime={item.createdAt}>{shortDate(item.createdAt)}</time></div>
            <h3>{leadTitle(item)}</h3><div className="crm-client-contact">{clientWa ? <a href={clientWa} title="Открыть переписку" target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>{formatPhone(item.contactPhone)} ↗</a> : <span>{item.contactEmail || "Контакт не указан"}</span>}</div><p>{item.partnerComment || item.contactCompany || "Комментарий не оставлен"}</p>
            <div className="crm-card-amount"><small>{amount.kind === "EXACT" ? "СУММА" : "ПОТЕНЦИАЛ"}</small><strong>{amount.amount ? `${amount.kind === "EXACT" ? "" : "≈ "}${formatMoney(amount.amount, item.currency)}` : "Не задан"}</strong></div>
            <footer><span><small>Привёл:</small><strong>{item.partnerName || item.partnerEmail}</strong>{agentWa ? <a href={agentWa} title="Открыть переписку" target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>{formatPhone(item.partnerPhone)} ↗</a> : item.partnerPhone && <em>{formatPhone(item.partnerPhone)}</em>}</span>{stage.id === "PAID" && <b className={`crm-payout-state ${payout.tone}`}>{item.reward?.amount ? `${formatMoney(item.reward.amount, item.reward.currency)} · ` : ""}{payout.label}</b>}</footer>
            <select className="crm-card-stage-select" aria-label="Изменить этап" value={stage.id} disabled={pending === item.id} onClick={(event) => event.stopPropagation()} onChange={(event) => move(item, event.target.value as CrmStageId)}>{CRM_STAGES.map((value) => <option value={value.id} key={value.id}>{value.label}</option>)}</select>
          </div>;
        })}{!leads.length && <div className="crm-stage-empty">Перетащите клиента на этот этап</div>}</div>
      </article>;
    })}</section>

    {goalOpen && <GoalModal value={settings} onClose={() => setGoalOpen(false)} onSaved={(next) => { setSettings(next); setGoalOpen(false); setNotice("Цель и параметры прогноза сохранены"); }} />}
    {closing && <CloseLeadModal item={closing} pending={pending === closing.id} onClose={() => setClosing(null)} onConfirm={(reason) => { const payload = ["PENDING", "REVIEWING"].includes(closing.reviewStatus) ? { reviewStatus: "REJECTED", salesStatus: "LOST", comment: reason } : { reviewStatus: "ACCEPTED", salesStatus: "LOST", comment: reason }; void patchLead(closing, payload, "Негативный исход зафиксирован", true).then((ok) => { if (ok) setClosing(null); }); }} />}
    {selected && <LeadFullscreen key={`${selected.id}-${selected.reviewStatus}-${selected.salesStatus}-${selected.dealAmount}-${selected.reward?.amount || 0}`} companyName={companyName} item={selected} pending={pending === selected.id} notice={notice} onClose={() => { setSelected(null); setNotice(""); }} onSave={(payload) => patchLead(selected, payload, "Карточка клиента сохранена")} />}
  </div>;
}

function GoalModal({ value, onClose, onSaved }: { value: CrmSettings; onClose: () => void; onSaved: (value: CrmSettings) => void }) {
  const [draft, setDraft] = useState(value);
  const [leadsPerPayment, setLeadsPerPayment] = useState(() => leadsPerPaymentFromConversion(value.conversionRate) || 5);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const conversionRate = conversionFromLeadsPerPayment(leadsPerPayment);
  const math = calculateCrmGoal(draft.monthlyGoal, draft.averageCheck, conversionRate);
  const rangeMax = Math.max(1_000_000, Math.ceil(Math.max(draft.monthlyGoal * 2, draft.averageCheck * 20) / 100_000) * 100_000);
  const rangeStep = rangeMax >= 10_000_000 ? 100_000 : 10_000;
  async function save() { setPending(true); setError(""); const next = { ...draft, monthlyGoal: math.goal, averageCheck: math.check, conversionRate: math.conversion }; try { const response = await fetch("/api/company/crm-settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(next) }); const data = await response.json() as { error?: string }; if (!response.ok) throw new Error(data.error || "Не удалось сохранить"); onSaved(next); } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось сохранить"); } finally { setPending(false); } }
  return <div className="relay-modal-backdrop"><button className="relay-modal-dismiss-layer" type="button" onClick={onClose} aria-label="Закрыть" /><section className="relay-modal crm-goal-modal" role="dialog" aria-modal="true" aria-labelledby="crm-goal-title"><button className="relay-modal-close" type="button" onClick={onClose}>×</button><small>ПЛАН ПРОДАЖ</small><h2 id="crm-goal-title">Моя цель в месяц</h2><p>Укажите план, средний чек и обычное качество заявок. Не нужно заранее угадывать, сколько лидов даст один амбассадор.</p>
    <div className="crm-goal-main"><input type="number" min="0" value={draft.monthlyGoal || ""} onChange={(event) => setDraft({ ...draft, monthlyGoal: Number(event.target.value) })} placeholder="0" /><select value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value })}><option>KZT</option><option>RUB</option><option>USD</option><option>EUR</option></select><span>/ мес</span></div>
    <input className="crm-goal-range" type="range" min="0" max={rangeMax} step={rangeStep} value={Math.min(rangeMax, draft.monthlyGoal)} onChange={(event) => setDraft({ ...draft, monthlyGoal: Number(event.target.value) })} /><div className="crm-goal-checkpoints"><span>0</span><span>{formatMoney(rangeMax / 2, draft.currency)}</span><span>{formatMoney(rangeMax, draft.currency)}</span></div>
    <div className="crm-goal-inputs"><label><span>Средний чек</span><input type="number" min="0" value={draft.averageCheck || ""} onChange={(event) => setDraft({ ...draft, averageCheck: Number(event.target.value) })} /><small>Сколько обычно платит один клиент</small></label><label><span>На одну оплату нужно лидов</span><input type="number" min="1" max="100" value={leadsPerPayment || ""} onChange={(event) => setLeadsPerPayment(Number(event.target.value))} /><small>Например: 5 означает одну оплату из пяти заявок</small></label></div>
    <div className="crm-goal-chain"><span><b>{math.payments}</b><small>{countRu(math.payments, "оплата", "оплаты", "оплат").replace(/^\d+\s/, "")}</small></span><i>→</i><span><b>{math.leads}</b><small>{countRu(math.leads, "лид", "лида", "лидов").replace(/^\d+\s/, "")}</small></span></div><p className="crm-goal-note">Количество активных амбассадоров станет понятным по их фактической активности — этот прогноз не нужно задавать заранее.</p>
    {error && <div className="form-error">{error}</div>}<button className="button button-primary crm-save-goal" type="button" disabled={pending} onClick={() => void save()}>{pending ? "Сохраняем…" : `Зафиксировать цель — ${formatMoney(math.goal, draft.currency)}`}</button>
  </section></div>;
}

function CloseLeadModal({ item, pending, onClose, onConfirm }: { item: CrmLead; pending: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return <div className="relay-modal-backdrop crm-close-backdrop"><button className="relay-modal-dismiss-layer" type="button" onClick={onClose} aria-label="Закрыть" /><section className="relay-modal crm-close-modal" role="dialog" aria-modal="true" aria-labelledby="crm-close-title"><button className="relay-modal-close" type="button" onClick={onClose}>×</button><small>НЕГАТИВНЫЙ ИСХОД</small><h2 id="crm-close-title">Почему закрываете {leadTitle(item)}?</h2><p>Причина сохранится в истории и поможет разобрать дубли, брак и отказы.</p><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} placeholder="Например: клиент уже есть в базе" /><div><button className="button button-ghost" type="button" onClick={onClose}>Отмена</button><button className="button button-primary" type="button" disabled={pending || reason.trim().length < 5} onClick={() => onConfirm(reason.trim())}>{pending ? "Сохраняем…" : "Зафиксировать причину"}</button></div></section></div>;
}

function LeadFullscreen({ companyName, item, pending, notice, onClose, onSave }: { companyName: string; item: CrmLead; pending: boolean; notice: string; onClose: () => void; onSave: (payload: Record<string, unknown>) => void }) {
  const [reviewStatus, setReviewStatus] = useState(item.reviewStatus);
  const [salesStatus, setSalesStatus] = useState(item.salesStatus);
  const [estimatedDealAmount, setEstimatedDealAmount] = useState(item.estimatedDealAmount || 0);
  const [dealAmount, setDealAmount] = useState(item.dealAmount || 0);
  const [rewardAmount, setRewardAmount] = useState(item.reward?.amount || item.rewardValue || 0);
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);
  const clientWa = whatsapp(item.contactPhone, `Здравствуйте, ${item.contactName || "добрый день"}! Это ${companyName}. Связываемся по вашей заявке «${item.missionTitle}».`);
  const agentWa = whatsapp(item.partnerPhone, `Здравствуйте, ${item.partnerName}! Это ${companyName}. Уточняем детали по клиенту ${leadTitle(item)}.`);
  const amount = potentialForLead(item, 0);
  const payout = payoutState(item.reward);
  const currentStage = CRM_STAGES.find((stage) => stage.id === crmStage(item));
  const isPercentReward = item.rewardMode === "PERCENT";
  const calculatedReward = isPercentReward ? Math.max(0, Math.round(dealAmount * item.rewardValue / 100)) : rewardAmount;
  return <div className="relay-modal-backdrop crm-fullscreen-backdrop"><section className="crm-lead-fullscreen" role="dialog" aria-modal="true" aria-labelledby="crm-lead-title"><button className="relay-modal-close" type="button" onClick={onClose} aria-label="Закрыть">×</button>
    <header className={`crm-fullscreen-header ${mobileSummaryOpen ? "mobile-summary-open" : ""}`}><div className="crm-fullscreen-context"><span>{item.programName}</span><strong>{item.missionTitle}</strong><time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time></div><div className="crm-fullscreen-person"><div><small>КЛИЕНТ</small><h2 id="crm-lead-title">{leadTitle(item)}</h2>{clientWa ? <a href={clientWa} title="Открыть переписку" target="_blank" rel="noreferrer">{formatPhone(item.contactPhone)} ↗</a> : <span>{item.contactEmail || "Контакт не указан"}</span>}</div><div><small>ТЕКУЩИЙ ЭТАП</small><strong className="crm-current-stage">{currentStage?.label || "Новый"}</strong><span>{amount.amount ? `${amount.kind === "EXACT" ? "" : "≈ "}${formatMoney(amount.amount, item.currency)}` : "Сумма не задана"}</span></div><div><small>ПРИВЁЛ</small><strong>{item.partnerName || item.partnerEmail}</strong>{agentWa ? <a href={agentWa} title="Открыть переписку" target="_blank" rel="noreferrer">{formatPhone(item.partnerPhone)} ↗</a> : <span>{item.partnerPhone || item.partnerEmail}</span>}</div></div><button className="crm-mobile-summary-toggle" type="button" aria-expanded={mobileSummaryOpen} onClick={() => setMobileSummaryOpen((value) => !value)}>{mobileSummaryOpen ? "Скрыть сводку" : "Этап и амбассадор"}<span aria-hidden="true">{mobileSummaryOpen ? "⌃" : "⌄"}</span></button></header>
    {notice && <div className="crm-notice">{notice}</div>}
    <div className="crm-fullscreen-body"><main>
      <section className="crm-detail-section"><div className="crm-section-heading"><small>ДАННЫЕ ЗАЯВКИ</small><h3>Что передал амбассадор</h3></div><div className="crm-detail-grid"><article><small>Компания клиента</small><strong>{item.contactCompany || "Не указана"}</strong></article><article><small>Email клиента</small><strong>{item.contactEmail || "Не указан"}</strong></article><article><small>Источник</small><strong>{sourceLabel(item)}</strong></article><article><small>Авторство</small><strong>{item.ownershipStatus === "CLEAR" ? "Закреплено" : "Требует проверки"}</strong></article></div><div className="crm-comment-block"><small>КОММЕНТАРИЙ АМБАССАДОРА</small><p>{item.partnerComment || "Комментарий не оставлен"}</p></div>{item.audioTranscript && <div className="crm-comment-block"><small>РАСШИФРОВКА ГОЛОСА</small><p>{item.audioTranscript}</p></div>}</section>
      {item.customAnswers.length > 0 && <section className="crm-detail-section"><div className="crm-section-heading"><small>ФОРМА</small><h3>Дополнительные ответы</h3></div><div className="crm-detail-grid">{item.customAnswers.map((answer) => <article key={answer.fieldId}><small>{answer.label}</small><strong>{Array.isArray(answer.value) ? answer.value.join(", ") : answer.value || "Не заполнено"}</strong></article>)}</div></section>}
      {item.attachments.length > 0 && <section className="crm-detail-section"><div className="crm-section-heading"><small>МАТЕРИАЛЫ</small><h3>Файлы · {item.attachments.length}</h3></div><div className="crm-file-list">{item.attachments.map((file) => <a href={file.externalUrl || `/api/company/files/${file.id}`} target="_blank" rel="noreferrer" key={file.id}><span>{file.fileName}</span><small>{Math.max(1, Math.round(file.size / 1024))} КБ · открыть ↗</small></a>)}</div></section>}
      <section className="crm-detail-section crm-history"><div className="crm-section-heading"><small>ИСТОРИЯ</small><h3>{countRu(item.events.length, "событие", "события", "событий")}</h3></div>{item.events.length ? <div className="crm-timeline">{item.events.map((event) => <article key={event.id}><i /><time>{formatDateTime(event.createdAt)}</time><strong>{humanEvent(event)}</strong></article>)}</div> : <p>Изменений пока нет.</p>}</section>
    </main><aside>
      <form className="crm-lead-form crm-inline-editor crm-company-editor" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); onSave({ reviewStatus, salesStatus, estimatedDealAmount, dealAmount, amount: calculatedReward, plannedAt: data.get("plannedAt"), comment: data.get("comment") }); }}>
        <div className="crm-section-heading"><small>УПРАВЛЕНИЕ</small><h3>Ведите заявку по шагам</h3><p>Сначала подтвердите заявку, затем отметьте продажу и вознаграждение.</p></div>
        <section className="crm-editor-section"><header><small>1. РЕШЕНИЕ ПО ЗАЯВКЕ</small><strong>Проверка и продажа</strong></header><div className="crm-status-pair"><label><span>Проверка заявки</span><select value={reviewStatus} onChange={(event) => { const value = event.target.value; setReviewStatus(value); if (value !== "ACCEPTED") setSalesStatus(value === "REJECTED" ? "LOST" : "NONE"); }}>{Object.entries(reviewStatusNames).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Статус продажи</span><select value={salesStatus} disabled={reviewStatus !== "ACCEPTED"} onChange={(event) => setSalesStatus(event.target.value)}>{Object.entries(salesStatusNames).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><small className="crm-control-hint">{reviewStatus !== "ACCEPTED" ? "Доступен после принятия заявки" : "Покажет, где сейчас клиент"}</small></label></div></section>
        <section className="crm-editor-section"><header><small>2. ДЕНЬГИ</small><strong>Сумма сделки</strong></header><div className="crm-status-pair"><label><span>Прогноз по сделке</span><input name="estimatedDealAmount" type="number" inputMode="numeric" min="0" value={estimatedDealAmount || ""} onChange={(event) => setEstimatedDealAmount(Number(event.target.value) || 0)} placeholder="0" /></label><label><span>Оплачено клиентом</span><input name="dealAmount" type="number" inputMode="numeric" min="0" value={dealAmount || ""} onChange={(event) => setDealAmount(Number(event.target.value) || 0)} placeholder="0" /></label></div></section>
        <section className="crm-reward-editor"><header><div><small>3. ВОЗНАГРАЖДЕНИЕ АМБАССАДОРУ</small><strong>{calculatedReward ? formatMoney(calculatedReward, item.currency) : "Укажите сумму"}</strong></div><span className={`crm-reward-status ${payout.tone}`}>{payout.label}</span></header><p>После сохранения сумма появится в кабинете амбассадора.</p>{isPercentReward ? <label><span>Сумма рассчитывается автоматически</span><output>{item.rewardValue}% от оплаты клиента · {formatMoney(calculatedReward, item.currency)}</output><small className="crm-control-hint">Введите сумму оплаты клиента выше, чтобы увидеть точный расчёт.</small></label> : <label><span>Сумма вознаграждения</span><input name="rewardAmount" type="number" inputMode="numeric" min="0" value={rewardAmount || ""} onChange={(event) => setRewardAmount(Number(event.target.value) || 0)} placeholder="0" /><small className="crm-control-hint">Укажите сумму, которую амбассадор увидит к выплате.</small></label>}<label><span>Плановая дата выплаты</span><input name="plannedAt" type="date" defaultValue={item.reward?.plannedAt?.slice(0, 10) || ""} /></label></section>
        <label className="crm-company-comment"><span>Следующий шаг для команды</span><textarea name="comment" defaultValue={item.companyComment} rows={3} placeholder="Например: договориться о встрече до пятницы" /></label><button className="button button-primary" disabled={pending} type="submit">{pending ? "Сохраняем…" : "Сохранить и обновить"}</button>
      </form>
      <section className="crm-service-state"><span><small>Проверка</small><strong>{reviewStatusNames[reviewStatus as keyof typeof reviewStatusNames] || reviewStatus}</strong></span><span><small>Продажа</small><strong>{salesStatusNames[salesStatus as keyof typeof salesStatusNames] || salesStatus}</strong></span><span><small>SLA проверки</small><strong>{slaState(item.reviewDueAt, !["PENDING", "REVIEWING"].includes(reviewStatus)).label}</strong></span></section>
    </aside></div>
  </section></div>;
}

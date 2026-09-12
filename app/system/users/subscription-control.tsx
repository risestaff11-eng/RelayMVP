"use client";
import { useRef, useState } from "react";
import { PAID_PLANS, subscriptionState } from "@/lib/subscription-plans";
import { formatInteger, formatDateTimeSeconds } from "@/lib/format-display";

type Event = { id: string; action: string; planCode: string; endsAt: string | null; revision: number; paidAmount: number; creditsGranted: number; note: string; createdAt: string };
type Props = { companyId: string; planCode: string; subscriptionStatus: string | null; subscriptionEndsAt: string | null; subscriptionRevision: number };
const actionNames: Record<string, string> = { ACTIVATE: "Тариф активирован", EXTEND: "Доступ продлён", TRIAL: "Пробный период выдан", SUSPEND: "Доступ приостановлен" };

export function SubscriptionControl({ companyId, ...initial }: Props) {
  const [current, setCurrent] = useState(initial);
  const [planCode, setPlanCode] = useState<string>(PAID_PLANS.find((plan) => plan.code === initial.planCode)?.code ?? "GROWTH");
  const [action, setAction] = useState("ACTIVATE");
  const [days, setDays] = useState(30);
  const [paidAmount, setPaidAmount] = useState(0);
  const [grantCredits, setGrantCredits] = useState(false);
  const [note, setNote] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const requestId = useRef<string | null>(null);
  const state = subscriptionState(current);
  const selected = PAID_PLANS.find((plan) => plan.code === planCode) ?? PAID_PLANS[1];
  async function history() {
    try { const response = await fetch(`/api/system/companies/${companyId}/subscription`); const data = await response.json() as { events: Event[]; error?: string }; if (!response.ok) throw new Error(data.error); setEvents(data.events); }
    catch { setMessage("Не удалось загрузить историю тарифов"); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setMessage("");
    requestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch(`/api/system/companies/${companyId}/subscription`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId: requestId.current, revision: current.subscriptionRevision, action, planCode, days, paidAmount, grantCredits, note }) });
      const data = await response.json() as { event: Event; error?: string };
      if (!response.ok) { requestId.current = null; throw new Error(data.error || "Не удалось изменить тариф"); }
      const saved = data.event;
      setCurrent({ planCode: saved.planCode, subscriptionStatus: saved.action === "SUSPEND" ? "SUSPENDED" : saved.action === "TRIAL" ? "TRIAL" : "ACTIVE", subscriptionEndsAt: saved.endsAt, subscriptionRevision: saved.revision });
      requestId.current = null; setNote(""); setPaidAmount(0); setGrantCredits(false); setMessage("Доступ компании обновлён"); await history();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Не удалось изменить тариф"); }
    finally { setBusy(false); }
  }
  return <details className="subscription-control" onToggle={(event) => { if (event.currentTarget.open) void history(); }}>
    <summary>Тариф: {state.name} · {state.legacy ? "Назначьте период" : state.active ? "Доступ активен" : "Только просмотр"}{state.endsAt && <> · до {formatDateTimeSeconds(state.endsAt)}</>}</summary>
    <form onSubmit={save} className="subscription-admin-form">
      <label>Действие<select disabled={busy} value={action} onChange={(e) => { setAction(e.target.value); requestId.current = null; }}><option value="ACTIVATE">Активировать или сменить тариф</option><option value="EXTEND">Продлить текущий тариф</option><option value="TRIAL">Выдать 14 дней для тестирования</option><option value="SUSPEND">Приостановить доступ</option></select></label>
      {(action === "ACTIVATE" || action === "EXTEND") && <>
        <label>Тариф<select disabled={busy} value={planCode} onChange={(e) => { setPlanCode(e.target.value); requestId.current = null; }}>{PAID_PLANS.map((plan) => <option key={plan.code} value={plan.code}>{plan.name} · {formatInteger(plan.price)} ₸ / 30 дней</option>)}</select></label>
        <label>Дней доступа<input disabled={busy} type="number" min="1" max="366" required value={days} onChange={(e) => { setDays(Number(e.target.value)); requestId.current = null; }} /></label>
        <label>Получено от компании, ₸<input disabled={busy} type="number" min="0" max="100000000" required value={paidAmount} onChange={(e) => { setPaidAmount(Number(e.target.value)); requestId.current = null; }} /></label>
        <label className="subscription-check"><input disabled={busy} type="checkbox" checked={grantCredits} onChange={(e) => { setGrantCredits(e.target.checked); requestId.current = null; }} />Начислить {formatInteger(selected.credits)} AI-кредитов</label>
      </>}
      <label className="subscription-note">Основание изменения<textarea disabled={busy} required maxLength={1000} value={note} onChange={(e) => { setNote(e.target.value); requestId.current = null; }} placeholder="Оплата, согласованный пилот или причина приостановки" /></label>
      <p>Активация начинает новый срок сегодня. Продление добавляет дни к оставшемуся сроку. Сумма — отметка об оплате, деньги не списываются.</p>
      <button disabled={busy} type="submit">{busy ? "Сохраняем…" : "Сохранить доступ"}</button>
    </form>
    {message && <p role="status">{message}</p>}
    <ol className="subscription-history">{events.map((event) => <li key={event.id}><strong>{actionNames[event.action] ?? event.action}</strong> · {PAID_PLANS.find((plan) => plan.code === event.planCode)?.name ?? "Пробный период"}<br />{formatDateTimeSeconds(event.createdAt)} · {formatInteger(event.paidAmount)} ₸<p>{event.note}</p></li>)}</ol>
  </details>;
}

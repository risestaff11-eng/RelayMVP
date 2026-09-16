"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate, formatMoney } from "@/lib/format-display";
import { companyPayoutSla, matchesPayoutFilter, payoutCsvCell, type PayoutFilter } from "@/lib/company-workspace";

type Row = { id: string; submissionId: string; agentName: string; agentEmail: string; missionTitle: string; programName: string; contactName: string; contactCompany: string; amount: number; currency: string; status: string; approvedAt: string | null; plannedAt: string | null; paidAt: string | null; partnerConfirmedAt: string | null; createdAt: string };
const statusNames: Record<string, string> = { PENDING: "Ожидает решения", APPROVED: "К выплате", PAID: "Компания отметила перевод", CANCELLED: "Отменено" };

export function RewardLedger({ initialRows, payoutSlaDays, initialFilter = "ALL", canManage = false, canExport = false }: { initialRows: Row[]; payoutSlaDays: number; initialFilter?: PayoutFilter; canManage?: boolean; canExport?: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [filter, setFilter] = useState<PayoutFilter>(initialFilter);
  const [transfer, setTransfer] = useState<{ id: string; paid: boolean } | null>(null);
  const inFlight = useRef(false);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState("");
  const [notice, setNotice] = useState("");
  const [correctionId, setCorrectionId] = useState("");
  const [correctionAmount, setCorrectionAmount] = useState(0);
  const [correctionReason, setCorrectionReason] = useState("");
  const filtered = useMemo(() => rows.filter((row) => matchesPayoutFilter(row, filter, payoutSlaDays) && `${row.agentName} ${row.agentEmail} ${row.programName} ${row.missionTitle} ${row.contactName} ${row.contactCompany}`.toLowerCase().includes(query.trim().toLowerCase())), [filter, query, rows, payoutSlaDays]);

  async function setPaid(row: Row, paid: boolean) {
    if (!canManage || inFlight.current) return;
    inFlight.current = true;
    setPending(row.id); setNotice("");
    try {
      const response = await fetch(`/api/rewards/${row.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ paid }) });
      const data = await response.json() as { error?: string; paidAt?: string | null; partnerConfirmedAt?: string | null };
      if (!response.ok) throw new Error(data.error || "Не удалось обновить выплату");
      setRows((items) => items.map((item) => item.id === row.id ? { ...item, status: paid ? "PAID" : "APPROVED", paidAt: data.paidAt ?? null, partnerConfirmedAt: data.partnerConfirmedAt ?? null } : item));
      setNotice(paid ? "Компания отметила перевод. Подтверждение получения учитывается отдельно." : "Начисление возвращено в список к выплате.");
      setTransfer(null);
      router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Ошибка"); } finally { inFlight.current = false; setPending(""); }
  }

  async function saveCorrection(row: Row) {
    if (!canManage || inFlight.current) return;
    inFlight.current = true;
    setPending(row.id); setNotice("");
    try {
      const response = await fetch(`/api/rewards/${row.id}/adjustments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount: correctionAmount, reason: correctionReason }) });
      const data = await response.json() as { error?: string; amount?: number };
      if (!response.ok || data.amount === undefined) throw new Error(data.error || "Не удалось скорректировать сумму");
      setRows((items) => items.map((item) => item.id === row.id ? { ...item, amount: data.amount! } : item));
      setCorrectionId(""); setCorrectionReason("");
      setNotice("Сумма изменена. Причина сохранена в истории заявки.");
      router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Ошибка"); } finally { inFlight.current = false; setPending(""); }
  }

  function exportCsv() {
    if (!canExport) return;
    const header = ["Агент", "Email", "Программа", "Задание", "Связанный контакт", "Компания контакта", "Сумма", "Валюта", "Создано", "Плановая дата", "Дата перевода", "Подтверждение агента", "Статус"];
    const lines = filtered.map((row) => [row.agentName, row.agentEmail, row.programName, row.missionTitle, row.contactName, row.contactCompany, row.amount, row.currency, row.createdAt, row.plannedAt || "", row.paidAt || "", row.partnerConfirmedAt || "", row.partnerConfirmedAt ? "Агент подтвердил получение" : statusNames[row.status] || row.status]);
    const csv = `\uFEFF${[header, ...lines].map((line) => line.map(payoutCsvCell).join(",")).join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "risestaff-payouts.csv"; link.click(); URL.revokeObjectURL(url);
  }


  const filters: [PayoutFilter, string][] = [
    ["ALL", "Все"], ["APPROVED", "К выплате"], ["OVERDUE", "Просрочены"],
    ["AWAITING_RECEIPT", "Ждём подтверждения агента"], ["CONFIRMED", "Получены агентами"],
    ["PENDING", "Ожидают решения"], ["CANCELLED", "Отменено"],
  ];
  return <div className="payout-workspace">
    <div className="payout-toolbar">
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Агент, программа или заявка" aria-label="Поиск выплаты" />
      <select value={filter} onChange={(event) => setFilter(event.target.value as PayoutFilter)} aria-label="Состояние выплаты">
        {filters.map(([value, label]) => <option key={value} value={value}>{label} · {rows.filter((row) => matchesPayoutFilter(row, value, payoutSlaDays)).length}</option>)}
      </select>
      {canExport && <button type="button" onClick={exportCsv} disabled={!filtered.length}>Скачать реестр ↓</button>}
    </div>
    {!canManage && <p className="table-notice">Просмотр выплат. Изменения доступны владельцу и финансовому сотруднику.</p>}
    {notice && <div className="table-notice" role="status">{notice}</div>}
    <section className="payout-card-list">{filtered.map((row) => {
      const sla = companyPayoutSla(row, payoutSlaDays);
      return <article className={`payout-record status-${row.status.toLowerCase()} ${sla.overdue ? "sla-overdue" : ""}`} key={row.id}>
        <header>
          <div><small><bdi data-no-translate>{row.programName}</bdi></small><h3><bdi data-no-translate>{row.missionTitle}</bdi></h3><p data-no-translate>{row.contactName}{row.contactCompany ? ` · ${row.contactCompany}` : ""}</p></div>
          <span>{row.partnerConfirmedAt ? "Агент подтвердил получение" : statusNames[row.status] ?? row.status}</span>
        </header>
        <div className="payout-record-body">
          <div><small>АГЕНТ</small><strong data-no-translate>{row.agentName}</strong><a href={`mailto:${row.agentEmail}`} data-no-translate>{row.agentEmail}</a></div>
          <div><small>СУММА</small><strong>{formatMoney(row.amount, row.currency)}</strong><span>Согласованная сумма · начислено {formatDate(row.createdAt)}</span></div>
          <div><small>СРОК ВЫПЛАТЫ</small><strong>{row.status === "PENDING" ? "После согласования" : row.status === "CANCELLED" ? "Отменено" : row.plannedAt ? formatDate(row.plannedAt) : `${payoutSlaDays} дн. после начисления`}</strong>
            {["APPROVED", "PAID"].includes(row.status) && <span className={sla.overdue ? "sla-label overdue" : "sla-label"}>{row.paidAt ? `Перевод ${formatDate(row.paidAt)}` : sla.label}</span>}
          </div>
          <div><small>ПОДТВЕРЖДЕНИЕ АГЕНТА</small><strong>{row.partnerConfirmedAt ? "✓ Получено" : row.status === "PAID" ? "Ожидаем" : "—"}</strong><span>{row.partnerConfirmedAt ? formatDate(row.partnerConfirmedAt) : "Отдельная отметка агента"}</span></div>
        </div>
        <footer>
          <a href={`/dashboard/crm?submission=${encodeURIComponent(row.submissionId)}`}>Открыть клиента в CRM →</a>
          {canManage && !row.partnerConfirmedAt && ["APPROVED", "PAID"].includes(row.status) && <button type="button" disabled={Boolean(pending)} onClick={() => { setTransfer({ id: row.id, paid: row.status !== "PAID" }); setCorrectionId(""); }}>{row.status === "PAID" ? "Отменить отметку перевода" : "Отметить перевод"}</button>}
          {canManage && ["PENDING", "APPROVED"].includes(row.status) && <button type="button" disabled={Boolean(pending)} onClick={() => { setCorrectionId(correctionId === row.id ? "" : row.id); setCorrectionAmount(row.amount); setCorrectionReason(""); setTransfer(null); }}>Скорректировать сумму</button>}
        </footer>
        {transfer?.id === row.id && <section className="company-transfer-confirm" aria-label="Подтверждение перевода">
          <strong>{transfer.paid ? "Подтвердите перевод денег" : "Вернуть сумму к выплате?"}</strong>
          <p><bdi data-no-translate>{row.agentName}</bdi> · {formatMoney(row.amount, row.currency)}</p>
          <p>{transfer.paid ? "Отмечайте только уже отправленные деньги. RiseStaff не выполняет банковский перевод." : "Отметка компании будет снята. Агент увидит сумму к выплате."}</p>
          <div><button type="button" disabled={Boolean(pending)} onClick={() => void setPaid(row, transfer.paid)}>{pending === row.id ? "Сохраняем…" : transfer.paid ? "Да, деньги переведены" : "Вернуть к выплате"}</button><button type="button" disabled={Boolean(pending)} onClick={() => setTransfer(null)}>Отмена</button></div>
        </section>}
        {correctionId === row.id && canManage && <form className="payout-correction" onSubmit={(event) => { event.preventDefault(); void saveCorrection(row); }}>
          <label><span>Новая сумма</span><input type="number" min="0" step="0.01" value={correctionAmount} onChange={(event) => setCorrectionAmount(Number(event.target.value) || 0)} required /></label>
          <label><span>Причина</span><input value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} minLength={5} maxLength={500} placeholder="Например: исправлена сумма по договору" required /></label>
          <button type="submit" disabled={Boolean(pending)}>Сохранить корректировку</button>
          <button type="button" disabled={Boolean(pending)} onClick={() => setCorrectionId("")}>Отмена</button>
        </form>}
      </article>;
    })}</section>
    {!filtered.length && <div className="table-empty"><p>По выбранным условиям начислений нет.</p>{(filter !== "ALL" || query) && <button type="button" onClick={() => { setFilter("ALL"); setQuery(""); }}>Сбросить фильтры</button>}</div>}
  </div>;
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate, formatMoney } from "@/lib/format-display";
import { payoutDueAt, slaState } from "@/lib/workflow";

type Row = { id: string; agentName: string; agentEmail: string; missionTitle: string; programName: string; contactName: string; contactCompany: string; amount: number; currency: string; status: string; approvedAt: string | null; plannedAt: string | null; paidAt: string | null; partnerConfirmedAt: string | null; createdAt: string };
const statusNames: Record<string, string> = { PENDING: "Ожидает решения", APPROVED: "К выплате", PAID: "Компания отметила перевод", CANCELLED: "Отменено" };

export function RewardLedger({ initialRows }: { initialRows: Row[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState("");
  const [notice, setNotice] = useState("");
  const filtered = useMemo(() => rows.filter((row) => (filter === "ALL" || row.status === filter) && `${row.agentName} ${row.agentEmail} ${row.programName} ${row.missionTitle} ${row.contactName} ${row.contactCompany}`.toLowerCase().includes(query.trim().toLowerCase())), [filter, query, rows]);

  async function setPaid(row: Row, paid: boolean) {
    setPending(row.id); setNotice("");
    try {
      const response = await fetch(`/api/rewards/${row.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ paid }) });
      const data = await response.json() as { error?: string; paidAt?: string | null; partnerConfirmedAt?: string | null };
      if (!response.ok) throw new Error(data.error || "Не удалось обновить выплату");
      setRows((items) => items.map((item) => item.id === row.id ? { ...item, status: paid ? "PAID" : "APPROVED", paidAt: data.paidAt ?? null, partnerConfirmedAt: data.partnerConfirmedAt ?? null } : item));
      setNotice(paid ? "Компания отметила перевод. Подтверждение получения учитывается отдельно." : "Начисление возвращено в список к выплате.");
      router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Ошибка"); } finally { setPending(""); }
  }

  function exportCsv() {
    const header = ["Агент", "Email", "Программа", "Задание", "Связанный контакт", "Компания контакта", "Сумма", "Валюта", "Создано", "Плановая дата", "Дата перевода", "Подтверждение агента", "Статус"];
    const lines = filtered.map((row) => [row.agentName, row.agentEmail, row.programName, row.missionTitle, row.contactName, row.contactCompany, row.amount, row.currency, row.createdAt, row.plannedAt || "", row.paidAt || "", row.partnerConfirmedAt || "", statusNames[row.status] || row.status]);
    const csv = `\uFEFF${[header, ...lines].map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "relay-payouts.csv"; link.click(); URL.revokeObjectURL(url);
  }

  return <div className="payout-workspace"><div className="payout-toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Агент, программа или заявка" aria-label="Поиск выплаты" /><div>{[["ALL", "Все"], ["APPROVED", "К выплате"], ["PAID", "Компания перевела"], ["PENDING", "Ожидают решения"]].map(([value, label]) => <button className={filter === value ? "active" : ""} type="button" onClick={() => setFilter(value)} key={value}>{label}</button>)}</div><button type="button" onClick={exportCsv}>Скачать реестр ↓</button></div>{notice && <div className="table-notice" role="status">{notice}</div>}<section className="payout-card-list">{filtered.map((row) => { const sla = slaState(payoutDueAt(row.approvedAt || row.createdAt, row.plannedAt), row.status === "PAID"); return <article className={`payout-record status-${row.status.toLowerCase()} ${sla.overdue ? "sla-overdue" : ""}`} key={row.id}><header><div><small>{<bdi data-no-translate>{row.programName}</bdi>}</small><h3>{<bdi data-no-translate>{row.missionTitle}</bdi>}</h3><p>{<bdi data-no-translate>{row.contactName}</bdi>}{row.contactCompany ? ` · ${row.contactCompany}` : ""}</p></div><span>{statusNames[row.status] ?? row.status}</span></header><div className="payout-record-body"><div><small>АГЕНТ</small><strong>{row.agentName}</strong><a href={`mailto:${row.agentEmail}`}>{row.agentEmail}</a></div><div><small>СУММА</small><strong>{formatMoney(row.amount, row.currency)}</strong><span>Согласованная сумма · начислено {formatDate(row.createdAt)}</span></div><div><small>СРОК ВЫПЛАТЫ</small><strong>{row.plannedAt ? formatDate(row.plannedAt) : "7 дней после начисления"}</strong><span className={sla.overdue ? "sla-label overdue" : "sla-label"}>{row.paidAt ? `Перевод ${formatDate(row.paidAt)}` : sla.label}</span></div><div><small>ПОДТВЕРЖДЕНИЕ АГЕНТА</small><strong>{row.partnerConfirmedAt ? "✓ Получено" : row.status === "PAID" ? "Ожидаем" : "—"}</strong><span>{row.partnerConfirmedAt ? formatDate(row.partnerConfirmedAt) : "Отдельная отметка агента"}</span></div></div><footer><label><input type="checkbox" checked={row.status === "PAID"} disabled={pending === row.id || !!row.partnerConfirmedAt || !["APPROVED", "PAID"].includes(row.status)} onChange={(event) => void setPaid(row, event.target.checked)} /><span>{row.status === "PAID" ? "Компания отметила перевод" : "Отметить перевод"}</span></label></footer></article>; })}</section>{!filtered.length && <div className="table-empty">По выбранным условиям начислений нет.</div>}</div>;
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate, formatInteger } from "@/lib/format-display";

type Row = { id: string; agentName: string; agentEmail: string; missionTitle: string; programName: string; contactName: string; contactCompany: string; amount: number; currency: string; status: string; plannedAt: string | null; paidAt: string | null; partnerConfirmedAt: string | null; createdAt: string };
const statusNames: Record<string, string> = { PENDING: "Ожидает решения", APPROVED: "К выплате", PAID: "Выплачено", CANCELLED: "Отменено" };

export function RewardLedger({ initialRows }: { initialRows: Row[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [filter, setFilter] = useState("ALL");
  const [pending, setPending] = useState("");
  const [notice, setNotice] = useState("");
  const filtered = useMemo(() => rows.filter((row) => filter === "ALL" || row.status === filter), [filter, rows]);

  async function setPaid(row: Row, paid: boolean) {
    setPending(row.id); setNotice("");
    try {
      const response = await fetch(`/api/rewards/${row.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ paid }) });
      const data = await response.json() as { error?: string; paidAt?: string | null; partnerConfirmedAt?: string | null };
      if (!response.ok) throw new Error(data.error || "Не удалось обновить выплату");
      setRows((items) => items.map((item) => item.id === row.id ? { ...item, status: paid ? "PAID" : "APPROVED", paidAt: data.paidAt ?? null, partnerConfirmedAt: data.partnerConfirmedAt ?? null } : item));
      setNotice(paid ? "Компания отметила перевод. В статистике сумма появится после подтверждения агента." : "Начисление возвращено в список к выплате.");
      router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Ошибка"); } finally { setPending(""); }
  }

  function exportCsv() {
    const header = ["Агент", "Email", "Программа", "Задание", "Связанный контакт", "Компания контакта", "Сумма", "Валюта", "Создано", "Плановая дата", "Дата перевода", "Подтверждение агента", "Статус"];
    const lines = filtered.map((row) => [row.agentName, row.agentEmail, row.programName, row.missionTitle, row.contactName, row.contactCompany, row.amount, row.currency, row.createdAt, row.plannedAt || "", row.paidAt || "", row.partnerConfirmedAt || "", statusNames[row.status] || row.status]);
    const csv = `\uFEFF${[header, ...lines].map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "relay-payouts.csv"; link.click(); URL.revokeObjectURL(url);
  }

  return <div className="data-table-block"><div className="brand-table-controls payout-controls"><div>{[["ALL", "Все"], ["APPROVED", "К выплате"], ["PAID", "Компания оплатила"], ["PENDING", "Ожидают решения"]].map(([value, label]) => <button className={filter === value ? "active" : ""} type="button" onClick={() => setFilter(value)} key={value}>{label}</button>)}</div><button type="button" onClick={exportCsv}>Скачать реестр ↓</button></div>{notice && <div className="table-notice" role="status">{notice}</div>}<div className="brand-table payout-table payout-table-confirmation"><div className="brand-table-head"><span>АГЕНТ</span><span>ОСНОВАНИЕ</span><span>ПРОГРАММА</span><span>СУММА</span><span>СРОК</span><span>КОМПАНИЯ</span><span>АГЕНТ ПОЛУЧИЛ</span></div>{filtered.map((row) => <div className="brand-table-row" key={row.id}><div><b>{row.agentName}</b><small>{row.agentEmail}</small></div><div><b>{row.missionTitle}</b><small>{row.contactName} · {row.contactCompany}</small></div><div><b>{row.programName}</b><small>{formatDate(row.createdAt)}</small></div><div><b>{formatInteger(row.amount)} {row.currency}</b><small>{statusNames[row.status] ?? row.status}</small></div><div><b>{row.plannedAt ? formatDate(row.plannedAt) : "Не задан"}</b><small>{row.paidAt ? `Перевод ${formatDate(row.paidAt)}` : "Плановая дата"}</small></div><div className="paid-status-cell"><label><input type="checkbox" checked={row.status === "PAID"} disabled={pending === row.id || !["APPROVED", "PAID"].includes(row.status)} onChange={(event) => void setPaid(row, event.target.checked)} /><span>{row.status === "PAID" ? "Перевели" : "Отметить"}</span></label></div><div className="agent-receipt-cell"><b>{row.partnerConfirmedAt ? "✓ Подтвердил" : row.status === "PAID" ? "Ожидаем" : "—"}</b><small>{row.partnerConfirmedAt ? formatDate(row.partnerConfirmedAt) : row.status === "PAID" ? "Агент ещё не отметил получение" : "Сначала отметьте перевод"}</small></div></div>)}{!filtered.length && <div className="table-empty">В этом статусе начислений нет.</div>}</div></div>;
}

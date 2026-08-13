"use client";

import { useMemo, useState } from "react";
import { formatDateTime } from "@/lib/format-display";

type Item = { id: string; partnerName: string; partnerEmail: string; partnerPhone: string; missionTitle: string; programName: string; rewardValue: number; rewardLabel: string; currency: string; contactName: string; contactCompany: string; contactEmail: string; contactPhone: string; partnerComment: string; companyComment: string; status: string; createdAt: string; attachments: Array<{ id: string; objectKey: string | null; externalUrl: string | null; fileName: string; mimeType: string; size: number }> };

const statuses = [["SUBMITTED", "Отправлен"], ["REVIEWING", "Проверяется"], ["ACCEPTED", "Принят"], ["IN_PROGRESS", "В работе"], ["DEAL", "Сделка"], ["REWARDED", "Вознаграждение"], ["REJECTED", "Отклонён"]];

export function SubmissionReviewList({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState(initialItems);
  const [pending, setPending] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const filtered = useMemo(() => items.filter((item) => {
    const haystack = `${item.partnerName} ${item.partnerEmail} ${item.programName} ${item.missionTitle} ${item.contactName} ${item.contactCompany} ${item.contactEmail} ${item.contactPhone}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase()) && (statusFilter === "ALL" || item.status === statusFilter);
  }), [items, query, statusFilter]);

  async function update(item: Item, form: HTMLFormElement) {
    setPending(item.id); setNotice("");
    const values = new FormData(form);
    const payload = { status: values.get("status"), comment: values.get("comment"), amount: values.get("amount"), currency: item.currency, plannedAt: values.get("plannedAt") };
    try {
      const response = await fetch(`/api/submissions/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось сохранить решение");
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, status: String(payload.status), companyComment: String(payload.comment || "") } : row));
      setNotice("Решение сохранено. Агент увидит новый статус и комментарий в своём кабинете.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Ошибка"); } finally { setPending(""); }
  }

  if (!items.length) return null;
  return <div className="company-review-list">
    <div className="review-list-controls"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти агента, контакт или программу" aria-label="Поиск результата" /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Фильтр по статусу"><option value="ALL">Все статусы · {items.length}</option>{statuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><span>Показано {filtered.length}</span></div>
    {notice && <div className="inline-notice" role="status">{notice}</div>}
    {filtered.map((item) => {
      const digits = item.contactPhone.replace(/\D/g, "");
      const chatText = encodeURIComponent(`Здравствуйте! Ваш контакт мне передал агент ${item.partnerName} через Relay. Пишу по рекомендации по поводу возможного сотрудничества.`);
      const agentDigits = item.partnerPhone.replace(/\D/g, "");
      const agentText = encodeURIComponent(`Здравствуйте, ${item.partnerName}! Компания обновила статус результата «${item.missionTitle}» в Relay. Откройте кабинет агента, чтобы увидеть решение и комментарий.`);
      return <article key={item.id}>
        <div className="company-review-head"><div><span>{item.programName} · {item.missionTitle}</span><h3>{item.contactName} · {item.contactCompany}</h3><p>Передал агент {item.partnerName} ({item.partnerEmail}) · {formatDateTime(item.createdAt)}</p></div><strong>{statuses.find(([value]) => value === item.status)?.[1] ?? item.status}</strong></div>
        <div className="lead-private-data"><div><small>EMAIL</small>{item.contactEmail ? <a href={`mailto:${item.contactEmail}`}>{item.contactEmail}</a> : <b>—</b>}</div><div><small>ТЕЛЕФОН</small>{digits ? <a className="whatsapp-link" href={`https://wa.me/${digits}?text=${chatText}`} target="_blank" rel="noreferrer">◉ {item.contactPhone}</a> : <b>—</b>}</div><div><small>КОНТЕКСТ</small><b>{item.partnerComment || "Комментарий не оставлен"}</b></div></div>
        {item.attachments.length > 0 && <div className="result-attachments"><span>ФАЙЛЫ И ССЫЛКИ АГЕНТА</span><div>{item.attachments.map((attachment) => <a href={attachment.externalUrl || `/api/company/files/${attachment.id}`} target="_blank" rel="noreferrer" key={attachment.id}><i>{attachment.externalUrl ? "↗" : attachment.mimeType.startsWith("image/") ? "▧" : "↓"}</i><span><b>{attachment.fileName}</b><small>{attachment.externalUrl ? "Внешняя ссылка" : `${Math.max(1, Math.round(attachment.size / 1024))} КБ`}</small></span></a>)}</div></div>}
        <form onSubmit={(event) => { event.preventDefault(); void update(item, event.currentTarget); }}><label><span>Статус</span><select name="status" defaultValue={item.status}>{statuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="review-comment"><span>Комментарий агенту</span><textarea name="comment" defaultValue={item.companyComment} rows={3} placeholder="Объясните решение. При отказе комментарий обязателен." /></label><label><span>Сумма</span><input name="amount" type="number" min="0" defaultValue={item.rewardValue} /></label><label><span>Плановая выплата</span><input name="plannedAt" type="date" /></label><button type="submit" disabled={pending === item.id}>{pending === item.id ? "Сохраняем…" : "Сохранить решение"}</button>{agentDigits && <a className="notify-agent-link" href={`https://wa.me/${agentDigits}?text=${agentText}`} target="_blank" rel="noreferrer">Уведомить агента в WhatsApp ↗</a>}</form>
      </article>;
    })}
    {!filtered.length && <div className="table-empty">По выбранным условиям результатов нет.</div>}
  </div>;
}

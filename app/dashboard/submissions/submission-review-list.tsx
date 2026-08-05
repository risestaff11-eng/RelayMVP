"use client";

import { useState } from "react";

type Item = { id: string; partnerName: string; partnerEmail: string; missionTitle: string; programName: string; rewardValue: number; rewardLabel: string; currency: string; contactName: string; contactCompany: string; contactEmail: string; contactPhone: string; partnerComment: string; companyComment: string; status: string; createdAt: string };

const statuses = [["SUBMITTED", "Отправлен"], ["REVIEWING", "Проверяется"], ["ACCEPTED", "Принят"], ["IN_PROGRESS", "В работе"], ["DEAL", "Сделка"], ["REWARDED", "Вознаграждение"], ["REJECTED", "Отклонён"]];

export function SubmissionReviewList({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState(initialItems);
  const [pending, setPending] = useState("");
  const [notice, setNotice] = useState("");

  async function update(item: Item, form: HTMLFormElement) {
    setPending(item.id); setNotice("");
    const values = new FormData(form);
    const payload = { status: values.get("status"), comment: values.get("comment"), amount: values.get("amount"), currency: item.currency, plannedAt: values.get("plannedAt") };
    try {
      const response = await fetch(`/api/submissions/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось сохранить решение");
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, status: String(payload.status), companyComment: String(payload.comment || "") } : row));
      setNotice("Решение сохранено и появилось в истории партнёра.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Ошибка"); } finally { setPending(""); }
  }

  if (!items.length) return null;
  return <div className="company-review-list">{notice && <div className="inline-notice" role="status">{notice}</div>}{items.map((item) => <article key={item.id}><div className="company-review-head"><div><span>{item.programName} · {item.missionTitle}</span><h3>{item.contactName} · {item.contactCompany}</h3><p>Передал {item.partnerName} ({item.partnerEmail}) · {new Date(item.createdAt).toLocaleString("ru-RU")}</p></div><strong>{statuses.find(([value]) => value === item.status)?.[1] ?? item.status}</strong></div><div className="lead-private-data"><div><small>EMAIL</small><b>{item.contactEmail || "—"}</b></div><div><small>ТЕЛЕФОН</small><b>{item.contactPhone || "—"}</b></div><div><small>КОНТЕКСТ</small><b>{item.partnerComment || "Комментарий не оставлен"}</b></div></div><form onSubmit={(event) => { event.preventDefault(); void update(item, event.currentTarget); }}><label><span>Статус</span><select name="status" defaultValue={item.status}>{statuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="review-comment"><span>Комментарий партнёру</span><textarea name="comment" defaultValue={item.companyComment} rows={3} placeholder="Объясните решение. При отказе комментарий обязателен." /></label><label><span>Сумма</span><input name="amount" type="number" min="0" defaultValue={item.rewardValue} /></label><label><span>Плановая выплата</span><input name="plannedAt" type="date" /></label><button type="submit" disabled={pending === item.id}>{pending === item.id ? "Сохраняем…" : "Сохранить решение"}</button></form></article>)}</div>;
}

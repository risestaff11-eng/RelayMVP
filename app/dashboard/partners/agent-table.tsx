"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate, formatInteger } from "@/lib/format-display";

type Agent = { id: string; name: string; email: string; phone: string; status: string; joinedAt: string; lastActiveAt: string | null; programName: string; resultCount: number; dealCount: number; dueAmount: number; paidAmount: number };

function whatsapp(phone: string, name: string) {
  const digits = phone.replace(/\D/g, "");
  const text = encodeURIComponent(`Здравствуйте, ${name}! Пишу вам как представитель компании, к агентской программе которой вы присоединились через RiseStaff.`);
  return digits ? `https://wa.me/${digits}?text=${text}` : "";
}

export function AgentTable({ initialAgents }: { initialAgents: Agent[] }) {
  const router = useRouter();
  const [agents, setAgents] = useState(initialAgents);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [pending, setPending] = useState("");
  const [notice, setNotice] = useState("");
  const filtered = useMemo(() => agents.filter((agent) => {
    const matchesQuery = `${agent.name} ${agent.email} ${agent.phone} ${agent.programName}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (status === "ALL" || agent.status === status);
  }), [agents, query, status]);

  async function togglePaid(agent: Agent, paid: boolean) {
    setPending(agent.id); setNotice("");
    try {
      const response = await fetch(`/api/agents/${agent.id}/paid`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ paid }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось изменить выплату");
      setAgents((rows) => rows.map((row) => row.id === agent.id ? { ...row, paidAmount: paid ? row.paidAmount + row.dueAmount : 0, dueAmount: paid ? 0 : row.dueAmount + row.paidAmount } : row));
      setNotice(paid ? "Выплаты агента отмечены как завершённые." : "Выплаты возвращены в статус «К выплате». ");
      router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Ошибка"); } finally { setPending(""); }
  }

  async function changeStatus(agent: Agent) {
    const nextStatus = agent.status === "BLOCKED" ? "ACTIVE" : "BLOCKED";
    if (nextStatus === "BLOCKED" && !window.confirm(`Ограничить доступ агенту ${agent.name || agent.email}? Его персональная ссылка перестанет работать.`)) return;
    setPending(agent.id); setNotice("");
    try {
      const response = await fetch(`/api/agents/${agent.id}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: nextStatus }) });
      const data = await response.json() as { error?: string; status?: string };
      if (!response.ok || !data.status) throw new Error(data.error || "Не удалось изменить доступ");
      setAgents((rows) => rows.map((row) => row.id === agent.id ? { ...row, status: data.status! } : row));
      setNotice(nextStatus === "BLOCKED" ? "Доступ агента ограничен. История и начисления сохранены." : "Доступ агента восстановлен.");
      router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Ошибка"); } finally { setPending(""); }
  }

  return <div className="agent-directory"><div className="directory-controls"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Имя, email, телефон или программа" aria-label="Поиск агента" /><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Статус агента"><option value="ALL">Все статусы</option><option value="ACTIVE">Активные</option><option value="BLOCKED">Доступ ограничен</option></select><span>{filtered.length} из {agents.length}</span></div>{notice && <div className="table-notice" role="status">{notice}</div>}<section className="agent-card-grid">{filtered.map((agent) => { const chat = whatsapp(agent.phone, agent.name); const paid = agent.paidAmount > 0 && agent.dueAmount === 0; const activeLabel = agent.status === "BLOCKED" ? "Доступ ограничен" : agent.lastActiveAt ? `Активен ${formatDate(agent.lastActiveAt)}` : "Только зарегистрирован"; return <article className={`agent-directory-card agent-status-${agent.status.toLowerCase()}`} key={agent.id}><header><span>{(agent.name || agent.email).slice(0,1).toUpperCase()}</span><div><h3>{agent.name || agent.email.split("@")[0]}</h3><a href={`mailto:${agent.email}`}>{agent.email}</a></div><b>{agent.status === "BLOCKED" ? "ОГРАНИЧЕН" : "АКТИВЕН"}</b></header><div className="agent-program-line"><small>ПРОГРАММЫ</small><strong>{agent.programName}</strong><span>{activeLabel}</span></div><div className="agent-contribution-grid"><div><small>РЕЗУЛЬТАТЫ</small><strong>{agent.resultCount}</strong></div><div><small>СДЕЛКИ</small><strong>{agent.dealCount}</strong></div><div><small>ЗАРАБОТАЛ</small><strong>{formatInteger(agent.paidAmount)} ₸</strong></div><div><small>К ВЫПЛАТЕ</small><strong>{formatInteger(agent.dueAmount)} ₸</strong></div></div><div className="agent-contact-line">{chat ? <a href={chat} target="_blank" rel="noreferrer">◉ Написать в WhatsApp <span>{agent.phone}</span></a> : <span>Телефон не указан</span>}</div><footer><label title={agent.dueAmount || agent.paidAmount ? "Изменить статус начислений агента" : "У агента ещё нет начислений"}><input type="checkbox" checked={paid} disabled={pending === agent.id || (!agent.dueAmount && !agent.paidAmount)} onChange={(event) => void togglePaid(agent, event.target.checked)} /><span>{paid ? "Выплачено" : agent.dueAmount ? "Отметить выплату" : "Нет начислений"}</span></label><button type="button" disabled={pending === agent.id} onClick={() => void changeStatus(agent)}>{agent.status === "BLOCKED" ? "Восстановить" : "Ограничить"}</button></footer></article>; })}</section>{!filtered.length && <div className="table-empty">По выбранным условиям агентов нет.</div>}</div>;
}

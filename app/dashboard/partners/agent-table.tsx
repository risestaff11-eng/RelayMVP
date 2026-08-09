"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Agent = { id: string; name: string; email: string; phone: string; status: string; joinedAt: string; lastActiveAt: string | null; programName: string; resultCount: number; dealCount: number; dueAmount: number; paidAmount: number };

function whatsapp(phone: string, name: string) {
  const digits = phone.replace(/\D/g, "");
  const text = encodeURIComponent(`Здравствуйте, ${name}! Пишу вам как представитель компании, к агентской программы которой вы присоединились через Relay.`);
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

  return <div className="data-table-block"><div className="brand-table-controls"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Имя, email, телефон или программа" aria-label="Поиск агента" /><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Статус агента"><option value="ALL">Все статусы</option><option value="ACTIVE">Активные</option><option value="PAUSED">На паузе</option></select><span>{filtered.length} из {agents.length}</span></div>{notice && <div className="table-notice" role="status">{notice}</div>}<div className="brand-table agent-table"><div className="brand-table-head"><span>АГЕНТ</span><span>ТЕЛЕФОН</span><span>ПРОГРАММА</span><span>ВКЛАД</span><span>ВЫПЛАТЫ</span><span>СТАТУС</span></div>{filtered.map((agent) => { const chat = whatsapp(agent.phone, agent.name); const paid = agent.paidAmount > 0 && agent.dueAmount === 0; return <div className="brand-table-row" key={agent.id}><div className="agent-identity"><b>{agent.name || agent.email.split("@")[0]}</b><small>{agent.email}</small><em>с {new Date(agent.joinedAt).toLocaleDateString("ru-RU")}</em></div><div>{chat ? <a className="whatsapp-link" href={chat} target="_blank" rel="noreferrer">◉ {agent.phone}</a> : <span className="muted-cell">Не указан</span>}</div><div><b>{agent.programName}</b><small>{agent.lastActiveAt ? `Активен ${new Date(agent.lastActiveAt).toLocaleDateString("ru-RU")}` : "Только зарегистрирован"}</small></div><div><b>{agent.resultCount} результатов</b><small>{agent.dealCount} сделок</small></div><div><b>{agent.paidAmount.toLocaleString("ru-RU")} ₸ выплачено</b><small>{agent.dueAmount.toLocaleString("ru-RU")} ₸ к выплате</small></div><div className="paid-status-cell"><label title={agent.dueAmount || agent.paidAmount ? "Изменить статус всех начислений агента" : "У агента ещё нет начислений"}><input type="checkbox" checked={paid} disabled={pending === agent.id || (!agent.dueAmount && !agent.paidAmount)} onChange={(event) => void togglePaid(agent, event.target.checked)} /><span>{paid ? "Выплачено" : agent.dueAmount ? "Отметить" : "Нет начислений"}</span></label></div></div>; })}{!filtered.length && <div className="table-empty">По выбранным условиям агентов нет.</div>}</div></div>;
}

"use client";
import { useState } from "react";
import { SafeLink as Link } from "@/app/safe-link";
import { agentReward, clientAttention, clientStage, type AgentClient } from "@/lib/agent-workspace";
import { formatDate } from "@/lib/format-display";
export function AgentClientList({ clients, token, payoutDays, now }: {
    clients: AgentClient[];
    token: string;
    payoutDays: number;
    now: number;
}) {
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("ALL");
    const [program, setProgram] = useState("");
    const programs = [...new Map(clients.map(c => [c.programId, c.mission?.programName || "Программа"])).entries()];
    const found = clients.filter(c => { const q = search.trim().toLowerCase(); const digits = q.replace(/\D/g, ""); const matches = !q || [c.contactName, c.contactCompany, c.contactPhone, c.mission?.programName].some(v => v?.toLowerCase().includes(q)) || (digits.length >= 3 && c.contactPhone.replace(/\D/g, "").includes(digits)); return matches && (!program || c.programId === program) && (filter === "ALL" || (filter === "ATTENTION" ? Boolean(clientAttention(c, payoutDays, now)) : filter === "PAID" ? c.salesStatus === "WON" : filter === "CLOSED" ? c.reviewStatus === "REJECTED" || c.salesStatus === "LOST" : ["PENDING", "REVIEWING"].includes(c.reviewStatus))); }).sort((a, b) => Number(Boolean(clientAttention(b, payoutDays, now))) - Number(Boolean(clientAttention(a, payoutDays, now))));
    return <><div className="agent-client-filters"><label><span>Поиск клиента</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Имя, телефон или программа"/></label><label><span>Показать</span><select value={filter} onChange={e => setFilter(e.target.value)}><option value="ALL">Все клиенты</option><option value="ATTENTION">Требует внимания</option><option value="REVIEW">На проверке</option><option value="PAID">Оплачено клиентом</option><option value="CLOSED">Отказ / брак</option></select></label><label><span>Программа</span><select value={program} onChange={e => setProgram(e.target.value)}><option value="">Все программы</option>{programs.map(([id, name]) => <option key={id} value={id} data-no-translate>{name}</option>)}</select></label></div><div className="agent-client-grid">{found.map(c => { const r = agentReward(c.reward, c.mission?.rewardLabel); const attention = clientAttention(c, payoutDays, now); return <Link className="agent-client-card" href={`/partner/${token}/submissions/${c.id}`} key={c.id}><div className="agent-card-meta"><span data-no-translate>{c.mission?.programName}</span><time>{formatDate(c.createdAt)}</time></div><h2 data-no-translate>{c.contactName || c.contactCompany}</h2><p data-no-translate>{c.contactPhone}</p><strong>{clientStage(c)}</strong><div className="agent-card-reward"><b>{r.amount}</b><span>{r.label}</span></div>{attention && <p className="agent-attention">{attention}</p>}<small>Последнее изменение: {formatDate(c.events.reduce((latest, event) => event.createdAt > latest ? event.createdAt : latest, c.updatedAt))}</small></Link>; })}</div>{!found.length && <p role="status">Клиентов по выбранным условиям пока нет.</p>}</>;
}

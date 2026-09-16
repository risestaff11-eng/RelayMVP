"use client";
import { useState } from "react";
import { SafeLink as Link } from "@/app/safe-link";
import { AcceptMissionButton } from "./partner-actions";
import { ReferralLinkBuilder } from "./referral-link-builder";
type Mission = {
    id: string;
    title: string;
    description: string;
    programName: string;
    rewardLabel: string;
    type: string;
    verificationRules: string;
    instructions: string[];
    proofRequirements: string[];
    resources: Array<{
        id: string;
        fileName: string;
    }>;
};
export function AgentTaskList({ missions, acceptedMissionIds, token }: {
    missions: Mission[];
    acceptedMissionIds: string[];
    token: string;
}) {
    const [filter, setFilter] = useState(acceptedMissionIds.length ? "MINE" : "ALL");
    const tasks = missions.filter(m => filter === "ALL" || acceptedMissionIds.includes(m.id)).sort((a, b) => Number(acceptedMissionIds.includes(b.id)) - Number(acceptedMissionIds.includes(a.id)));
    return <><div className="agent-task-tabs" aria-label="Выбор заданий"><button type="button" aria-pressed={filter === "MINE"} onClick={() => setFilter("MINE")}>Мои задания</button><button type="button" aria-pressed={filter === "ALL"} onClick={() => setFilter("ALL")}>Все доступные</button></div><div className="agent-task-grid">{tasks.map(m => <article className="agent-task-card" id={`task-${m.id}`} key={m.id}><small data-no-translate>{m.programName}</small><h2 data-no-translate>{m.title}</h2><strong className="agent-task-amount" data-no-translate>{m.rewardLabel}</strong><p data-no-translate>{m.description}</p><details><summary>Условия и материалы</summary><h3>Что сделать</h3><ol>{m.instructions.map((s, i) => <li key={i} data-no-translate>{s}</li>)}</ol><h3>Когда засчитают</h3><p data-no-translate>{m.verificationRules}</p><ul>{m.proofRequirements.map((s, i) => <li key={i} data-no-translate>{s}</li>)}</ul>{m.resources.map(r => <a key={r.id} href={`/api/partner/mission-files/${r.id}?token=${token}`} data-no-translate>{r.fileName}</a>)}<Link href={`/partner/${token}/materials`}>База знаний компании →</Link></details><AcceptMissionButton token={token} missionId={m.id} accepted={acceptedMissionIds.includes(m.id)} actionLabel={["LEAD", "DEAL"].includes(m.type) ? "Передать клиента" : "Передать результат"} resultHref={`/partner/${token}/submit/${m.id}`}/>{["LEAD", "DEAL"].includes(m.type) && <details><summary>Отправить ссылку клиенту</summary>{acceptedMissionIds.includes(m.id) ? <ReferralLinkBuilder token={token} missions={[m]}/> : <AcceptMissionButton token={token} missionId={m.id} actionLabel="Принять условия и получить ссылку" resultHref={`/partner/${token}/referral?mission=${m.id}`}/>}</details>}</article>)}</div>{!tasks.length && <div className="panel"><p>Заданий в работе пока нет.</p><button type="button" onClick={() => setFilter("ALL")}>Посмотреть доступные задания</button></div>}</>;
}

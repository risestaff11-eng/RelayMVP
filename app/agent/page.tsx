import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAgentWorkspace } from "../../db/agent-access";
import { getAgentSession } from "../../lib/agent-auth";
import { countRu, formatMoney } from "@/lib/format-display";

export const metadata: Metadata = { title: "Мои компании и задания · RiseStaff", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AgentWorkspacePage() {
  const session = await getAgentSession();
  if (!session) redirect("/agent-login");
  const workspace = await getAgentWorkspace(session.email, session.phone);
  if (!workspace) redirect("/agent-login");
  if (workspace.companies.length === 1) redirect(`/api/agent/open?companyId=${encodeURIComponent(workspace.companies[0].id)}`);
  return <main className="agent-workspace-page"><header><a href="https://risestaff.kz/" className="agent-access-brand"><i>R</i><b>RiseStaff</b></a><a href="/api/agent/logout">Выйти</a></header><section className="agent-company-picker" role="dialog" aria-labelledby="agent-company-picker-title"><div className="agent-workspace-intro"><small>ВЫБОР РАБОЧЕГО ПРОСТРАНСТВА</small><h1 id="agent-company-picker-title">{workspace.name}, с какой компанией работаем?</h1><p>Данные компаний не смешиваются. После выбора вы увидите только задания, отчёты, результаты и выплаты этой компании.</p></div><div className="agent-company-grid">{workspace.companies.map((company) => <article key={company.id}><header><i>{company.name.slice(0,1).toUpperCase()}</i><div><small>КОМПАНИЯ</small><h2>{company.name}</h2></div></header><div className="agent-company-programs">{company.programs.map((program) => <div key={program.id}><span><b>{program.name}</b><small>{countRu(program.missionCount, "задание", "задания", "заданий")} · {countRu(program.submissionCount, "результат", "результата", "результатов")}</small></span>{program.pendingRewards > 0 && <strong>{formatMoney(program.pendingRewards, program.currency)}</strong>}</div>)}</div><a href={`/api/agent/open?companyId=${encodeURIComponent(company.id)}`}>Перейти в кабинет компании <b>→</b></a></article>)}</div></section></main>;
}

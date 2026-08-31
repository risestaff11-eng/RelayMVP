import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAgentWorkspace } from "../../db/agent-access";
import { getAgentSession } from "../../lib/agent-auth";

export const metadata: Metadata = { title: "Мои компании и задания · Yaler", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AgentWorkspacePage() {
  const session = await getAgentSession();
  if (!session) redirect("/agent-login");
  const workspace = await getAgentWorkspace(session.email, session.phone);
  if (!workspace) redirect("/agent-login");
  if (workspace.companies.length === 1) redirect(`/api/agent/open?companyId=${encodeURIComponent(workspace.companies[0].id)}`);
  return <main className="agent-workspace-page"><header><a href="https://risestaff.kz/" className="agent-access-brand"><i>Y</i><b>Yaler</b></a><a href="/api/agent/logout">Выйти</a></header><section className="agent-workspace-intro"><small>КАБИНЕТ АГЕНТА</small><h1>{workspace.name}, выберите компанию</h1><p>Здесь собраны все компании, в которых вы участвуете. Внутри — программы, задания, результаты и выплаты.</p></section><div className="agent-company-grid">{workspace.companies.map((company) => <article key={company.id}><header><i>{company.name.slice(0,1).toUpperCase()}</i><div><small>КОМПАНИЯ</small><h2>{company.name}</h2></div></header><div className="agent-company-programs">{company.programs.map((program) => <div key={program.id}><span><b>{program.name}</b><small>{program.missionCount} заданий · {program.submissionCount} результатов</small></span>{program.pendingRewards > 0 && <strong>{program.pendingRewards.toLocaleString("ru-RU")} ₸</strong>}</div>)}</div><a href={`/api/agent/open?companyId=${encodeURIComponent(company.id)}`}>Открыть задания <b>→</b></a></article>)}</div></main>;
}

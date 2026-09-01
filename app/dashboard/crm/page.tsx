import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getCompanyForUser } from "../../../db/company";
import { getAgentsForCompany, getCompanyOperations, getProgramsForCompany, getSubmissionsForCompany } from "../../../db/programs";
import { SafeLink as Link } from "@/app/safe-link";
import { CopyProgramLink } from "../_components/table-actions";
import { AgentTable } from "../partners/agent-table";
import { countRu, formatMoneyGroups } from "@/lib/format-display";
import { agentUrl } from "@/lib/public-origins";
import { CrmWorkspace, type CrmLead } from "./crm-workspace";

export const metadata: Metadata = { title: "CRM" };
export const dynamic = "force-dynamic";

type Query = { view?: string; submission?: string };

export default async function CrmPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const view = query.view === "agents" ? "agents" : "pipeline";
  const returnTo = query.submission ? `/dashboard/crm?submission=${encodeURIComponent(query.submission)}` : `/dashboard/crm${view === "agents" ? "?view=agents" : ""}`;
  const user = await requireChatGPTUser(returnTo);
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");

  const [stats, submissions, agents, programs] = await Promise.all([
    getCompanyOperations(company.id),
    getSubmissionsForCompany(company.id),
    getAgentsForCompany(company.id),
    getProgramsForCompany(company.id),
  ]);
  const activeProgram = programs.find((program) => program.status === "ACTIVE");
  const inviteUrl = activeProgram ? agentUrl(`/p/${activeProgram.slug}`) : null;
  const paidLabel = formatMoneyGroups(stats.paidRewardsByCurrency);

  return <div className="dashboard-content module-content operations-page crm-page">
    <div className="module-heading crm-heading"><div><span className="module-kicker">ЛИДЫ ОТ АМБАССАДОРОВ</span><h1>CRM</h1><p>Смотрите, кто привёл клиента, где он сейчас и сколько денег находится в воронке.</p></div>{inviteUrl ? <div className="partner-invite-actions"><Link className="button button-ghost compact-button" href={inviteUrl} target="_blank">Страница для рекомендаций ↗</Link><CopyProgramLink href={inviteUrl} /></div> : <Link className="button button-primary compact-button" href="/dashboard/programs">Опубликовать программу →</Link>}</div>

    <nav className="crm-tabs" aria-label="Разделы CRM"><Link className={view === "pipeline" ? "active" : ""} href="/dashboard/crm"><span>01</span><strong>Клиенты и сделки</strong><small>{countRu(submissions.length, "заявка", "заявки", "заявок")}</small></Link><Link className={view === "agents" ? "active" : ""} href="/dashboard/crm?view=agents"><span>02</span><strong>Рекомендатели</strong><small>{countRu(agents.length, "человек", "человека", "человек")}</small></Link></nav>

    {view === "pipeline" ? <CrmWorkspace companyName={company.name} initialItems={submissions as CrmLead[]} initialSelectedId={query.submission || ""} initialSettings={{ monthlyGoal: company.crmMonthlyGoal, averageCheck: company.crmAverageCheck, conversionRate: company.crmConversionRate, leadsPerAmbassador: company.crmLeadsPerAmbassador, currency: company.crmGoalCurrency }} /> : <>
      <section className="operations-metrics brand-metrics crm-metrics"><article><small>ПОДКЛЮЧЕНЫ</small><strong>{stats.partners}</strong><span>Вошли по ссылке программы</span></article><article><small>ПРИВЕЛИ КЛИЕНТА</small><strong>{stats.contributedPartners}</strong><span>Есть хотя бы одна заявка</span></article><article><small>ДОВЕЛИ ДО СДЕЛКИ</small><strong>{stats.convertedPartners}</strong><span>Есть состоявшаяся продажа</span></article><article><small>ПОЛУЧИЛИ ВЫПЛАТЫ</small><strong>{paidLabel}</strong><span>Подтверждено амбассадорами</span></article></section>
      <section className="panel workflow-panel"><div className="panel-header"><div><h2>Амбассадоры в CRM</h2><p>Контакты, программы, вклад, сделки, выплаты и доступ каждого участника.</p></div><Link className="button button-ghost compact-button" href="/dashboard/agent-rating">Открыть рейтинг →</Link></div>{agents.length ? <AgentTable initialAgents={agents} /> : <div className="operations-empty compact"><div className="operations-empty-icon">○</div><h3>Амбассадоров пока нет</h3><p>Поделитесь ссылкой активной программы. После первого входа человек появится здесь.</p></div>}</section>
    </>}
  </div>;
}

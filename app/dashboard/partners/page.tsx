import type { Metadata } from "next";
import { SafeLink as Link } from "@/app/safe-link";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getCompanyForUser } from "../../../db/company";
import { getAgentsForCompany, getCompanyOperations, getProgramsForCompany } from "../../../db/programs";
import { CopyProgramLink } from "../_components/table-actions";
import { AgentTable } from "./agent-table";
import { formatInteger } from "@/lib/format-display";
import { agentUrl } from "@/lib/public-origins";

export const metadata: Metadata = { title: "Агенты" };
export const dynamic = "force-dynamic";

export default async function PartnersPage() {
  const user = await requireChatGPTUser("/dashboard/partners");
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");
  const [stats, programs, agents] = await Promise.all([getCompanyOperations(company.id), getProgramsForCompany(company.id), getAgentsForCompany(company.id)]);
  const activeProgram = programs.find((program) => program.status === "ACTIVE");
  const inviteUrl = activeProgram ? agentUrl(`/p/${activeProgram.slug}`) : null;
  const paid = agents.reduce((total, agent) => total + agent.paidAmount, 0);
  return <div className="dashboard-content module-content operations-page"><div className="module-heading"><div><span className="module-kicker">ВАША СЕТЬ РЕКОМЕНДАЦИЙ</span><h1>Кто вас рекомендует</h1><p>Все, кому вы отправили ссылку и кто согласился участвовать. Здесь видны контакты, вклад и выплаты.</p></div>{inviteUrl ? <div className="partner-invite-actions"><Link className="button button-ghost compact-button" href={inviteUrl} target="_blank">Открыть страницу <span>↗</span></Link><CopyProgramLink href={inviteUrl} /></div> : <Link className="button button-primary compact-button" href="/dashboard/programs">Опубликовать программу <span>→</span></Link>}</div><section className="operations-metrics brand-metrics"><article><small>ПРИГЛАШЕНЫ</small><strong>{stats.partners}</strong><span>Открыли ссылку и вошли</span></article><article><small>ПРИВЕЛИ ЗАЯВКУ</small><strong>{stats.contributedPartners}</strong><span>Есть хотя бы одна заявка</span></article><article><small>ПРИВЕЛИ ПОКУПАТЕЛЯ</small><strong>{stats.convertedPartners}</strong><span>Есть подтверждённая сделка</span></article><article><small>ВЫПЛАЧЕНО</small><strong>{formatInteger(paid)} ₸</strong><span>Подтверждено агентами</span></article></section><section className="panel workflow-panel"><div className="panel-header"><div><h2>Участники программ</h2><p>Контакты, активность, вклад и выплаты каждого агента.</p></div></div>{agents.length ? <AgentTable initialAgents={agents} /> : <div className="operations-empty compact"><div className="operations-empty-icon">○</div><h3>Здесь появятся участники</h3><p>Опубликуйте программу и поделитесь ссылкой. Каждый, кто согласится участвовать, автоматически попадёт сюда.</p></div>}</section></div>;
}

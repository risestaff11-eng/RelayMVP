import type { Metadata } from "next";
import { SafeLink as Link } from "@/app/safe-link";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getCompanyForUser } from "../../../db/company";
import { getCompanyOperations, getRewardsForCompany } from "../../../db/programs";
import { RewardLedger } from "./reward-ledger";

export const metadata: Metadata = { title: "Выплаты агентам" };
export const dynamic = "force-dynamic";

export default async function RewardsPage() {
  const user = await requireChatGPTUser("/dashboard/rewards");
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");
  const [stats, rewardRows] = await Promise.all([getCompanyOperations(company.id), getRewardsForCompany(company.id)]);
  const rows = rewardRows.map(({ reward, agent, submission, mission, program }) => ({ id: reward.id, agentName: agent.name, agentEmail: agent.email, missionTitle: mission.title, programName: program.name, contactName: submission.contactName, contactCompany: submission.contactCompany, amount: reward.amount, currency: reward.currency, status: reward.status, plannedAt: reward.plannedAt, paidAt: reward.paidAt, createdAt: reward.createdAt }));
  const waiting = rows.filter((row) => row.status === "PENDING").length;
  const averageDays = rows.filter((row) => row.paidAt).length ? Math.round(rows.filter((row) => row.paidAt).reduce((total, row) => total + (new Date(row.paidAt!).getTime() - new Date(row.createdAt).getTime()) / 86400000, 0) / rows.filter((row) => row.paidAt).length) : null;
  return <div className="dashboard-content module-content operations-page"><div className="module-heading"><div><span className="module-kicker">ФИНАНСЫ АГЕНТСКОГО КАНАЛА</span><h1>Выплаты агентам</h1><p>Каждое начисление связано с заданием, результатом и конкретным агентом.</p></div><Link className="button button-ghost compact-button" href="/dashboard/programs">Настроить награды →</Link></div><section className="reward-hero"><div><small>К ВЫПЛАТЕ</small><strong>{stats.approvedRewards.toLocaleString("ru-RU")} ₸</strong><p>Подтверждено компанией, но ещё не отмечено выплаченным.</p></div><div className="reward-hero-stats"><span>Выплачено за всё время <b>{stats.paidRewards.toLocaleString("ru-RU")} ₸</b></span><span>Ожидают решения <b>{waiting}</b></span><span>Средний срок выплаты <b>{averageDays === null ? "—" : `${averageDays} дн.`}</b></span></div></section><section className="panel workflow-panel"><div className="panel-header"><div><h2>Реестр выплат</h2><p>Агент, основание, кампания, сумма, срок и фактический статус.</p></div></div>{rows.length ? <RewardLedger initialRows={rows} /> : <div className="operations-empty compact"><div className="operations-empty-icon">₸</div><h3>Начислений пока нет</h3><p>Они создаются после принятия результата и наследуют условия награды из задания.</p></div>}</section><div className="finance-note"><span>!</span><div><strong>Relay фиксирует, но пока не переводит деньги</strong><p>Компания выплачивает агенту самостоятельно и отмечает выплату галочкой. После этого сумма сразу попадает в показатель «Выплачено».</p></div></div></div>;
}

import type { Metadata } from "next";
import { SafeLink as Link } from "@/app/safe-link";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getCompanyForUser } from "../../../db/company";
import { getRewardsForCompany } from "../../../db/programs";
import { RewardLedger } from "./reward-ledger";
import { formatMoneyGroups } from "@/lib/format-display";

export const metadata: Metadata = { title: "Выплаты агентам" };
export const dynamic = "force-dynamic";

export default async function RewardsPage() {
  const user = await requireChatGPTUser("/dashboard/rewards");
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");
  const rewardRows = await getRewardsForCompany(company.id);
  const rows = rewardRows.map(({ reward, agent, submission, mission, program }) => ({ id: reward.id, agentName: agent.name, agentEmail: agent.email, missionTitle: mission.title, programName: program.name, contactName: submission.contactName, contactCompany: submission.contactCompany, amount: reward.amount, currency: reward.currency, status: reward.status, approvedAt: reward.approvedAt, plannedAt: reward.plannedAt, paidAt: reward.paidAt, partnerConfirmedAt: reward.partnerConfirmedAt, createdAt: reward.createdAt }));
  const waiting = rows.filter((row) => row.status === "PENDING").length;
  const averageDays = rows.filter((row) => row.partnerConfirmedAt).length ? Math.round(rows.filter((row) => row.partnerConfirmedAt).reduce((total, row) => total + (new Date(row.partnerConfirmedAt!).getTime() - new Date(row.createdAt).getTime()) / 86400000, 0) / rows.filter((row) => row.partnerConfirmedAt).length) : null;
  const approvedLabel = formatMoneyGroups(rows.filter((row) => row.status === "APPROVED").map(({ amount, currency }) => ({ amount, currency })));
  const confirmedLabel = formatMoneyGroups(rows.filter((row) => row.status === "PAID" && row.partnerConfirmedAt).map(({ amount, currency }) => ({ amount, currency })));
  return <div className="dashboard-content module-content operations-page"><div className="module-heading"><div><span className="module-kicker">ФИНАНСЫ АГЕНТСКОГО КАНАЛА</span><h1>Выплаты агентам</h1><p>Каждое начисление связано с заданием, заявкой и конкретным агентом.</p></div><Link className="button button-ghost compact-button" href="/dashboard/programs">Настроить вознаграждения →</Link></div><section className="reward-hero"><div><small>К ВЫПЛАТЕ</small><strong>{approvedLabel}</strong><p>Начислено компанией, но деньги ещё не отмечены переведёнными.</p></div><div className="reward-hero-stats"><span>Агенты подтвердили получение <b>{confirmedLabel}</b></span><span>Ожидают решения <b>{waiting}</b></span><span>Средний срок до получения <b>{averageDays === null ? "—" : `${averageDays} дн.`}</b></span></div></section><section className="panel workflow-panel"><div className="panel-header"><div><h2>Реестр выплат</h2><p>Отдельно видно отметку компании и подтверждение получения агентом.</p></div></div>{rows.length ? <RewardLedger initialRows={rows} /> : <div className="operations-empty compact"><div className="operations-empty-icon">¤</div><h3>Начислений пока нет</h3><p>Они создаются после принятия заявки. Сумма берётся из условий задания.</p></div>}</section><div className="finance-note"><span>!</span><div><strong>Yaler фиксирует, но пока не переводит деньги</strong><p>Компания отмечает перевод, а агент отдельно подтверждает получение. Только после обоих подтверждений сумма попадает в показатель «Агенты подтвердили получение».</p></div></div></div>;
}

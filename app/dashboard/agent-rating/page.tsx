import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getCompanyForUser } from "../../../db/company";
import { getCompanyAnalytics, getProgramsForCompany } from "../../../db/programs";
import { AnalyticsFilters } from "../analytics/analytics-filters";
import { AnalyticsReport } from "../analytics/analytics-report";
import { countRu, formatMoneyGroups } from "@/lib/format-display";
import { isAnalyticsProgram } from "@/lib/workflow";

export const metadata: Metadata = { title: "Рейтинг агентов" };
export const dynamic = "force-dynamic";

export default async function AgentRatingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const period = ["7", "30", "90", "all"].includes(String(query.period)) ? String(query.period) : "30";
  const campaign = typeof query.campaign === "string" ? query.campaign : "";
  const user = await requireChatGPTUser(`/dashboard/agent-rating?period=${period}${campaign ? `&campaign=${campaign}` : ""}`);
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");
  const programs = await getProgramsForCompany(company.id);
  const analyticsPrograms = programs.filter(isAnalyticsProgram);
  const validCampaign = analyticsPrograms.some((program) => program.id === campaign) ? campaign : "";
  const analytics = await getCompanyAnalytics(company.id, period === "all" ? null : Number(period), validCampaign || undefined);
  const activeAgentIds = new Set(analytics.results.map((result) => result.partnerId));
  const dealAgentIds = new Set(analytics.results.filter((result) => result.salesStatus === "WON").map((result) => result.partnerId));
  const paidRewards = analytics.rewards.filter((reward) => reward.status === "PAID" && reward.partnerConfirmedAt);
  const paidLabel = formatMoneyGroups(paidRewards.map(({ amount, currency }) => ({ amount, currency })));
  const reviewed = analytics.results.filter((result) => !["PENDING", "REVIEWING"].includes(result.reviewStatus));
  const quality = reviewed.length ? Math.round(reviewed.filter((result) => result.reviewStatus === "ACCEPTED").length / reviewed.length * 100) : null;
  const periodLabel = period === "all" ? "за всё время" : `за ${countRu(Number(period), "день", "дня", "дней")}`;
  const agents = analytics.byAgent.map((agent) => ({ ...agent, dueLabel: formatMoneyGroups(agent.dueByCurrency), paidLabel: formatMoneyGroups(agent.paidByCurrency) }));

  return <div className="dashboard-content module-content operations-page agent-rating-page">
    <div className="module-heading analytics-heading"><div><span className="module-kicker">ВКЛАД КАЖДОГО УЧАСТНИКА</span><h1>Рейтинг агентов</h1><p>Сравнивайте агентов по сделкам, качеству заявок, конверсии, деньгам и активности. Период и программа влияют на весь рейтинг.</p></div><AnalyticsFilters programs={analyticsPrograms.map(({ id, name }) => ({ id, name }))} period={period} programId={validCampaign} /></div>
    <section className="operations-metrics brand-metrics"><article><small>АГЕНТОВ В РЕЙТИНГЕ</small><strong>{analytics.agents.length}</strong><span>В рабочих программах</span></article><article><small>ПРИВЕЛИ ЗАЯВКУ</small><strong>{activeAgentIds.size}</strong><span>{periodLabel}</span></article><article><small>ДОВЕЛИ ДО СДЕЛКИ</small><strong>{dealAgentIds.size}</strong><span>Хотя бы одна сделка</span></article><article><small>КАЧЕСТВО ЗАЯВОК</small><strong>{quality === null ? "—" : `${quality}%`}</strong><span>Доля принятых после проверки</span></article></section>
    <section className="rating-principles"><article><span>01</span><div><strong>Результат важнее активности</strong><p>Сделка даёт больше баллов, чем заявка. Простое количество входов не поднимает место.</p></div></article><article><span>02</span><div><strong>Деньги считаются отдельно</strong><p>Можно сортировать по начислено и по фактически подтверждённым выплатам.</p></div></article><article><span>03</span><div><strong>Сравнение честное</strong><p>Архивные и тестовые программы не попадают в рейтинг по умолчанию.</p></div></article></section>
    <AnalyticsReport agents={agents} periodLabel={periodLabel} totals={{ agents: analytics.agents.length, active: activeAgentIds.size, results: analytics.results.length, deals: analytics.results.filter((result) => result.salesStatus === "WON").length, paidLabel }} title="Все агенты по рейтингу" description="Найдите человека, выберите нужный срез и откройте WhatsApp прямо из карточки." />
  </div>;
}

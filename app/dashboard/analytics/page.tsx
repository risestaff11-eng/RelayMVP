import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getCompanyForUser } from "../../../db/company";
import { getCompanyAnalytics, getProgramsForCompany } from "../../../db/programs";
import { AnalyticsFilters } from "./analytics-filters";

export const metadata: Metadata = { title: "Аналитика агентского канала" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const period = ["7", "30", "90", "all"].includes(String(query.period)) ? String(query.period) : "30";
  const campaign = typeof query.campaign === "string" ? query.campaign : "";
  const user = await requireChatGPTUser(`/dashboard/analytics?period=${period}${campaign ? `&campaign=${campaign}` : ""}`);
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");
  const programs = await getProgramsForCompany(company.id);
  const validCampaign = programs.some((program) => program.id === campaign) ? campaign : "";
  const analytics = await getCompanyAnalytics(company.id, period === "all" ? null : Number(period), validCampaign || undefined);
  const accepted = analytics.results.filter((result) => ["ACCEPTED", "IN_PROGRESS", "DEAL", "REWARDED"].includes(result.status)).length;
  const deals = analytics.results.filter((result) => result.status === "DEAL").length;
  const paid = analytics.rewards.filter((reward) => reward.status === "PAID").reduce((total, reward) => total + reward.amount, 0);
  const bucketCount = 7;
  const days = period === "all" ? 90 : Number(period);
  const bucketMs = Math.max(1, days / bucketCount) * 86400000;
  const now = analytics.calculatedAt;
  const buckets = Array.from({ length: bucketCount }, (_, index) => analytics.results.filter((result) => { const age = now - new Date(result.createdAt).getTime(); return age >= (bucketCount - index - 1) * bucketMs && age < (bucketCount - index) * bucketMs; }).length);
  const maxBucket = Math.max(1, ...buckets);
  return <div className="dashboard-content module-content operations-page"><div className="module-heading analytics-heading"><div><span className="module-kicker">АНАЛИТИКА АГЕНТСКОГО КАНАЛА</span><h1>Эффективность кампаний</h1><p>Период и кампания меняют все показатели, график и таблицу ниже.</p></div><AnalyticsFilters programs={programs.map(({ id, name }) => ({ id, name }))} period={period} programId={validCampaign} /></div><section className="operations-metrics brand-metrics"><article><small>НОВЫЕ АГЕНТЫ</small><strong>{analytics.agents.length}</strong><span>За выбранный период</span></article><article><small>РЕЗУЛЬТАТЫ</small><strong>{analytics.results.length}</strong><span>По всем типам заданий</span></article><article><small>ПРИНЯТО / СДЕЛКИ</small><strong>{accepted} / {deals}</strong><span>{analytics.results.length ? `${Math.round(deals / analytics.results.length * 100)}% в сделку` : "Нет данных"}</span></article><article><small>ВЫПЛАЧЕНО</small><strong>{paid.toLocaleString("ru-RU")} ₸</strong><span>Отмеченные выплаты</span></article></section><div className="analytics-grid"><section className="panel analytics-chart-card"><div className="panel-header"><div><h2>Динамика результатов</h2><p>Фактические отправки за выбранный период.</p></div><span>{period === "all" ? "Всё время" : `${period} дней`}</span></div><div className="actual-chart">{buckets.map((value, index) => <div key={index}><i style={{ height: `${Math.max(4, value / maxBucket * 100)}%` }} /><span>{value}</span></div>)}</div></section><section className="panel funnel-card"><div className="panel-header"><h2>Воронка агентов</h2></div><div className="funnel-list"><div><span>Зарегистрировались</span><b>{analytics.agents.length}</b><i style={{ width: "100%" }} /></div><div><span>Передали результат</span><b>{new Set(analytics.results.map((result) => result.partnerId)).size}</b><i style={{ width: `${analytics.agents.length ? Math.max(4, new Set(analytics.results.map((result) => result.partnerId)).size / analytics.agents.length * 100) : 0}%` }} /></div><div><span>Результат принят</span><b>{accepted}</b><i style={{ width: `${analytics.results.length ? Math.max(4, accepted / analytics.results.length * 100) : 0}%` }} /></div><div><span>Дошли до сделки</span><b>{deals}</b><i style={{ width: `${analytics.results.length ? Math.max(4, deals / analytics.results.length * 100) : 0}%` }} /></div></div></section></div><section className="panel workflow-panel analytics-table-panel"><div className="panel-header"><div><h2>Сравнение кампаний</h2><p>Главные показатели в одном месте.</p></div></div><div className="brand-table analytics-table"><div className="brand-table-head"><span>КАМПАНИЯ</span><span>АГЕНТЫ</span><span>РЕЗУЛЬТАТЫ</span><span>ПРИНЯТО</span><span>СДЕЛКИ</span><span>ВЫПЛАЧЕНО</span></div>{analytics.byProgram.map((row) => <div className="brand-table-row" key={row.id}><div><b>{row.name}</b><small>{row.results ? `${Math.round(row.deals / row.results * 100)}% в сделку` : "Нет результатов"}</small></div><b>{row.agents}</b><b>{row.results}</b><b>{row.accepted}</b><b>{row.deals}</b><b>{row.paid.toLocaleString("ru-RU")} ₸</b></div>)}{!analytics.byProgram.length && <div className="table-empty">В выбранном периоде кампаний нет.</div>}</div></section></div>;
}

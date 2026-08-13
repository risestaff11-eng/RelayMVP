import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getCompanyForUser } from "../../../db/company";
import { getCompanyAnalytics, getProgramsForCompany } from "../../../db/programs";
import { AnalyticsFilters } from "./analytics-filters";
import { CsvExportButton } from "../_components/table-actions";
import { formatDate, formatInteger } from "@/lib/format-display";

export const metadata: Metadata = { title: "Сравнение агентов" };
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
  const activeAgentIds = new Set(analytics.results.map((result) => result.partnerId));
  const acceptedAgentIds = new Set(analytics.results.filter((result) => ["ACCEPTED", "IN_PROGRESS", "DEAL", "REWARDED"].includes(result.status)).map((result) => result.partnerId));
  const dealAgentIds = new Set(analytics.results.filter((result) => result.status === "DEAL").map((result) => result.partnerId));
  const paid = analytics.rewards.filter((reward) => reward.status === "PAID").reduce((total, reward) => total + reward.amount, 0);
  const averageResults = activeAgentIds.size ? (analytics.results.length / activeAgentIds.size).toFixed(1) : "0";
  const rankedAgents = analytics.byAgent.slice(0, 5);
  const maxScore = Math.max(1, ...rankedAgents.map((agent) => agent.score));
  const periodLabel = period === "all" ? "за всё время" : `за ${period} дней`;
  const submittedToAccepted = analytics.results.length ? Math.round(analytics.results.filter((result) => ["ACCEPTED", "IN_PROGRESS", "DEAL", "REWARDED"].includes(result.status)).length / analytics.results.length * 100) : 0;
  const submittedToDeal = analytics.results.length ? Math.round(analytics.results.filter((result) => result.status === "DEAL").length / analytics.results.length * 100) : 0;
  const inactiveAgents = analytics.byAgent.filter((agent) => agent.results === 0).slice(0, 5);
  const exportRows = analytics.byAgent.map((agent) => [agent.name, agent.email, agent.phone, agent.programName, agent.results, agent.accepted, agent.deals, agent.acceptanceRate, agent.dealRate, agent.due, agent.paid, agent.lastActivity]);

  return (
    <div className="dashboard-content module-content operations-page agent-analytics-page">
      <div className="module-heading analytics-heading">
        <div>
          <span className="module-kicker">АНАЛИТИКА АГЕНТСКОГО КАНАЛА</span>
          <h1>Сравнение агентов</h1>
          <p>Смотрите, кто приводит результаты, конвертирует их в сделки и сколько заработал за выбранный период.</p>
        </div>
        <AnalyticsFilters programs={programs.map(({ id, name }) => ({ id, name }))} period={period} programId={validCampaign} />
      </div>

      <section className="operations-metrics brand-metrics">
        <article><small>ВСЕГО АГЕНТОВ</small><div className="analytics-metric-value"><strong>{analytics.agents.length}</strong><em>всего</em></div><span>В выбранных программах</span></article>
        <article><small>АКТИВНЫЕ АГЕНТЫ</small><div className="analytics-metric-value"><strong>{activeAgentIds.size}</strong><em>с результатом</em></div><span>Передали результат {periodLabel}</span></article>
        <article><small>РЕЗУЛЬТАТОВ НА АГЕНТА</small><div className="analytics-metric-value"><strong>{averageResults}</strong><em>в среднем</em></div><span>Только среди активных агентов</span></article>
        <article><small>ВЫПЛАЧЕНО АГЕНТАМ</small><div className="analytics-metric-value"><strong>{formatInteger(paid)}</strong><em>₸ за период</em></div><span>Фактически отмечено выплаченным</span></article>
      </section>

      <section className="analytics-decision-strip"><article><small>РЕЗУЛЬТАТ → ПРИНЯТО</small><strong>{submittedToAccepted}%</strong><span>Качество входящего потока</span></article><article><small>РЕЗУЛЬТАТ → СДЕЛКА</small><strong>{submittedToDeal}%</strong><span>Итоговая конверсия</span></article><article><small>ТРЕБУЮТ ВНИМАНИЯ</small><strong>{inactiveAgents.length}</strong><span>Без результата за период</span></article></section>

      <div className="analytics-grid agent-comparison-grid">
        <section className="panel agent-ranking-card">
          <div className="panel-header">
            <div><h2>Лидеры по результату</h2><p>Рейтинг учитывает отправки, принятые лиды и сделки.</p></div>
            <span>{periodLabel}</span>
          </div>
          <div className="agent-ranking">
            {rankedAgents.map((agent, index) => (
              <article className="agent-rank-row" key={agent.id}>
                <span className="agent-rank-number">{String(index + 1).padStart(2, "0")}</span>
                <div className="agent-rank-person"><strong>{agent.name || agent.email}</strong><small>{agent.programName}</small></div>
                <div className="agent-rank-track"><i style={{ width: `${Math.max(agent.score ? 8 : 0, agent.score / maxScore * 100)}%` }} /></div>
                <div className="agent-rank-result"><strong>{agent.deals}</strong><small>сделок</small></div>
              </article>
            ))}
            {!rankedAgents.length && <div className="table-empty">Агенты ещё не зарегистрировались. После перехода по публичной ссылке они появятся здесь.</div>}
          </div>
        </section>

        <section className="panel funnel-card agent-funnel-card">
          <div className="panel-header"><div><h2>Воронка агентов</h2><p>Количество людей на каждом этапе.</p></div></div>
          <div className="funnel-list">
            <div><span>Зарегистрировались</span><b>{analytics.agents.length}<em>всего</em></b><i style={{ width: analytics.agents.length ? "100%" : "0%" }} /></div>
            <div><span>Передали результат</span><b>{activeAgentIds.size}<em>из {analytics.agents.length}</em></b><i style={{ width: `${analytics.agents.length ? Math.max(4, activeAgentIds.size / analytics.agents.length * 100) : 0}%` }} /></div>
            <div><span>Получили принятие</span><b>{acceptedAgentIds.size}<em>из {analytics.agents.length}</em></b><i style={{ width: `${analytics.agents.length ? Math.max(4, acceptedAgentIds.size / analytics.agents.length * 100) : 0}%` }} /></div>
            <div><span>Довели до сделки</span><b>{dealAgentIds.size}<em>из {analytics.agents.length}</em></b><i style={{ width: `${analytics.agents.length ? Math.max(4, dealAgentIds.size / analytics.agents.length * 100) : 0}%` }} /></div>
          </div>
          <div className="agent-funnel-insight">
            <small>НОВЫЕ АГЕНТЫ</small>
            <strong>{analytics.newAgents.length}</strong>
            <span>{periodLabel}</span>
          </div>
        </section>
      </div>

      <section className="panel program-comparison-panel"><div className="panel-header"><div><h2>Эффективность программ</h2><p>Сравнение помогает понять, куда приглашать новых агентов и какие условия нужно пересмотреть.</p></div></div><div className="program-comparison-list">{analytics.byProgram.map((program) => { const conversion = program.results ? Math.round(program.deals / program.results * 100) : 0; return <article key={program.id}><div><strong>{program.name}</strong><small>{program.agents} агентов · {program.results} результатов</small></div><span><b>{program.accepted}</b> принято</span><span><b>{program.deals}</b> сделок</span><span><b>{conversion}%</b> конверсия</span><span><b>{formatInteger(program.paid)} ₸</b> выплачено</span></article>; })}{!analytics.byProgram.length && <div className="table-empty">Нет программ для сравнения.</div>}</div></section>

      <section className="panel workflow-panel analytics-table-panel">
        <div className="panel-header">
          <div><h2>Рейтинг и сравнение агентов</h2><p>Все показатели собраны по каждому агенту. Фильтры сверху меняют расчёт за период и программу.</p></div><CsvExportButton filename="relay-agent-analytics.csv" label="Скачать таблицу" headers={["Агент", "Email", "Телефон", "Программа", "Результаты", "Принято", "Сделки", "Принятие %", "Сделки %", "К выплате", "Выплачено", "Последняя активность"]} rows={exportRows} />
        </div>
        <div className="brand-table agent-analytics-table">
          <div className="brand-table-head"><span>АГЕНТ</span><span>РЕЗУЛЬТАТЫ</span><span>ПРИНЯТО</span><span>СДЕЛКИ</span><span>КОНВЕРСИЯ</span><span>К ВЫПЛАТЕ</span><span>ВЫПЛАЧЕНО</span><span>АКТИВНОСТЬ</span></div>
          {analytics.byAgent.map((agent) => (
            <div className="brand-table-row" key={agent.id}>
              <div><b>{agent.name || "Имя не указано"}</b><small>{agent.email} · {agent.programName}</small></div>
              <b>{agent.results}</b>
              <b>{agent.accepted}</b>
              <b>{agent.deals}</b>
              <b>{agent.dealRate}%</b>
              <b>{formatInteger(agent.due)} ₸</b>
              <b>{formatInteger(agent.paid)} ₸</b>
              <div><b>{formatDate(agent.lastActivity)}</b><small>{agent.results ? "Есть активность" : "Нет результатов за период"}</small></div>
            </div>
          ))}
          {!analytics.byAgent.length && <div className="table-empty">Нет агентов для сравнения. Опубликуйте программу и поделитесь ссылкой.</div>}
        </div>
      </section>

      {inactiveAgents.length > 0 && <section className="panel attention-agents-panel"><div className="panel-header"><div><h2>Кого стоит активировать</h2><p>Агенты без результатов в выбранном периоде. Свяжитесь с ними или предложите более подходящее задание.</p></div></div><div>{inactiveAgents.map((agent) => { const digits = agent.phone.replace(/\D/g, ""); const message = encodeURIComponent(`Здравствуйте, ${agent.name || "коллега"}! В программе «${agent.programName}» появились актуальные задания. Подскажите, нужна ли помощь с первым результатом?`); return <article key={agent.id}><span><strong>{agent.name || agent.email}</strong><small>{agent.programName} · активность {formatDate(agent.lastActivity)}</small></span>{digits ? <a href={`https://wa.me/${digits}?text=${message}`} target="_blank" rel="noreferrer">Написать в WhatsApp ↗</a> : <a href={`mailto:${agent.email}`}>Написать на email ↗</a>}</article>; })}</div></section>}
    </div>
  );
}

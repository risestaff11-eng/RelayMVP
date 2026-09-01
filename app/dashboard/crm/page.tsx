import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getCompanyForUser } from "../../../db/company";
import { getAgentsForCompany, getCompanyOperations, getProgramsForCompany, getSubmissionsForCompany } from "../../../db/programs";
import { SafeLink as Link } from "@/app/safe-link";
import { CsvExportButton, CopyProgramLink } from "../_components/table-actions";
import { SubmissionReviewList } from "../submissions/submission-review-list";
import { AgentTable } from "../partners/agent-table";
import { countRu, formatMoneyGroups } from "@/lib/format-display";
import { agentUrl } from "@/lib/public-origins";

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
  const pending = submissions.filter((item) => ["PENDING", "REVIEWING"].includes(item.reviewStatus));
  const inWork = submissions.filter((item) => item.reviewStatus === "ACCEPTED" && !["WON", "LOST"].includes(item.salesStatus));
  const won = submissions.filter((item) => item.salesStatus === "WON");
  const closed = submissions.filter((item) => item.reviewStatus === "REJECTED" || item.salesStatus === "LOST");
  const reviewed = submissions.filter((item) => !["PENDING", "REVIEWING"].includes(item.reviewStatus));
  const conversion = reviewed.length ? Math.round(won.length / reviewed.length * 100) : null;
  const clientKeys = new Set(submissions.map((item) => (item.contactEmail || item.contactPhone || (item.contactName || item.contactCompany ? `${item.contactName}:${item.contactCompany}` : "")).trim().toLowerCase()).filter(Boolean));
  const paidLabel = formatMoneyGroups(stats.paidRewardsByCurrency);
  const exportRows = submissions.map((item) => [item.contactName, item.contactCompany, item.contactPhone, item.contactEmail, item.programName, item.missionTitle, item.partnerName, item.partnerEmail, item.reviewStatus, item.salesStatus, item.ownershipStatus, item.rewardValue, item.currency, item.createdAt]);

  return <div className="dashboard-content module-content operations-page crm-page">
    <div className="module-heading crm-heading"><div><span className="module-kicker">ЕДИНАЯ БАЗА КЛИЕНТОВ И СДЕЛОК</span><h1>CRM</h1><p>Ведите заявку до сделки и сразу видьте, кто привёл клиента, по какой программе и какое вознаграждение нужно начислить.</p></div>{inviteUrl ? <div className="partner-invite-actions"><Link className="button button-ghost compact-button" href={inviteUrl} target="_blank">Страница для рекомендаций ↗</Link><CopyProgramLink href={inviteUrl} /></div> : <Link className="button button-primary compact-button" href="/dashboard/programs">Опубликовать программу →</Link>}</div>

    <nav className="crm-tabs" aria-label="Разделы CRM"><Link className={view === "pipeline" ? "active" : ""} href="/dashboard/crm"><span>01</span><strong>Клиенты и сделки</strong><small>{countRu(submissions.length, "заявка", "заявки", "заявок")}</small></Link><Link className={view === "agents" ? "active" : ""} href="/dashboard/crm?view=agents"><span>02</span><strong>Рекомендатели</strong><small>{countRu(agents.length, "человек", "человека", "человек")}</small></Link></nav>

    {view === "pipeline" ? <>
      <section className="operations-metrics brand-metrics crm-metrics"><article><small>КЛИЕНТОВ В БАЗЕ</small><strong>{clientKeys.size}</strong><span>Без повторов по контактам</span></article><article><small>ЖДУТ РЕШЕНИЯ</small><strong>{pending.length}</strong><span>SLA проверки — 48 часов</span></article><article><small>СДЕЛКИ</small><strong>{won.length}</strong><span>{conversion === null ? "Пока нет проверенных заявок" : `${conversion}% от проверенных заявок`}</span></article><article><small>АГЕНТОВ С ВКЛАДОМ</small><strong>{stats.contributedPartners}</strong><span>Из {countRu(stats.partners, "подключённого", "подключённых", "подключённых")}</span></article></section>

      <section className="crm-pipeline" aria-label="Воронка CRM"><header><div><small>ВОРОНКА ПРОДАЖ</small><h2>От заявки до сделки</h2></div><span>Перетаскивание не требуется: стадия меняется в карточке клиента</span></header><div><article className="stage-new"><small>01 · НОВЫЕ</small><strong>{pending.length}</strong><span>Проверить за 48 часов</span><i style={{ width: `${submissions.length ? Math.max(8, pending.length / submissions.length * 100) : 0}%` }} /></article><article className="stage-work"><small>02 · В РАБОТЕ</small><strong>{inWork.length}</strong><span>Компания приняла клиента</span><i style={{ width: `${submissions.length ? Math.max(8, inWork.length / submissions.length * 100) : 0}%` }} /></article><article className="stage-won"><small>03 · СДЕЛКА</small><strong>{won.length}</strong><span>Продажа состоялась</span><i style={{ width: `${submissions.length ? Math.max(8, won.length / submissions.length * 100) : 0}%` }} /></article><article className="stage-closed"><small>04 · ЗАКРЫТЫ</small><strong>{closed.length}</strong><span>Отказ или потеря сделки</span><i style={{ width: `${submissions.length ? Math.max(8, closed.length / submissions.length * 100) : 0}%` }} /></article></div></section>

      <aside className="antifraud-rule"><span>◎</span><div><strong>Дубли и авторство проверяются автоматически</strong><p>RiseStaff сверяет телефон и email по компании за 180 дней. Повторный контакт не закрепится за другим рекомендателем.</p></div></aside>
      <section className="panel workflow-panel"><div className="panel-header"><div><h2>Клиенты и сделки</h2><p>Поиск, фильтры, контакты, источник, SLA и независимые статусы проверки и продажи.</p></div><CsvExportButton filename="risestaff-crm.csv" label="Экспорт CRM" headers={["Клиент", "Компания", "Телефон", "Email", "Программа", "Задание", "Кто привёл", "Email рекомендателя", "Проверка", "Продажа", "Авторство", "Вознаграждение", "Валюта", "Дата"]} rows={exportRows} /></div>{submissions.length ? <SubmissionReviewList companyName={company.name} initialItems={submissions} initialSelectedId={query.submission || ""} /> : <div className="operations-empty"><div className="operations-empty-icon">↗</div><h3>CRM заполнится после первой заявки</h3><p>Опубликуйте программу и отправьте ссылку тем, кто готов рекомендовать вашу компанию.</p><Link className="button button-primary" href="/dashboard/programs">Подготовить программу →</Link></div>}</section>
    </> : <>
      <section className="operations-metrics brand-metrics crm-metrics"><article><small>ПОДКЛЮЧЕНЫ</small><strong>{stats.partners}</strong><span>Вошли по ссылке программы</span></article><article><small>ПРИВЕЛИ КЛИЕНТА</small><strong>{stats.contributedPartners}</strong><span>Есть хотя бы одна заявка</span></article><article><small>ДОВЕЛИ ДО СДЕЛКИ</small><strong>{stats.convertedPartners}</strong><span>Есть состоявшаяся продажа</span></article><article><small>ПОЛУЧИЛИ ВЫПЛАТЫ</small><strong>{paidLabel}</strong><span>Подтверждено рекомендателями</span></article></section>
      <section className="panel workflow-panel"><div className="panel-header"><div><h2>Рекомендатели в CRM</h2><p>Контакты, программы, вклад, сделки, выплаты и доступ каждого участника.</p></div><Link className="button button-ghost compact-button" href="/dashboard/agent-rating">Открыть рейтинг →</Link></div>{agents.length ? <AgentTable initialAgents={agents} /> : <div className="operations-empty compact"><div className="operations-empty-icon">○</div><h3>Рекомендателей пока нет</h3><p>Поделитесь ссылкой активной программы. После первого входа человек появится здесь.</p></div>}</section>
    </>}
  </div>;
}

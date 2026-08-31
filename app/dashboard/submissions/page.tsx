import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getCompanyForUser } from "../../../db/company";
import { getCompanyOperations, getSubmissionsForCompany } from "../../../db/programs";
import { SafeLink as Link } from "@/app/safe-link";
import { CsvExportButton } from "../_components/table-actions";
import { SubmissionReviewList } from "./submission-review-list";
import { countRu } from "@/lib/format-display";

export const metadata: Metadata = { title: "Заявки" };
export const dynamic = "force-dynamic";

export default async function SubmissionsPage({ searchParams }: { searchParams: Promise<{ submission?: string }> }) {
  const query = await searchParams;
  const returnTo = query.submission ? `/dashboard/submissions?submission=${encodeURIComponent(query.submission)}` : "/dashboard/submissions";
  const user = await requireChatGPTUser(returnTo);
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");
  const [stats, items] = await Promise.all([getCompanyOperations(company.id), getSubmissionsForCompany(company.id)]);
  const accepted = items.filter((item) => item.reviewStatus === "ACCEPTED").length;
  const reviewed = items.filter((item) => !["PENDING", "REVIEWING"].includes(item.reviewStatus));
  const conversion = reviewed.length ? `${Math.round(reviewed.filter((item) => item.salesStatus === "WON").length / reviewed.length * 100)}%` : "—";
  const exportRows = items.map((item) => [item.partnerName, item.partnerEmail, item.partnerPhone, item.programName, item.missionTitle, item.contactName, item.contactCompany, item.contactEmail, item.contactPhone, item.reviewStatus, item.salesStatus, item.ownershipStatus, item.rewardValue, item.currency, item.createdAt]);

  return <div className="dashboard-content module-content operations-page">
    <div className="module-heading"><div><span className="module-kicker">РЕШЕНИЯ ПО ЗАЯВКАМ</span><h1>Заявки, которые ждут вашего решения</h1><p>Сначала показаны новые клиенты. Откройте карточку и решите: взять в работу или отклонить с причиной.</p></div><Link className="button button-ghost compact-button" href="/dashboard/programs">Открыть программы →</Link></div>
    <section className="operations-metrics brand-metrics"><article><small>ВСЕГО ЗАЯВОК</small><strong>{stats.submissions}</strong><span>За всё время</span></article><article><small>ЖДУТ РЕШЕНИЯ</small><strong>{stats.awaitingReview}</strong><span>SLA проверки — 48 часов</span></article><article><small>ПРИНЯТЫ КОМПАНИЕЙ</small><strong>{accepted}</strong><span>Независимо от стадии продажи</span></article><article><small>КОНВЕРСИЯ В СДЕЛКУ</small><strong>{conversion}</strong><span>{reviewed.length ? `По ${countRu(reviewed.length, "проверенной заявке", "проверенным заявкам", "проверенным заявкам")}` : `Проверьте ${countRu(stats.awaitingReview, "заявку", "заявки", "заявок")}, чтобы увидеть конверсию`}</span></article></section>
    <aside className="antifraud-rule"><span>◎</span><div><strong>Контроль дублей и авторства включён</strong><p>Для лидов и сделок Yaler сверяет телефон и email по всей компании за 180 дней. Повторный контакт не создаётся под другим автором.</p></div></aside>
    <section className="panel workflow-panel"><div className="panel-header"><div><h2>Очередь заявок</h2><p>Проверка, движение продажи, авторство и выплата учитываются отдельно. Каждое изменение сохраняется в истории.</p></div><CsvExportButton filename="yaler-applications.csv" label="Скачать таблицу" headers={["Агент", "Email агента", "Телефон агента", "Программа", "Задание", "Контакт", "Компания контакта", "Email контакта", "Телефон контакта", "Проверка", "Продажа", "Авторство", "Вознаграждение", "Валюта", "Дата"]} rows={exportRows} /></div>
      {stats.submissions === 0 ? <div className="operations-empty"><div className="operations-empty-icon">↗</div><h3>Первой заявки пока нет</h3><p>После публикации программы агент выберет задание и передаст контакт или подтверждение выполнения.</p><Link className="button button-primary" href="/dashboard/programs">Подготовить программу <span>→</span></Link></div> : <SubmissionReviewList companyName={company.name} initialItems={items} initialSelectedId={query.submission || ""} />}
    </section>
  </div>;
}

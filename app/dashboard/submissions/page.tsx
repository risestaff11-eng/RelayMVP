import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getCompanyForUser } from "../../../db/company";
import { getCompanyOperations, getSubmissionsForCompany } from "../../../db/programs";
import { SafeLink as Link } from "@/app/safe-link";
import { CsvExportButton } from "../_components/table-actions";
import { SubmissionReviewList } from "./submission-review-list";

export const metadata: Metadata = { title: "Заявки" };
export const dynamic = "force-dynamic";

export default async function SubmissionsPage() {
  const user = await requireChatGPTUser("/dashboard/submissions");
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");
  const [stats, items] = await Promise.all([getCompanyOperations(company.id), getSubmissionsForCompany(company.id)]);
  const accepted = items.filter((item) => ["ACCEPTED", "IN_PROGRESS", "DEAL", "REWARDED"].includes(item.status)).length;
  const reviewed = items.filter((item) => !["SUBMITTED", "REVIEWING"].includes(item.status));
  const conversion = reviewed.length ? `${Math.round(reviewed.filter((item) => ["DEAL", "REWARDED"].includes(item.status)).length / reviewed.length * 100)}%` : "—";
  const exportRows = items.map((item) => [item.partnerName, item.partnerEmail, item.partnerPhone, item.programName, item.missionTitle, item.contactName, item.contactCompany, item.contactEmail, item.contactPhone, item.status, item.rewardValue, item.currency, item.createdAt]);

  return <div className="dashboard-content module-content operations-page">
    <div className="module-heading"><div><span className="module-kicker">РЕШЕНИЯ ПО ЗАЯВКАМ</span><h1>Заявки, которые ждут вашего решения</h1><p>Сначала показаны новые клиенты. Откройте карточку и решите: взять в работу или отклонить с причиной.</p></div><Link className="button button-ghost compact-button" href="/dashboard/programs">Открыть программы →</Link></div>
    <section className="operations-metrics brand-metrics"><article><small>ВСЕГО ЗАЯВОК</small><strong>{stats.submissions}</strong><span>За всё время</span></article><article><small>ЖДУТ РЕШЕНИЯ</small><strong>{stats.awaitingReview}</strong><span>Откройте и решите</span></article><article><small>ВЗЯТЫ В РАБОТУ</small><strong>{accepted}</strong><span>Приняты компанией</span></article><article><small>КОНВЕРСИЯ В СДЕЛКУ</small><strong>{conversion}</strong><span>{reviewed.length ? `По ${reviewed.length} проверенным заявкам` : `Проверьте ${stats.awaitingReview} заявок, чтобы увидеть конверсию`}</span></article></section>
    <section className="panel workflow-panel"><div className="panel-header"><div><h2>Очередь заявок</h2><p>Данные клиента, комментарии и файлы собраны в одной карточке. Каждое решение сохраняется в истории.</p></div><CsvExportButton filename="relay-applications.csv" label="Скачать таблицу" headers={["Агент", "Email агента", "Телефон агента", "Программа", "Задание", "Контакт", "Компания контакта", "Email контакта", "Телефон контакта", "Статус", "Вознаграждение", "Валюта", "Дата"]} rows={exportRows} /></div>
      {stats.submissions === 0 ? <div className="operations-empty"><div className="operations-empty-icon">↗</div><h3>Первой заявки пока нет</h3><p>После публикации программы агент выберет задание и передаст контакт или подтверждение выполнения.</p><Link className="button button-primary" href="/dashboard/programs">Подготовить программу <span>→</span></Link></div> : <SubmissionReviewList initialItems={items} />}
    </section>
  </div>;
}

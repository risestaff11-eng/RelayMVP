import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getCompanyForUser } from "../../../db/company";
import { getCompanyOperations, getSubmissionsForCompany } from "../../../db/programs";
import { SafeLink as Link } from "@/app/safe-link";
import { CsvExportButton } from "../_components/table-actions";
import { SubmissionReviewList } from "./submission-review-list";

export const metadata: Metadata = { title: "Результаты заданий" };
export const dynamic = "force-dynamic";

export default async function SubmissionsPage() {
  const user = await requireChatGPTUser("/dashboard/submissions");
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");
  const [stats, items] = await Promise.all([getCompanyOperations(company.id), getSubmissionsForCompany(company.id)]);
  const accepted = items.filter((item) => ["ACCEPTED", "IN_PROGRESS", "DEAL", "REWARDED"].includes(item.status)).length;
  const exportRows = items.map((item) => [item.partnerName, item.partnerEmail, item.partnerPhone, item.programName, item.missionTitle, item.contactName, item.contactCompany, item.contactEmail, item.contactPhone, item.status, item.rewardValue, item.currency, item.createdAt]);

  return <div className="dashboard-content module-content operations-page">
    <div className="module-heading"><div><span className="module-kicker">РЕЗУЛЬТАТЫ ЗАДАНИЙ</span><h1>Лиды и результаты</h1><p>Проверяйте доказательства, меняйте этап, назначайте выплату и сразу сообщайте решение агенту.</p></div><Link className="button button-ghost compact-button" href="/dashboard/programs">Открыть программы →</Link></div>
    <section className="operations-metrics brand-metrics"><article><small>ВСЕГО РЕЗУЛЬТАТОВ</small><strong>{stats.submissions}</strong><span>За всё время</span></article><article><small>ЖДУТ ПРОВЕРКИ</small><strong>{stats.awaitingReview}</strong><span>Требуют решения</span></article><article><small>ПРИНЯТО</small><strong>{accepted}</strong><span>Готовы к работе</span></article><article><small>КОНВЕРСИЯ В СДЕЛКУ</small><strong>{items.length ? `${Math.round(items.filter((item) => item.status === "DEAL").length / items.length * 100)}%` : "—"}</strong><span>По текущим данным</span></article></section>
    <section className="panel workflow-panel"><div className="panel-header"><div><h2>Очередь проверки</h2><p>Контакт, комментарии и файлы собраны в одной карточке. Каждое изменение статуса фиксируется в истории агента.</p></div><CsvExportButton filename="relay-results.csv" label="Скачать таблицу" headers={["Агент", "Email агента", "Телефон агента", "Программа", "Задание", "Контакт", "Компания контакта", "Email контакта", "Телефон контакта", "Статус", "Награда", "Валюта", "Дата"]} rows={exportRows} /></div>
      {stats.submissions === 0 ? <div className="operations-empty"><div className="operations-empty-icon">↗</div><h3>Первый результат ещё не отправлен</h3><p>После публикации программы агент выберет задание и передаст контакт или другое подтверждение.</p><Link className="button button-primary" href="/dashboard/programs">Подготовить программу <span>→</span></Link></div> : <SubmissionReviewList initialItems={items} />}
    </section>
  </div>;
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getCompanyForUser } from "../../../db/company";
import { getRewardsForCompany, getSubmissionsForCompany } from "../../../db/programs";
import { SafeLink as Link } from "@/app/safe-link";
import { countRu, formatDateTime, formatMoney } from "@/lib/format-display";
import { payoutDueAt, slaState } from "@/lib/workflow";

export const metadata: Metadata = { title: "Уведомления" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireChatGPTUser("/dashboard/notifications");
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");
  const [submissions, rewardRows] = await Promise.all([getSubmissionsForCompany(company.id), getRewardsForCompany(company.id)]);
  const pending = submissions.filter((item) => ["PENDING", "REVIEWING"].includes(item.reviewStatus));
  const overdueReviews = pending.filter((item) => slaState(item.reviewDueAt || null).overdue);
  const overduePayouts = rewardRows.filter(({ reward }) => reward.status === "APPROVED" && slaState(payoutDueAt(reward.approvedAt, reward.plannedAt)).overdue);
  const recentEvents = submissions.flatMap((submission) => submission.events.map((event) => ({ event, submission }))).sort((left, right) => right.event.createdAt.localeCompare(left.event.createdAt)).slice(0, 30);

  return <div className="dashboard-content module-content operations-page notifications-page"><div className="module-heading"><div><span className="module-kicker">ЦЕНТР УВЕДОМЛЕНИЙ</span><h1>Что требует внимания</h1><p>Новые заявки, просроченные решения, выплаты и история изменений собраны в одном месте.</p></div></div><section className="notification-summary"><Link href="/dashboard/crm"><small>ЖДУТ РЕШЕНИЯ</small><strong>{pending.length}</strong><span>{countRu(overdueReviews.length, "просрочена", "просрочены", "просрочено")}</span></Link><Link href="/dashboard/rewards"><small>ПРОСРОЧЕНЫ К ВЫПЛАТЕ</small><strong>{overduePayouts.length}</strong><span>По плановой дате или SLA 7 дней</span></Link><article><small>СОБЫТИЙ В ИСТОРИИ</small><strong>{recentEvents.length}</strong><span>Последние изменения заявок</span></article></section>{overdueReviews.length > 0 && <section className="panel notification-action-list"><div className="panel-header"><div><h2>Просрочена проверка</h2><p>Стандарт RiseStaff — принять решение по новой заявке за 48 часов.</p></div></div>{overdueReviews.map((item) => <Link href={`/dashboard/crm?submission=${item.id}`} key={item.id}><span>!</span><div><strong>{(item.contactName || item.contactCompany) ? ((item.contactName) ? (<bdi data-no-translate>{item.contactName}</bdi>) : (<bdi data-no-translate>{item.contactCompany}</bdi>)) : ("Заявка")}</strong><small>{<bdi data-no-translate>{item.programName}</bdi>} · {<bdi data-no-translate>{item.partnerName}</bdi>}</small></div><b>{slaState(item.reviewDueAt || null).label}</b></Link>)}</section>}{overduePayouts.length > 0 && <section className="panel notification-action-list"><div className="panel-header"><div><h2>Просрочена выплата</h2><p>Откройте реестр, отметьте перевод или уточните плановую дату.</p></div></div>{overduePayouts.map(({ reward, agent, mission }) => <Link href="/dashboard/rewards" key={reward.id}><span>¤</span><div><strong>{<bdi data-no-translate>{agent.name}</bdi>} · {formatMoney(reward.amount, reward.currency)}</strong><small>{<bdi data-no-translate>{mission.title}</bdi>}</small></div><b>{slaState(payoutDueAt(reward.approvedAt, reward.plannedAt)).label}</b></Link>)}</section>}<section className="panel notification-history"><div className="panel-header"><div><h2>История событий</h2><p>Решения не перезаписываются: RiseStaff сохраняет переходы и комментарии.</p></div></div>{recentEvents.length ? <div>{recentEvents.map(({ event, submission }) => <Link href={`/dashboard/crm?submission=${submission.id}`} key={event.id}><i>●</i><span><strong>{(submission.contactName || submission.contactCompany) ? ((submission.contactName) ? (<bdi data-no-translate>{submission.contactName}</bdi>) : (<bdi data-no-translate>{submission.contactCompany}</bdi>)) : ("Заявка")}</strong><small>{event.comment || `${event.fromStatus || "Создана"} → ${event.toStatus}`} · {formatDateTime(event.createdAt)}</small></span><b>Открыть →</b></Link>)}</div> : <div className="table-empty">Событий пока нет.</div>}</section></div>;
}

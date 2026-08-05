import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getCompanyForUser } from "../../../db/company";
import { getCompanyOperations } from "../../../db/programs";
import { CsvExportButton, StatusFilters } from "../_components/table-actions";

export const metadata: Metadata = { title: "Вознаграждения" };
export const dynamic = "force-dynamic";

export default async function RewardsPage() {
  const user = await requireChatGPTUser("/dashboard/rewards");
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");
  const stats = await getCompanyOperations(company.id);
  return <div className="dashboard-content module-content operations-page"><div className="module-heading"><div><span className="module-kicker">ФИНАНСЫ ПАРТНЁРСКОГО КАНАЛА</span><h1>Вознаграждения</h1><p>Начисления связаны с конкретным принятым результатом — партнёр всегда понимает основание, сумму и срок.</p></div><Link className="button button-ghost compact-button" href="/dashboard/programs">Настроить награды →</Link></div><section className="reward-hero"><div><small>К ВЫПЛАТЕ</small><strong>{stats.approvedRewards.toLocaleString("ru-RU")} ₸</strong><p>Подтверждено компанией, но ещё не отмечено выплаченным.</p></div><div className="reward-hero-stats"><span>Выплачено за всё время <b>{stats.paidRewards.toLocaleString("ru-RU")} ₸</b></span><span>Ожидают решения <b>0</b></span><span>Средний срок выплаты <b>—</b></span></div></section><section className="panel workflow-panel"><div className="panel-header"><div><h2>Реестр начислений</h2><p>Каждая строка связывает партнёра, миссию, результат и выплату.</p></div><CsvExportButton filename="relay-rewards.csv" label="Скачать реестр" headers={["Партнёр", "Основание", "Сумма", "Срок", "Статус"]} /></div><StatusFilters labels={["К выплате", "Начислено", "Выплачено", "Отменено"]} /><div className="empty-table-head reward-head"><span>ПАРТНЁР</span><span>ОСНОВАНИЕ</span><span>СУММА</span><span>СРОК</span><span>СТАТУС</span></div><div className="operations-empty compact"><div className="operations-empty-icon">₸</div><h3>Начислений пока нет</h3><p>Они создаются после принятия результата и наследуют условия вознаграждения из миссии.</p></div></section><div className="finance-note"><span>!</span><div><strong>Relay пока не переводит деньги</strong><p>На MVP компания выплачивает партнёру самостоятельно и отмечает выплату в системе. Платёжный шлюз будет отдельным этапом после проверки спроса.</p></div></div></div>;
}

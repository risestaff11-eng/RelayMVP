import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getCompanyForUser } from "../../../db/company";
import { getCompanyOperations } from "../../../db/programs";

export const metadata: Metadata = { title: "Результаты миссий" };
export const dynamic = "force-dynamic";

export default async function SubmissionsPage() {
  const user = await requireChatGPTUser("/dashboard/submissions");
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");
  const stats = await getCompanyOperations(company.id);
  return <div className="dashboard-content module-content operations-page"><div className="module-heading"><div><span className="module-kicker">РЕЗУЛЬТАТЫ МИССИЙ</span><h1>Лиды и результаты</h1><p>Единая очередь проверки: от первого контакта до принятого результата, сделки и начисления награды.</p></div><Link className="button button-ghost compact-button" href="/dashboard/programs">Открыть программы →</Link></div><section className="operations-metrics"><article><small>ВСЕГО РЕЗУЛЬТАТОВ</small><strong>{stats.submissions}</strong><span>За всё время</span></article><article><small>ЖДУТ ПРОВЕРКИ</small><strong>{stats.awaitingReview}</strong><span>Требуют решения</span></article><article><small>ПРИНЯТО</small><strong>0</strong><span>Готовы к работе</span></article><article><small>КОНВЕРСИЯ В СДЕЛКУ</small><strong>—</strong><span>Появится после данных</span></article></section><section className="panel workflow-panel"><div className="panel-header"><div><h2>Очередь проверки</h2><p>Фильтры повторяют реальный жизненный цикл рекомендации.</p></div><button type="button" disabled>Экспорт CSV</button></div><div className="status-filter-row"><span className="active">Все · {stats.submissions}</span><span>Отправлен</span><span>Проверяется</span><span>Принят</span><span>В работе</span><span>Сделка</span><span>Отклонён</span></div>{stats.submissions === 0 && <div className="operations-empty"><div className="operations-empty-icon">↗</div><h3>Первый результат ещё не отправлен</h3><p>После публикации программы партнёр выберет миссию и передаст лид, сделку, публикацию или другое подтверждение.</p><Link className="button button-primary" href="/dashboard/programs">Подготовить программу <span>→</span></Link></div>}</section><section className="review-principles"><article><span>01</span><strong>Проверьте соответствие</strong><p>Сверьте результат с критериями миссии и исключите дубли.</p></article><article><span>02</span><strong>Оставьте решение</strong><p>Примите, запросите уточнение или отклоните с понятной причиной.</p></article><article><span>03</span><strong>Не скрывайте прогресс</strong><p>Каждое изменение статуса должно быть видно партнёру.</p></article></section></div>;
}

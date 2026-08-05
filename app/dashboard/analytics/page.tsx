import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getCompanyForUser } from "../../../db/company";
import { getCompanyOperations } from "../../../db/programs";

export const metadata: Metadata = { title: "Аналитика" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const user = await requireChatGPTUser("/dashboard/analytics");
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");
  const stats = await getCompanyOperations(company.id);
  return <div className="dashboard-content module-content operations-page"><div className="module-heading"><div><span className="module-kicker">АНАЛИТИКА КАНАЛА</span><h1>Эффективность программы</h1><p>Здесь важны не просмотры сами по себе, а путь от приглашённого партнёра до принятого результата и оплаченной сделки.</p></div><Link className="button button-ghost compact-button" href="/dashboard/programs">Все программы →</Link></div><section className="operations-metrics"><article><small>АКТИВНЫЕ ПРОГРАММЫ</small><strong>{stats.activePrograms}</strong><span>Из {stats.programs} созданных</span></article><article><small>АКТИВНЫЕ ПАРТНЁРЫ</small><strong>{stats.activePartners}</strong><span>За последние 30 дней</span></article><article><small>РЕЗУЛЬТАТЫ</small><strong>{stats.submissions}</strong><span>Все типы миссий</span></article><article><small>ВЫПЛАЧЕНО</small><strong>{stats.paidRewards.toLocaleString("ru-RU")} ₸</strong><span>Стоимость канала</span></article></section><div className="analytics-grid"><section className="panel analytics-chart-card"><div className="panel-header"><div><h2>Динамика результатов</h2><p>Лиды, сделки, имиджевые и вовлекающие миссии.</p></div><span>Последние 30 дней</span></div><div className="empty-chart"><div className="chart-y"><span>12</span><span>8</span><span>4</span><span>0</span></div><div className="chart-canvas"><i style={{ height: "12%" }} /><i style={{ height: "18%" }} /><i style={{ height: "10%" }} /><i style={{ height: "25%" }} /><i style={{ height: "16%" }} /><i style={{ height: "22%" }} /><i style={{ height: "14%" }} /></div><p>График станет фактическим после первых результатов.</p></div></section><section className="panel funnel-card"><div className="panel-header"><h2>Воронка партнёров</h2></div><div className="funnel-list"><div><span>Открыли программу</span><b>0</b><i style={{ width: "100%" }} /></div><div><span>Присоединились</span><b>0</b><i style={{ width: "72%" }} /></div><div><span>Отправили результат</span><b>0</b><i style={{ width: "46%" }} /></div><div><span>Получили награду</span><b>0</b><i style={{ width: "24%" }} /></div></div></section></div><section className="analytics-question-grid"><article><span>01</span><strong>Кто активируется?</strong><p>Доля партнёров, которые не просто зарегистрировались, а выполнили миссию.</p></article><article><span>02</span><strong>Что приносит качество?</strong><p>Сравнение типов миссий по принятым результатам и сделкам.</p></article><article><span>03</span><strong>Сколько стоит результат?</strong><p>Выплаты на один принятый лид, одну встречу и одну сделку.</p></article></section></div>;
}

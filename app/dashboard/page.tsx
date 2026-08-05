import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../chatgpt-auth";
import { getCompanyForUser } from "../../db/company";

export const metadata: Metadata = { title: "Кабинет компании" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireChatGPTUser("/dashboard");
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");

  return (
    <div className="dashboard-content">
      <div className="dashboard-heading">
        <div><h1>Добро пожаловать, {user.fullName?.split(" ")[0] ?? "в Relay"}</h1><p>Подготовим партнёрскую программу {company.name} к первому запуску.</p></div>
        <a className="button button-primary" href="/dashboard/company-profile">Продолжить настройку <span>→</span></a>
      </div>

      <section className="metrics" aria-label="Основные показатели">
        <article className="metric"><div className="metric-top"><span>АКТИВНЫЕ ПРОГРАММЫ</span><span className="metric-icon">◇</span></div><strong>0</strong><small>Первая программа ещё не создана</small></article>
        <article className="metric"><div className="metric-top"><span>ПАРТНЁРЫ</span><span className="metric-icon">○</span></div><strong>0</strong><small>Появятся после публикации</small></article>
        <article className="metric"><div className="metric-top"><span>ПОЛУЧЕНО РЕЗУЛЬТАТОВ</span><span className="metric-icon">↗</span></div><strong>0</strong><small>Лиды, сделки и публикации</small></article>
        <article className="metric"><div className="metric-top"><span>К ВЫПЛАТЕ</span><span className="metric-icon">₸</span></div><strong>0 ₸</strong><small>Подтверждённые вознаграждения</small></article>
      </section>

      <section className="dashboard-grid">
        <div>
          <article className="setup-card">
            <div className="setup-card-top"><div><h3>Запуск программы</h3><p>Мы сохранили компанию. Дальше ИИ изучит {company.website}, сформирует профиль и подготовит четыре типа миссий.</p></div><span className="progress-badge">25%</span></div>
            <div className="progress-track"><span /></div>
            <div className="setup-steps">
              <div className="setup-step done"><strong>✓ Компания</strong>Основные данные сохранены</div>
              <a className="setup-step next" href="/dashboard/company-profile"><strong>02 AI-профиль →</strong>Продукты, ЦА и УТП</a>
              <a className="setup-step" href="/dashboard/programs"><strong>03 Миссии</strong>Лиды, сделки, имидж</a>
              <a className="setup-step" href="/dashboard/programs"><strong>04 Публикация</strong>Внешняя ссылка</a>
            </div>
          </article>

          <article className="panel" style={{ marginTop: 14 }}>
            <div className="panel-header"><h2>Партнёрские программы</h2><a href="/dashboard/programs">Открыть раздел →</a></div>
            <div className="empty-program"><div><div className="empty-program-icon">＋</div><h3>Здесь появится первая программа</h3><p>Сначала подтвердите профиль компании, затем Relay подготовит миссии.</p><a className="empty-link" href="/dashboard/company-profile">Перейти к профилю</a></div></div>
          </article>
        </div>

        <aside className="panel">
          <div className="panel-header"><h2>Последние события</h2><span>Сегодня</span></div>
          <div className="activity-list">
            <div className="activity"><span className="activity-mark">✓</span><div><strong>Компания создана</strong><p>{company.name} добавлена в Relay.</p></div></div>
            <div className="activity"><span className="activity-mark">◎</span><div><strong>Профиль ожидает анализа</strong><p>Следующим шагом Relay изучит сайт компании.</p></div></div>
            <div className="activity"><span className="activity-mark">↗</span><div><strong>Ссылка ещё не опубликована</strong><p>Она появится после подтверждения миссий.</p></div></div>
          </div>
        </aside>
      </section>
    </div>
  );
}

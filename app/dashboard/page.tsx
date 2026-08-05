import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { chatGPTSignOutPath, requireChatGPTUser } from "../chatgpt-auth";
import { getCompanyForUser } from "../../db/company";

export const metadata: Metadata = { title: "Кабинет компании" };
export const dynamic = "force-dynamic";

function initials(value: string) {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "R";
}

export default async function DashboardPage() {
  const user = await requireChatGPTUser("/dashboard");
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <a className="brand" href="/"><span className="brand-mark">R</span><span>Relay</span></a>
        <div className="sidebar-context"><small>РАБОЧЕЕ ПРОСТРАНСТВО</small><strong>{company.name}</strong></div>
        <nav className="sidebar-nav" aria-label="Навигация кабинета">
          <a className="active" href="/dashboard"><i>⌂</i>Обзор</a>
          <span><i>◇</i>Программы</span>
          <span><i>↗</i>Результаты</span>
          <span><i>○</i>Партнёры</span>
          <span><i>₸</i>Вознаграждения</span>
          <span><i>⌁</i>Аналитика</span>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user"><span className="sidebar-avatar">{initials(user.displayName)}</span><div><strong>{user.displayName}</strong><small>{user.email}</small></div></div>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <p>Компания зарегистрирована · следующий шаг — профиль бизнеса</p>
          <div className="top-actions"><span className="icon-button" aria-label="Уведомления">○</span><a className="icon-button" href={chatGPTSignOutPath("/")} aria-label="Выйти">↪</a></div>
        </header>

        <div className="dashboard-content">
          <div className="dashboard-heading">
            <div><h1>Добро пожаловать, {user.fullName?.split(" ")[0] ?? "в Relay"}</h1><p>Подготовим партнёрскую программу {company.name} к первому запуску.</p></div>
            <span className="button button-primary" aria-disabled="true">Продолжить настройку <span>→</span></span>
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
                  <div className="setup-step"><strong>02 AI-профиль</strong>Продукты, ЦА и УТП</div>
                  <div className="setup-step"><strong>03 Миссии</strong>Лиды, сделки, имидж</div>
                  <div className="setup-step"><strong>04 Публикация</strong>Внешняя ссылка</div>
                </div>
              </article>

              <article className="panel" style={{ marginTop: 14 }}>
                <div className="panel-header"><h2>Партнёрские программы</h2><span>0 программ</span></div>
                <div className="empty-program"><div><div className="empty-program-icon">＋</div><h3>Здесь появится первая программа</h3><p>На следующем этапе мы добавим AI-анализ сайта и генерацию миссий.</p></div></div>
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
      </section>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../chatgpt-auth";
import { getCompanyForUser } from "../../db/company";
import { getConfirmedCompanyProfile } from "../../db/profile";
import { getCompanyOperations, getProgramsForCompany } from "../../db/programs";

export const metadata: Metadata = { title: "Кабинет компании" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireChatGPTUser("/dashboard");
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");
  const [profile, stats, programs] = await Promise.all([getConfirmedCompanyProfile(company.id), getCompanyOperations(company.id), getProgramsForCompany(company.id)]);
  const hasProgram = programs.length > 0;
  const hasPublished = programs.some((program) => program.status === "ACTIVE");
  const progress = hasPublished ? 100 : hasProgram ? 75 : profile ? 50 : 25;
  const nextHref = !profile ? "/dashboard/company-profile" : !hasProgram ? "/dashboard/programs/new" : `/dashboard/programs/${programs[0].id}`;
  const nextLabel = !profile ? "Продолжить настройку" : !hasProgram ? "Создать программу" : hasPublished ? "Управлять программой" : "Продолжить программу";

  return (
    <div className="dashboard-content">
      <div className="dashboard-heading">
        <div><h1>Добро пожаловать, {user.fullName?.split(" ")[0] ?? "в Relay"}</h1><p>Подготовим партнёрскую программу {company.name} к первому запуску.</p></div>
        <Link className="button button-primary" href={nextHref}>{nextLabel} <span>→</span></Link>
      </div>

      <section className="metrics" aria-label="Основные показатели">
        <article className="metric"><div className="metric-top"><span>АКТИВНЫЕ ПРОГРАММЫ</span><span className="metric-icon">◇</span></div><strong>{stats.activePrograms}</strong><small>Из {stats.programs} созданных</small></article>
        <article className="metric"><div className="metric-top"><span>ПАРТНЁРЫ</span><span className="metric-icon">○</span></div><strong>{stats.partners}</strong><small>{stats.activePartners} активных</small></article>
        <article className="metric"><div className="metric-top"><span>ПОЛУЧЕНО РЕЗУЛЬТАТОВ</span><span className="metric-icon">↗</span></div><strong>{stats.submissions}</strong><small>{stats.awaitingReview} ждут проверки</small></article>
        <article className="metric"><div className="metric-top"><span>К ВЫПЛАТЕ</span><span className="metric-icon">₸</span></div><strong>{stats.approvedRewards.toLocaleString("ru-RU")} ₸</strong><small>Подтверждённые вознаграждения</small></article>
      </section>

      <section className="dashboard-grid">
        <div>
          <article className="setup-card">
            <div className="setup-card-top"><div><h3>Запуск программы</h3><p>{hasPublished ? "Программа опубликована. Следующий цикл — привлечение партнёров, проверка результатов и прозрачные выплаты." : "Relay ведёт от профиля компании до внешней ссылки с понятными миссиями и наградами."}</p></div><span className="progress-badge">{progress}%</span></div>
            <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
            <div className="setup-steps">
              <div className="setup-step done"><strong>✓ Компания</strong>Основные данные сохранены</div>
              <Link className={`setup-step ${!profile ? "next" : "done"}`} href="/dashboard/company-profile"><strong>{profile ? "✓" : "02"} AI-профиль {!profile && "→"}</strong>Продукты, ЦА и УТП</Link>
              <Link className={`setup-step ${profile && !hasProgram ? "next" : hasProgram ? "done" : ""}`} href={hasProgram ? `/dashboard/programs/${programs[0].id}` : "/dashboard/programs/new"}><strong>{hasProgram ? "✓" : "03"} Миссии</strong>Лиды, сделки, имидж</Link>
              <Link className={`setup-step ${hasProgram && !hasPublished ? "next" : hasPublished ? "done" : ""}`} href={hasProgram ? `/dashboard/programs/${programs[0].id}` : "/dashboard/programs"}><strong>{hasPublished ? "✓" : "04"} Публикация</strong>Внешняя ссылка</Link>
            </div>
          </article>

          <article className="panel" style={{ marginTop: 14 }}>
            <div className="panel-header"><h2>Партнёрские программы</h2><Link href="/dashboard/programs">Открыть раздел →</Link></div>
            {programs[0] ? <div className="dashboard-program-card"><div><span className={`program-status status-${programs[0].status.toLowerCase()}`}>● {programs[0].status === "ACTIVE" ? "Опубликована" : "Черновик"}</span><h3>{programs[0].name}</h3><p>{programs[0].missions.length} миссий · {programs[0].currency}</p></div><Link className="button button-ghost compact-button" href={`/dashboard/programs/${programs[0].id}`}>Открыть →</Link></div> : <div className="empty-program"><div><div className="empty-program-icon">＋</div><h3>Здесь появится первая программа</h3><p>Подтвердите профиль компании, затем Gemini подготовит миссии.</p><Link className="empty-link" href={profile ? "/dashboard/programs/new" : "/dashboard/company-profile"}>{profile ? "Создать программу" : "Перейти к профилю"}</Link></div></div>}
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

import type { Metadata } from "next";
import { SafeLink as Link } from "@/app/safe-link";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../chatgpt-auth";
import { getCompanyForUser } from "../../db/company";
import { getConfirmedCompanyProfile } from "../../db/profile";
import { getCompanyOperations, getProgramsForCompany, getSubmissionsForCompany } from "../../db/programs";
import { ProgramQuickActions } from "./_components/program-quick-actions";

export const metadata: Metadata = { title: "Кабинет компании" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireChatGPTUser("/dashboard");
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");
  const [profile, stats, programs, submissions] = await Promise.all([getConfirmedCompanyProfile(company.id), getCompanyOperations(company.id), getProgramsForCompany(company.id), getSubmissionsForCompany(company.id)]);
  const hasProgram = programs.length > 0;
  const hasPublished = programs.some((program) => program.status === "ACTIVE");
  const progress = hasPublished ? 100 : hasProgram ? 75 : profile ? 50 : 25;
  const nextHref = !hasProgram ? "/dashboard/programs/new" : `/dashboard/programs/${programs[0].id}`;
  const nextLabel = !hasProgram ? "Создать программу" : hasPublished ? "Управлять программой" : "Продолжить настройку";
  const latestProgram = programs[0];
  const latestResult = submissions[0];
  const activities = latestResult ? [
    { mark: "↗", title: "Получен новый результат", text: `${latestResult.contactName} · ${latestResult.programName}`, date: latestResult.createdAt, href: "/dashboard/submissions", action: "Проверить результат" },
    { mark: "◇", title: latestProgram?.status === "ACTIVE" ? "Программа опубликована" : "Программа обновлена", text: latestProgram?.name ?? company.name, date: latestProgram?.updatedAt ?? company.createdAt, href: latestProgram ? `/dashboard/programs/${latestProgram.id}` : "/dashboard/programs", action: "Открыть программу" },
    { mark: "○", title: "Агенты подключаются по ссылке", text: `${stats.partners} зарегистрировано`, date: latestResult.createdAt, href: "/dashboard/partners", action: "Посмотреть агентов" },
  ] : latestProgram ? [
    { mark: "◇", title: latestProgram.status === "ACTIVE" ? "Программа опубликована" : "Черновик программы сохранён", text: latestProgram.name, date: latestProgram.updatedAt, href: `/dashboard/programs/${latestProgram.id}`, action: latestProgram.status === "ACTIVE" ? "Скопировать ссылку" : "Продолжить настройку" },
    { mark: profile ? "✓" : "◎", title: profile ? "AI-профиль подтверждён" : "AI-профиль ждёт подтверждения", text: profile ? "Данные готовы для генерации заданий" : "Проверьте данные компании", date: profile?.confirmedAt ?? company.createdAt, href: "/dashboard/company-profile", action: "Открыть профиль" },
    { mark: "○", title: "Следующий шаг", text: latestProgram.status === "ACTIVE" ? "Пригласите первых агентов" : "Опубликуйте внешнюю ссылку", date: latestProgram.updatedAt, href: latestProgram.status === "ACTIVE" ? "/dashboard/partners" : `/dashboard/programs/${latestProgram.id}`, action: latestProgram.status === "ACTIVE" ? "Перейти к агентам" : "Опубликовать" },
  ] : [
    { mark: "✓", title: "Компания создана", text: `${company.name} добавлена в Relay`, date: company.createdAt, href: "/dashboard/settings", action: "Проверить данные" },
    { mark: profile ? "✓" : "◎", title: profile ? "AI-профиль подтверждён" : "Следующий шаг — AI-профиль", text: profile ? "Основа для заданий готова" : "Relay изучит сайт компании", date: profile?.confirmedAt ?? company.createdAt, href: "/dashboard/company-profile", action: "Открыть профиль" },
    { mark: "＋", title: "Создайте первую программу", text: "Соберите задания и условия выплат", date: company.createdAt, href: "/dashboard/programs/new", action: "Создать программу" },
  ];

  return (
    <div className="dashboard-content">
      <div className="dashboard-heading">
        <div><h1>Добро пожаловать, {user.fullName?.split(" ")[0] ?? "в Relay"}</h1><p>Здесь видно, как развивается агентский канал {company.name}.</p></div>
        <Link className="button button-primary" href={nextHref}>{nextLabel} <span>→</span></Link>
      </div>

      <section className="metrics" aria-label="Основные показатели">
        <article className="metric"><div className="metric-top"><span>АКТИВНЫЕ ПРОГРАММЫ</span><span className="metric-icon">◇</span></div><strong>{stats.activePrograms}</strong><small>Из {stats.programs} созданных</small></article>
        <article className="metric"><div className="metric-top"><span>АГЕНТЫ</span><span className="metric-icon">○</span></div><strong>{stats.partners}</strong><small>{stats.activePartners} активных</small></article>
        <article className="metric"><div className="metric-top"><span>ПОЛУЧЕНО РЕЗУЛЬТАТОВ</span><span className="metric-icon">↗</span></div><strong>{stats.submissions}</strong><small>{stats.awaitingReview} ждут проверки</small></article>
        <article className="metric"><div className="metric-top"><span>К ВЫПЛАТЕ</span><span className="metric-icon">₸</span></div><strong>{stats.approvedRewards.toLocaleString("ru-RU")} ₸</strong><small>Подтверждённые вознаграждения</small></article>
        <article className={`metric ai-balance-metric ${company.aiTokenBalance < 1000 ? "low" : ""}`}><div className="metric-top"><span>AI-БАЛАНС</span><span className="metric-icon">✦</span></div><strong>{company.aiTokenBalance.toLocaleString("ru-RU")}</strong><small>{company.aiTokenBalance < 1000 ? "Требуется пополнение" : "Токенов для анализа и генерации"}</small>{company.aiTokenBalance < 1000 && <a href="https://wa.me/77765086000?text=%D0%97%D0%B0%D0%BA%D0%BE%D0%BD%D1%87%D0%B8%D0%BB%D0%B8%D1%81%D1%8C%20%D1%82%D0%BE%D0%BA%D0%B5%D0%BD%D1%8B" target="_blank" rel="noreferrer">Пополнить в WhatsApp →</a>}</article>
      </section>

      <section className="dashboard-grid">
        <div>
          <article className="setup-card">
            <div className="setup-card-top"><div><h3>Запуск программы</h3><p>{hasPublished ? "Программа опубликована. Следующий цикл — привлечение агентов, проверка результатов и прозрачные выплаты." : "Relay ведёт от профиля компании до внешней ссылки с понятными заданиями и наградами."}</p></div><span className="progress-badge">{progress}%</span></div>
            <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
            <div className="setup-steps">
              <Link className="setup-step done" href="/dashboard/settings"><strong>✓ Компания →</strong>Основные данные сохранены</Link>
              <Link className={`setup-step ${!profile ? "next" : "done"}`} href="/dashboard/company-profile"><strong>{profile ? "✓" : "02"} AI-профиль {!profile && "→"}</strong>Продукты, ЦА и УТП</Link>
              <Link className={`setup-step ${profile && !hasProgram ? "next" : hasProgram ? "done" : ""}`} href={hasProgram ? `/dashboard/programs/${programs[0].id}` : "/dashboard/programs/new"}><strong>{hasProgram ? "✓" : "03"} Задания</strong>Лиды, сделки, имидж</Link>
              <Link className={`setup-step ${hasProgram && !hasPublished ? "next" : hasPublished ? "done" : ""}`} href={hasProgram ? `/dashboard/programs/${programs[0].id}` : "/dashboard/programs"}><strong>{hasPublished ? "✓" : "04"} Публикация</strong>Внешняя ссылка</Link>
            </div>
          </article>

          <article className="panel" style={{ marginTop: 14 }}>
            <div className="panel-header"><div><h2>Агентские программы</h2><p>Запускайте, приостанавливайте и архивируйте программы прямо здесь.</p></div><Link href="/dashboard/programs/new">＋ Новая программа</Link></div>
            {programs.length ? <div className="dashboard-campaign-mini-grid">{programs.slice(0, 3).map((program) => <article className={`dashboard-program-mini status-card-${program.status.toLowerCase()}`} key={program.id}><div><span className={`program-status status-${program.status.toLowerCase()}`}>● {program.status === "ACTIVE" ? "Опубликована" : program.status === "PAUSED" ? "На паузе" : program.status === "ARCHIVED" ? "В архиве" : "Черновик"}</span><Link href={`/dashboard/programs/${program.id}`} aria-label={`Открыть ${program.name}`}>↗</Link></div><Link className="dashboard-program-mini-main" href={`/dashboard/programs/${program.id}`}><h3>{program.name}</h3><p>{program.missions.length} заданий · {program.agentCount} агентов · {program.resultCount} результатов</p></Link><ProgramQuickActions id={program.id} initialStatus={program.status} /></article>)}</div> : <div className="empty-program"><div><div className="empty-program-icon">＋</div><h3>Здесь появится первая программа</h3><p>Создайте её сразу — AI-профиль можно заполнить или подтвердить позже.</p><Link className="empty-link" href="/dashboard/programs/new">Создать программу</Link></div></div>}
          </article>
        </div>

        <aside className="panel">
          <div className="panel-header"><h2>Последние события</h2><span>Обновляется автоматически</span></div>
          <div className="activity-list">{activities.map((activity, index) => <div className="activity" key={`${activity.title}-${index}`}><span className="activity-mark">{activity.mark}</span><div><strong>{activity.title}</strong><p>{activity.text}</p><small>{new Date(activity.date).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</small><Link href={activity.href}>{activity.action} →</Link></div></div>)}</div>
        </aside>
      </section>
    </div>
  );
}

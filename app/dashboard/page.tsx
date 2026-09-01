import type { Metadata } from "next";
import { SafeLink as Link } from "@/app/safe-link";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../chatgpt-auth";
import { getCompanyForUser } from "../../db/company";
import { getConfirmedCompanyProfile } from "../../db/profile";
import { getCompanyOperations, getProgramsForCompany, getSubmissionsForCompany } from "../../db/programs";
import { ProgramQuickActions } from "./_components/program-quick-actions";
import { countRu, formatActivityDate, formatMoneyGroups } from "@/lib/format-display";
import { FirstRunGuide } from "./_components/first-run-guide";

export const metadata: Metadata = { title: "Кабинет компании" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireChatGPTUser("/dashboard");
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");
  const [profile, stats, programs, submissions] = await Promise.all([getConfirmedCompanyProfile(company.id), getCompanyOperations(company.id), getProgramsForCompany(company.id), getSubmissionsForCompany(company.id)]);
  const hasProgram = programs.length > 0;
  const hasPublished = programs.some((program) => program.status === "ACTIVE");
  const showFirstRun = !hasPublished || stats.partners === 0 || stats.submissions === 0 || stats.awaitingReview > 0;
  const progress = hasPublished ? 100 : hasProgram ? 75 : profile ? 50 : 25;
  const nextHref = stats.awaitingReview > 0 ? "/dashboard/crm" : !hasProgram ? "/dashboard/programs/new" : `/dashboard/programs/${programs[0].id}`;
  const nextLabel = stats.awaitingReview > 0 ? `${countRu(stats.awaitingReview, "новая заявка", "новые заявки", "новых заявок")} — посмотреть` : !hasProgram ? "Создать программу" : hasPublished ? "Управлять программой" : "Продолжить настройку";
  const latestProgram = programs[0];
  const latestResult = submissions[0];
  const activities = latestResult ? [
    { mark: "↗", title: "Получена новая заявка", text: `${latestResult.contactName} · ${latestResult.programName}`, date: latestResult.createdAt, href: "/dashboard/crm", action: "Открыть в CRM" },
    { mark: "◇", title: latestProgram?.status === "ACTIVE" ? "Программа опубликована" : "Программа обновлена", text: latestProgram?.name ?? company.name, date: latestProgram?.updatedAt ?? company.createdAt, href: latestProgram ? `/dashboard/programs/${latestProgram.id}` : "/dashboard/programs", action: "Открыть программу" },
    { mark: "○", title: "Агенты подключаются по ссылке", text: `${stats.partners} зарегистрировано`, date: latestResult.createdAt, href: "/dashboard/crm?view=agents", action: "Посмотреть в CRM" },
  ] : latestProgram ? [
    { mark: "◇", title: latestProgram.status === "ACTIVE" ? "Программа опубликована" : "Черновик программы сохранён", text: latestProgram.name, date: latestProgram.updatedAt, href: `/dashboard/programs/${latestProgram.id}`, action: latestProgram.status === "ACTIVE" ? "Скопировать ссылку" : "Продолжить настройку" },
    { mark: profile ? "✓" : "◎", title: profile ? "Профиль компании подтверждён" : "Профиль компании ждёт подтверждения", text: profile ? "Данные готовы для генерации заданий" : "Проверьте данные компании", date: profile?.confirmedAt ?? company.createdAt, href: "/dashboard/company-profile", action: "Открыть профиль" },
    { mark: "○", title: "Следующий шаг", text: latestProgram.status === "ACTIVE" ? "Пригласите первых агентов" : "Опубликуйте внешнюю ссылку", date: latestProgram.updatedAt, href: latestProgram.status === "ACTIVE" ? "/dashboard/crm?view=agents" : `/dashboard/programs/${latestProgram.id}`, action: latestProgram.status === "ACTIVE" ? "Открыть CRM" : "Опубликовать" },
  ] : [
    { mark: "✓", title: "Компания создана", text: `${company.name} добавлена в RiseStaff`, date: company.createdAt, href: "/dashboard/settings", action: "Проверить данные" },
    { mark: profile ? "✓" : "◎", title: profile ? "Профиль компании подтверждён" : "Следующий шаг — профиль компании", text: profile ? "Основа для заданий готова" : "RiseStaff изучит сайт компании", date: profile?.confirmedAt ?? company.createdAt, href: "/dashboard/company-profile", action: "Открыть профиль" },
    { mark: "＋", title: "Создайте первую программу", text: "Соберите задания и условия выплат", date: company.createdAt, href: "/dashboard/programs/new", action: "Создать программу" },
  ];

  return (
    <div className="dashboard-content">
      <div className="dashboard-heading">
        <div><h1>{stats.awaitingReview > 0 ? `${countRu(stats.awaitingReview, "заявка", "заявки", "заявок")} ${stats.awaitingReview === 1 ? "ждёт" : "ждут"} вашего решения` : `Рабочий стол ${company.name}`}</h1><p>{stats.awaitingReview > 0 ? "Откройте заявку и решите: взять клиента в работу или объяснить отказ." : "Здесь видны заявки, агенты, выплаты и следующий полезный шаг."}</p></div>
        <Link className="button button-primary" href={nextHref}>{nextLabel} <span>→</span></Link>
      </div>

      {showFirstRun && <FirstRunGuide hasProfile={Boolean(profile)} hasProgram={hasProgram} hasPublished={hasPublished} partnerCount={stats.partners} submissionCount={stats.submissions} awaitingReview={stats.awaitingReview} programId={programs[0]?.id} />}

      <section className="metrics" aria-label="Основные показатели">
        <Link className="metric metric-link" href="/dashboard/programs"><div className="metric-top"><span>АКТИВНЫЕ ПРОГРАММЫ</span><span className="metric-icon">◇</span></div><strong>{stats.activePrograms}</strong><small>{countRu(stats.programs, "созданная программа", "созданные программы", "созданных программ")} · открыть →</small></Link>
        <Link className="metric metric-link" href="/dashboard/crm?view=agents"><div className="metric-top"><span>КТО ВАС РЕКОМЕНДУЕТ</span><span className="metric-icon">○</span></div><strong>{stats.partners}</strong><small>{countRu(stats.contributedPartners, "уже привёл заявку", "уже привели заявку", "уже привели заявку")} · открыть CRM →</small></Link>
        <Link className="metric metric-link" href="/dashboard/crm"><div className="metric-top"><span>КЛИЕНТЫ В CRM</span><span className="metric-icon">↗</span></div><strong>{stats.submissions}</strong><small>{countRu(stats.awaitingReview, "ждёт решения", "ждут решения", "ждут решения")} · перейти →</small></Link>
        <Link className="metric metric-link" href="/dashboard/rewards"><div className="metric-top"><span>К ВЫПЛАТЕ</span><span className="metric-icon">¤</span></div><strong>{formatMoneyGroups(stats.approvedRewardsByCurrency)}</strong><small>Начислено компанией · открыть →</small></Link>
        <Link className="metric metric-link" href="/dashboard/rewards"><div className="metric-top"><span>АГЕНТЫ ПОДТВЕРДИЛИ</span><span className="metric-icon">✓</span></div><strong>{formatMoneyGroups(stats.paidRewardsByCurrency)}</strong><small>Деньги фактически получены · открыть →</small></Link>
      </section>

      <section className="dashboard-grid">
        <div>
          {!showFirstRun && <article className="setup-card">
            <div className="setup-card-top"><div><h3>Запуск программы</h3><p>{hasPublished ? "Программа опубликована. Теперь приглашайте агентов, проверяйте заявки и отмечайте выплаты." : "RiseStaff ведёт от профиля компании до внешней ссылки с понятными заданиями и наградами."}</p></div><span className="progress-badge">{progress}%</span></div>
            <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
            <div className="setup-steps">
              <Link className="setup-step done" href="/dashboard/settings"><strong>✓ Компания →</strong>Основные данные сохранены</Link>
              <Link className={`setup-step ${!profile ? "next" : "done"}`} href="/dashboard/company-profile"><strong>{profile ? "✓" : "02"} Профиль компании {!profile && "→"}</strong>Продукты, клиенты и преимущества</Link>
              <Link className={`setup-step ${profile && !hasProgram ? "next" : hasProgram ? "done" : ""}`} href={hasProgram ? `/dashboard/programs/${programs[0].id}` : "/dashboard/programs/new"}><strong>{hasProgram ? "✓" : "03"} Задания</strong>Лиды, сделки, имидж</Link>
              <Link className={`setup-step ${hasProgram && !hasPublished ? "next" : hasPublished ? "done" : ""}`} href={hasProgram ? `/dashboard/programs/${programs[0].id}` : "/dashboard/programs"}><strong>{hasPublished ? "✓" : "04"} Публикация</strong>Внешняя ссылка</Link>
            </div>
          </article>}

          <article className="panel" style={{ marginTop: showFirstRun ? 0 : 14 }}>
            <div className="panel-header"><div><h2>Агентские программы</h2><p>Запускайте, приостанавливайте и архивируйте программы прямо здесь.</p></div><Link href="/dashboard/programs/new">＋ Новая программа</Link></div>
            {programs.length ? <div className="dashboard-campaign-mini-grid">{programs.slice(0, 3).map((program) => <article className={`dashboard-program-mini status-card-${program.status.toLowerCase()}`} key={program.id}><div><span className={`program-status status-${program.status.toLowerCase()}`}>● {program.status === "ACTIVE" ? "Опубликована" : program.status === "PAUSED" ? "На паузе" : program.status === "ARCHIVED" ? "В архиве" : "Черновик"}</span><Link href={`/dashboard/programs/${program.id}`} aria-label={`Открыть ${program.name}`}>↗</Link></div><Link className="dashboard-program-mini-main" href={`/dashboard/programs/${program.id}`}><h3>{program.name}</h3><p>{countRu(program.missions.length, "задание", "задания", "заданий")} · {countRu(program.agentCount, "агент", "агента", "агентов")} · {countRu(program.resultCount, "заявка", "заявки", "заявок")}</p></Link><ProgramQuickActions id={program.id} initialStatus={program.status} /></article>)}</div> : <div className="empty-program"><div><div className="empty-program-icon">＋</div><h3>Здесь появится первая программа</h3><p>Создайте её сразу — профиль компании можно заполнить или подтвердить позже.</p><Link className="empty-link" href="/dashboard/programs/new">Создать программу</Link></div></div>}
          </article>
        </div>

        <aside className="panel">
          <div className="panel-header"><h2>Последние события</h2><span>Обновляется автоматически</span></div>
          <div className="activity-list">{activities.map((activity, index) => <div className="activity" key={`${activity.title}-${index}`}><span className="activity-mark">{activity.mark}</span><div><strong>{activity.title}</strong><p>{activity.text}</p><small>{formatActivityDate(activity.date)}</small><Link href={activity.href}>{activity.action} →</Link></div></div>)}</div>
        </aside>
      </section>
    </div>
  );
}

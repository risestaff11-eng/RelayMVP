import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getCompanyForUser } from "../../../db/company";
import { getConfirmedCompanyProfile } from "../../../db/profile";
import { getProgramsForCompany } from "../../../db/programs";

export const metadata: Metadata = { title: "Партнёрские программы" };
export const dynamic = "force-dynamic";

const typeNames: Record<string, string> = { LEAD: "Лиды", DEAL: "Сделки", IMAGE: "Имидж", ENGAGEMENT: "Вовлечение" };
const statusNames: Record<string, string> = { DRAFT: "Черновик", ACTIVE: "Опубликована", PAUSED: "На паузе" };

export default async function ProgramsPage() {
  const user = await requireChatGPTUser("/dashboard/programs");
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");
  const [profile, programList] = await Promise.all([getConfirmedCompanyProfile(company.id), getProgramsForCompany(company.id)]);

  return (
    <div className="dashboard-content module-content programs-page">
      <div className="module-heading">
        <div><span className="module-kicker">ПАРТНЁРСКИЕ ПРОГРАММЫ</span><h1>Программы и миссии</h1><p>Соберите понятное предложение для внешних продавцов, партнёров и амбассадоров — от первого действия до выплаты.</p></div>
        <Link className="button button-primary compact-button" href={profile ? "/dashboard/programs/new" : "/dashboard/company-profile"}>{profile ? "Создать программу" : "Подтвердить профиль"}<span>＋</span></Link>
      </div>

      {!profile && <div className="inline-notice error">Программы создаются только из подтверждённых данных компании. Сначала завершите AI-профиль — так Gemini не будет придумывать продукты и условия.</div>}

      <section className="program-summary-strip">
        <div><small>ВСЕГО</small><strong>{programList.length}</strong></div>
        <div><small>ОПУБЛИКОВАНО</small><strong>{programList.filter((program) => program.status === "ACTIVE").length}</strong></div>
        <div><small>МИССИЙ</small><strong>{programList.reduce((total, program) => total + program.missions.length, 0)}</strong></div>
        <div><small>AI-ПРОФИЛЬ</small><strong>{profile ? `v${profile.versionNumber} подтверждён` : "Не готов"}</strong></div>
      </section>

      {programList.length === 0 ? (
        <section className="panel program-zero-state">
          <div className="program-zero-copy"><span className="module-kicker">ПЕРВЫЙ ЗАПУСК</span><h2>Создайте программу из четырёх типов миссий</h2><p>Выберите лиды, сделки, имидж или вовлечение. Gemini подготовит редактируемые карточки, а вы установите вознаграждение, проверку и сроки выплаты.</p><Link className="button button-primary" href={profile ? "/dashboard/programs/new" : "/dashboard/company-profile"}>{profile ? "Начать создание" : "Подготовить профиль"}<span>→</span></Link></div>
          <div className="mission-type-preview">{Object.entries(typeNames).map(([type, label], index) => <div className={`type-preview type-${type.toLowerCase()}`} key={type}><span>0{index + 1}</span><strong>{label}</strong><small>{type === "LEAD" ? "Квалифицированный контакт" : type === "DEAL" ? "Подтверждённая продажа" : type === "IMAGE" ? "Публикация или кейс" : "Обучение и комьюнити"}</small></div>)}</div>
        </section>
      ) : (
        <section className="program-list-grid">{programList.map((program) => <article className="panel program-list-card" key={program.id}><div className="program-card-top"><span className={`program-status status-${program.status.toLowerCase()}`}>● {statusNames[program.status] ?? program.status}</span><span className="program-date">{new Date(program.updatedAt).toLocaleDateString("ru-RU")}</span></div><h2>{program.name}</h2><p>{program.description || "Описание появится после AI-генерации."}</p><div className="program-mission-tags">{program.missions.map((mission) => <span className={`type-${mission.type.toLowerCase()}`} key={mission.id}>{typeNames[mission.type] ?? mission.type}</span>)}</div><div className="program-card-footer"><small>{program.missions.length} миссий · {program.currency}</small><Link href={`/dashboard/programs/${program.id}`}>{program.status === "ACTIVE" ? "Управлять" : "Продолжить настройку"} →</Link></div></article>)}</section>
      )}
    </div>
  );
}

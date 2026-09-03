import type { Metadata } from "next";
import { SafeLink as Link } from "@/app/safe-link";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getCompanyForUser } from "../../../db/company";
import { getConfirmedCompanyProfile, getLatestCompanyProfile } from "../../../db/profile";
import { getProgramsForCompany } from "../../../db/programs";
import { ProgramQuickActions } from "../_components/program-quick-actions";
import { countRu, formatDate } from "@/lib/format-display";

export const metadata: Metadata = { title: "Агентские программы" };
export const dynamic = "force-dynamic";

const typeNames: Record<string, string> = { LEAD: "Лиды", DEAL: "Сделки", IMAGE: "Имидж", ENGAGEMENT: "Вовлечение" };
const statusNames: Record<string, string> = { DRAFT: "Черновик", ACTIVE: "Опубликована", PAUSED: "На паузе", ARCHIVED: "В архиве" };

export default async function ProgramsPage() {
  const user = await requireChatGPTUser("/dashboard/programs");
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");
  const [confirmedProfile, latestProfile, programList] = await Promise.all([getConfirmedCompanyProfile(company.id), getLatestCompanyProfile(company.id), getProgramsForCompany(company.id)]);
  const profile = confirmedProfile ?? latestProfile;
  const activePrograms = programList.filter((program) => ["ACTIVE", "PAUSED"].includes(program.status));
  const archivedPrograms = programList.filter((program) => program.status === "ARCHIVED");

  return (
    <div className="dashboard-content module-content programs-page">
      <div className="module-heading">
        <div><span className="module-kicker">АГЕНТСКИЕ ПРОГРАММЫ</span><h1>Программы и задания</h1><p>Соберите понятное предложение для внешних продавцов, агентов и амбассадоров — от первого действия до выплаты.</p></div>
        <div className="program-page-actions"><Link className="button button-ghost compact-button" href="/dashboard/programs/archive">Архив программ{archivedPrograms.length ? ` · ${archivedPrograms.length}` : ""}</Link><Link className="button button-primary compact-button" href="/dashboard/programs/new">Создать программу<span>＋</span></Link></div>
      </div>

      {!confirmedProfile && <div className="inline-notice">Создание доступно без ограничений. RiseStaff использует {profile ? "последний черновик профиля" : "данные регистрации"}; подтвердить профиль можно позже для более точных заданий.</div>}

      <section className="program-summary-strip">
        <div><small>АКТУАЛЬНЫХ</small><strong>{activePrograms.length}</strong></div>
        <div><small>ОПУБЛИКОВАНО</small><strong>{activePrograms.filter((program) => program.status === "ACTIVE").length}</strong></div>
        <div><small>НА ПАУЗЕ</small><strong>{activePrograms.filter((program) => program.status === "PAUSED").length}</strong></div>
        <div><small>ЗАДАНИЙ</small><strong>{activePrograms.reduce((total, program) => total + program.missions.length, 0)}</strong></div>
      </section>

      {activePrograms.length === 0 ? (
        <section className="panel program-zero-state">
          <div className="program-zero-copy"><span className="module-kicker">ПЕРВЫЙ ЗАПУСК</span><h2>Создайте программу из четырёх типов заданий</h2><p>Выберите лиды, сделки, имидж или вовлечение. RiseStaff подготовит редактируемые задания, а вы установите вознаграждение, проверку и сроки выплаты.</p><Link className="button button-primary" href="/dashboard/programs/new">Начать создание<span>→</span></Link></div>
          <div className="mission-type-preview">{Object.entries(typeNames).map(([type, label], index) => <div className={`type-preview type-${type.toLowerCase()}`} key={type}><span>0{index + 1}</span><strong>{label}</strong><small>{type === "LEAD" ? "Квалифицированный контакт" : type === "DEAL" ? "Подтверждённая продажа" : type === "IMAGE" ? "Публикация или кейс" : "Обучение и комьюнити"}</small></div>)}</div>
        </section>
      ) : (
        <section className="program-list-grid compact-campaign-grid">{activePrograms.map((program) => <article className={`panel program-list-card status-card-${program.status.toLowerCase()}`} key={program.id}><div className="program-card-top"><span className={`program-status status-${program.status.toLowerCase()}`}>● {statusNames[program.status] ?? program.status}</span><span className="program-date">Создана {formatDate(program.createdAt)}</span></div><h2>{<bdi data-no-translate>{program.name}</bdi>}</h2><p>{(program.description) ? (<bdi data-no-translate>{program.description}</bdi>) : ("Описание появится после генерации RiseStaff.")}</p><div className="campaign-thesis-row"><span><b>{program.missions.length}</b> {countRu(program.missions.length, "задание", "задания", "заданий").replace(/^\d+\s/, "")}</span><span><b>{program.agentCount}</b> {countRu(program.agentCount, "агент", "агента", "агентов").replace(/^\d+\s/, "")}</span><span><b>{program.resultCount}</b> {countRu(program.resultCount, "заявка", "заявки", "заявок").replace(/^\d+\s/, "")}</span></div><div className="program-card-footer"><small>{program.status === "ACTIVE" ? "Ссылка доступна агентам" : "Новые агенты временно не принимаются"}</small><Link href={`/dashboard/programs/${program.id}`}>{program.status === "ACTIVE" ? "Управлять" : "Редактировать"} →</Link></div><ProgramQuickActions id={program.id} initialStatus={program.status} /></article>)}</section>
      )}
    </div>
  );
}

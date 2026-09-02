import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SafeLink as Link } from "@/app/safe-link";
import { requireChatGPTUser } from "../../../chatgpt-auth";
import { getCompanyForUser } from "../../../../db/company";
import { getProgramsForCompany } from "../../../../db/programs";
import { ProgramQuickActions } from "../../_components/program-quick-actions";
import { countRu, formatDate } from "@/lib/format-display";

export const metadata: Metadata = { title: "Архив программ" };
export const dynamic = "force-dynamic";

export default async function ProgramsArchivePage() {
  const user = await requireChatGPTUser("/dashboard/programs/archive");
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");
  const archive = (await getProgramsForCompany(company.id)).filter((program) => program.status === "ARCHIVED");

  return <div className="dashboard-content module-content programs-page programs-archive-page"><div className="module-heading"><div><span className="module-kicker">АРХИВ ПРОГРАММ</span><h1>Архив программ</h1><p>Здесь хранятся завершённые программы. Они скрыты от агентов и не мешают рабочему списку.</p></div><div className="program-page-actions"><Link className="button button-ghost compact-button" href="/dashboard/programs">← К программам</Link><Link className="button button-primary compact-button" href="/dashboard/programs/new">Создать программу<span>＋</span></Link></div></div>{archive.length ? <><div className="inline-notice">Верните программу на паузу, чтобы она снова появилась в основном списке. Агентская ссылка останется закрытой, пока вы не запустите программу вручную.</div><section className="program-list-grid compact-campaign-grid">{archive.map((program) => <article className="panel program-list-card status-card-archived" key={program.id}><div className="program-card-top"><span className="program-status status-archived">● В архиве</span><span className="program-date">Создана {formatDate(program.createdAt)}</span></div><h2>{program.name}</h2><p>{program.description || "Описание не добавлено."}</p><div className="campaign-thesis-row"><span><b>{program.missions.length}</b> {countRu(program.missions.length, "задание", "задания", "заданий").replace(/^\d+\s/, "")}</span><span><b>{program.agentCount}</b> {countRu(program.agentCount, "агент", "агента", "агентов").replace(/^\d+\s/, "")}</span><span><b>{program.resultCount}</b> {countRu(program.resultCount, "заявка", "заявки", "заявок").replace(/^\d+\s/, "")}</span></div><div className="program-card-footer"><small>Скрыта от агентов и исключена из рабочего списка</small><Link href={`/dashboard/programs/${program.id}`}>Открыть →</Link></div><ProgramQuickActions id={program.id} initialStatus={program.status} /></article>)}</section></> : <section className="panel program-zero-state"><div className="program-zero-copy"><span className="module-kicker">АРХИВ ПУСТ</span><h2>Здесь пока нет программ</h2><p>Архивируйте завершённую программу, когда она больше не нужна в рабочем списке. Её всегда можно вернуть на паузу.</p><Link className="button button-primary" href="/dashboard/programs">Вернуться к программам<span>→</span></Link></div></section>}</div>;
}

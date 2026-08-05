import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getCompanyForUser } from "../../../db/company";
import { getCompanyOperations, getProgramsForCompany } from "../../../db/programs";
import { CopyProgramLink, PartnerTableTools } from "../_components/table-actions";

export const metadata: Metadata = { title: "Партнёры" };
export const dynamic = "force-dynamic";

export default async function PartnersPage() {
  const user = await requireChatGPTUser("/dashboard/partners");
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");
  const [stats, programs] = await Promise.all([getCompanyOperations(company.id), getProgramsForCompany(company.id)]);
  const activeProgram = programs.find((program) => program.status === "ACTIVE");
  return <div className="dashboard-content module-content operations-page"><div className="module-heading"><div><span className="module-kicker">ПАРТНЁРСКАЯ СЕТЬ</span><h1>Партнёры и амбассадоры</h1><p>Люди, которые открыли программу, приняли условия и помогают компании получать измеримый результат.</p></div>{activeProgram ? <div className="partner-invite-actions"><Link className="button button-ghost compact-button" href={`/p/${activeProgram.slug}`} target="_blank">Открыть страницу <span>↗</span></Link><CopyProgramLink href={`/p/${activeProgram.slug}`} /></div> : <Link className="button button-primary compact-button" href="/dashboard/programs">Опубликовать программу <span>→</span></Link>}</div><section className="operations-metrics"><article><small>ВСЕГО ПАРТНЁРОВ</small><strong>{stats.partners}</strong><span>Во всех программах</span></article><article><small>АКТИВНЫЕ</small><strong>{stats.activePartners}</strong><span>Действовали недавно</span></article><article><small>ПЕРЕДАЛИ РЕЗУЛЬТАТ</small><strong>0</strong><span>Партнёры с вкладом</span></article><article><small>СРЕДНИЙ РЕЗУЛЬТАТ</small><strong>—</strong><span>Недостаточно данных</span></article></section><section className="panel workflow-panel"><div className="panel-header"><div><h2>Участники программ</h2><p>Поиск, статус, программа и вклад каждого партнёра.</p></div><PartnerTableTools /></div><div className="empty-table-head"><span>ПАРТНЁР</span><span>ПРОГРАММА</span><span>РЕЗУЛЬТАТЫ</span><span>ЗАРАБОТАНО</span><span>СТАТУС</span></div><div className="operations-empty compact"><div className="operations-empty-icon">○</div><h3>Сеть начнёт расти после публикации</h3><p>Распространите внешнюю ссылку среди клиентов, консультантов, отраслевых экспертов и знакомых продавцов.</p></div></section><section className="partner-source-grid"><article><span>01</span><strong>Клиенты и выпускники</strong><p>Уже знают продукт и могут дать тёпую рекомендацию.</p></article><article><span>02</span><strong>Консультанты отрасли</strong><p>Видят проблему клиента раньше, чем начинается поиск поставщика.</p></article><article><span>03</span><strong>Независимые продавцы</strong><p>Получают прозрачные миссии вместо устных договорённостей.</p></article><article><span>04</span><strong>Амбассадоры</strong><p>Усиливают доверие через кейсы, публикации и события.</p></article></section></div>;
}

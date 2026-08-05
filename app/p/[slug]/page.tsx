import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { SafeLink as Link } from "@/app/safe-link";
import { notFound } from "next/navigation";
import { getDb } from "../../../db";
import { getPublicProgramBySlug } from "../../../db/programs";
import { companies } from "../../../db/schema";

export const dynamic = "force-dynamic";

const typeNames: Record<string, string> = { LEAD: "Лид", DEAL: "Сделка", IMAGE: "Имидж", ENGAGEMENT: "Вовлечение" };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const program = await getPublicProgramBySlug(slug);
  return { title: program?.name ?? "Партнёрская программа", description: program?.description ?? "Партнёрская программа в Relay" };
}

export default async function PublicProgramPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const program = await getPublicProgramBySlug(slug);
  if (!program) notFound();
  const rows = await getDb().select({ name: companies.name, website: companies.website }).from(companies).where(eq(companies.id, program.companyId)).limit(1);
  const company = rows[0];
  if (!company) notFound();

  return (
    <main className="partner-program-page">
      <header className="partner-program-nav"><Link className="brand" href="/"><span className="brand-mark">R</span><span>Relay</span></Link><div className="partner-program-nav-actions"><span>Партнёрская программа · {company.name}</span><Link href="/dashboard">Кабинет компании →</Link></div></header>
      <section className="partner-program-hero"><span className="live-pill">● ПРОГРАММА АКТИВНА</span><h1>{program.name}</h1><p>{program.description}</p><div className="partner-program-facts"><div><small>КОМПАНИЯ</small><strong>{company.name}</strong></div><div><small>МИССИЙ</small><strong>{program.missions.length}</strong></div><div><small>ВАЛЮТА</small><strong>{program.currency}</strong></div><div><small>СРОК</small><strong>{program.expiresAt ? new Date(program.expiresAt).toLocaleDateString("ru-RU") : "Без ограничения"}</strong></div></div><a className="button button-primary" href="#missions">Посмотреть миссии <span>↓</span></a></section>
      <section className="partner-missions-section" id="missions"><div className="partner-section-heading"><span className="module-kicker">ВЫБЕРИТЕ РЕЗУЛЬТАТ</span><h2>Доступные миссии</h2><p>Перед началом внимательно прочитайте шаги, доказательства результата и правила проверки.</p></div><div className="partner-mission-grid">{program.missions.map((mission, index) => <article className={`partner-mission-card type-${mission.type.toLowerCase()}`} key={mission.id}><div className="partner-mission-number">0{index + 1} · {typeNames[mission.type]}</div><h3>{mission.title}</h3><p>{mission.description}</p><div className="partner-reward"><small>ВОЗНАГРАЖДЕНИЕ</small><strong>{mission.rewardLabel}</strong></div><div className="partner-mission-block"><strong>Что сделать</strong><ol>{mission.instructions.map((item) => <li key={item}>{item}</li>)}</ol></div><div className="partner-mission-block"><strong>Что приложить</strong><ul>{mission.proofRequirements.map((item) => <li key={item}>{item}</li>)}</ul></div><div className="partner-verification"><strong>Как проверяется</strong><p>{mission.verificationRules}</p></div>{mission.type === "LEAD" ? <Link className="partner-mission-cta" href={`/p/${program.slug}/missions/${mission.id}/submit`}>Передать лид <span>→</span></Link> : <Link className="partner-mission-cta" href={`/p/${program.slug}/missions/${mission.id}/submit`}>Передать результат <span>→</span></Link>}</article>)}</div></section>
      <section className="partner-terms"><div><span className="module-kicker">ПРОЗРАЧНЫЕ УСЛОВИЯ</span><h2>До начала миссии</h2></div><div><article><strong>Сроки выплаты</strong><p>{program.payoutTerms}</p></article><article><strong>Ограничения</strong><p>{program.legalTerms}</p></article></div><p className="partner-beta-note">После отправки Relay зафиксирует владельца и дату рекомендации и выдаст защищённую ссылку для отслеживания статуса.</p></section>
      <footer className="partner-program-footer"><span>Работает на Relay</span><a href={company.website} target="_blank" rel="noreferrer">Сайт компании ↗</a></footer>
    </main>
  );
}

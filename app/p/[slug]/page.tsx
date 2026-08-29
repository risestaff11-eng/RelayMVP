import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { SafeLink as Link } from "@/app/safe-link";
import { getDb } from "../../../db";
import { getPartnerPortal } from "../../../db/partner";
import { getPublicProgramBySlug } from "../../../db/programs";
import { companies } from "../../../db/schema";
import { PartnerEntry } from "./partner-entry";
import { PublicMissionAction } from "./public-mission-action";

export const dynamic = "force-dynamic";
const typeNames: Record<string, string> = { LEAD: "Люди", DEAL: "Сделки", IMAGE: "Имидж", ENGAGEMENT: "Вовлечение" };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const program = await getPublicProgramBySlug(slug);
  return { title: program?.name ?? "Агентская программа", description: program?.description ?? "Агентская программа в Relay", referrer: "no-referrer" };
}

export default async function PublicProgramPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ access?: string }> }) {
  const { slug } = await params;
  const { access = "" } = await searchParams;
  const program = await getPublicProgramBySlug(slug);
  if (!program) notFound();
  const rows = await getDb().select({ id: companies.id, name: companies.name, website: companies.website, logoObjectKey: companies.logoObjectKey }).from(companies).where(eq(companies.id, program.companyId)).limit(1);
  const company = rows[0];
  if (!company) notFound();
  const portal = access ? await getPartnerPortal(access) : null;
  const authorized = portal?.programs.some((item) => item.id === program.id) ? portal : null;
  if (!authorized) return <PartnerEntry programSlug={slug} companyId={company.id} companyName={company.name} logoObjectKey={company.logoObjectKey} programName={program.name} reward={program.missions[0]?.rewardLabel || "По условиям задания"} />;

  return (
    <main className="partner-program-page">
      <header className="partner-program-nav">
        <Link className="brand" href={`/p/${slug}?access=${access}`}>
          <span className="brand-mark">R</span>
          <span>Relay</span>
        </Link>
        <div className="partner-program-nav-actions">
          <span>{company.name}</span>
          <Link href={`/partner/${access}`}>Кабинет агента →</Link>
        </div>
      </header>

      <section className="partner-missions-section" id="missions">
        <div className="partner-section-heading">
          <span className="module-kicker">{company.name} · ДОСТУПНЫЕ ЗАДАНИЯ</span>
          <h1>Выберите задание и передайте результат</h1>
          <p>Сразу видны действия, подтверждение и вознаграждение. Остальная информация о программе находится ниже.</p>
        </div>
        <div className="partner-mission-grid">
          {program.missions.map((mission, index) => (
            <article className={`partner-mission-card type-${mission.type.toLowerCase()}`} key={mission.id}>
              <div className="partner-mission-number">{String(index + 1).padStart(2, "0")} · {typeNames[mission.type]}</div>
              <h2>{mission.title}</h2>
              <div className="partner-reward">
                <small>МОЖНО ЗАРАБОТАТЬ</small>
                <strong>{mission.rewardLabel}</strong>
              </div>
              <p>{mission.description}</p>
              <div className="partner-mission-block">
                <strong>Что сделать</strong>
                <ol>{mission.instructions.map((item) => <li key={item}>{item}</li>)}</ol>
              </div>
              <div className="partner-mission-block">
                <strong>Что приложить</strong>
                <ul>{mission.proofRequirements.map((item) => <li key={item}>{item}</li>)}</ul>
                {mission.resources.length > 0 && (
                  <div className="mission-agent-files">
                    <strong>Файлы компании</strong>
                    {mission.resources.map((resource) => (
                      <a href={`/api/partner/mission-files/${resource.id}?token=${access}`} key={resource.id}>
                        ↓ {resource.fileName}<small>{Math.max(1, Math.round(resource.size / 1024))} КБ</small>
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <div className="partner-verification">
                <strong>Как проверяется</strong>
                <p>{mission.verificationRules}</p>
              </div>
              <PublicMissionAction
                token={access}
                missionId={mission.id}
                accepted={authorized.acceptances.some((item) => item.missionId === mission.id && item.status === "ACTIVE")}
              />
            </article>
          ))}
        </div>
      </section>

      <section className="partner-program-details" aria-label="Информация о программе">
        <details>
          <summary>
            <span><small>О ПРОГРАММЕ</small><strong>{program.name}</strong></span>
            <span aria-hidden="true">＋</span>
          </summary>
          <div className="partner-program-details-body">
            <p>{program.description}</p>
            <div className="partner-program-facts">
              <div><small>КОМПАНИЯ</small><strong>{company.name}</strong></div>
              <div><small>ЗАДАНИЙ</small><strong>{program.missions.length}</strong></div>
              <div><small>ВАЛЮТА</small><strong>{program.currency}</strong></div>
              <div><small>СРОК</small><strong>{program.expiresAt ? new Date(program.expiresAt).toLocaleDateString("ru-RU") : "Без ограничения"}</strong></div>
            </div>
          </div>
        </details>
        <details>
          <summary>
            <span><small>УСЛОВИЯ</small><strong>Выплата и ограничения</strong></span>
            <span aria-hidden="true">＋</span>
          </summary>
          <div className="partner-program-details-body partner-terms-grid">
            <article><strong>Сроки выплаты</strong><p>{program.payoutTerms}</p></article>
            <article><strong>Ограничения</strong><p>{program.legalTerms}</p></article>
            <p className="partner-beta-note">Relay фиксирует владельца рекомендации, дату отправки и всю историю статусов.</p>
          </div>
        </details>
      </section>

      <footer className="partner-program-footer">
        <span>Работает на Relay</span>
        <a href={company.website} target="_blank" rel="noreferrer" referrerPolicy="no-referrer">Сайт компании ↗</a>
      </footer>
    </main>
  );
}

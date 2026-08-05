import { notFound } from "next/navigation";
import { getPartnerPortal } from "../../../../db/partner";
import { SafeLink as Link } from "@/app/safe-link";
import { typeNames } from "../../_lib";

export default async function MyMissionsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const portal = await getPartnerPortal(token);
  if (!portal) notFound();
  const accepted = portal.acceptances.map((item) => ({ acceptance: item, mission: portal.missions.find((mission) => mission.id === item.missionId) })).filter((item) => item.mission);
  const deadline = portal.program.expiresAt ? new Date(portal.program.expiresAt).toLocaleDateString("ru-RU") : "Без дедлайна";
  return <div className="partner-portal-content"><div className="partner-page-heading"><div><span>АКТИВНЫЙ ПЛАН</span><h1>Мои миссии</h1><p>Что уже взято, какое следующее действие и где скоро закончится срок.</p></div><Link className="button button-primary" href={`/partner/${token}/opportunities`}>Найти миссию <span>＋</span></Link></div>{accepted.length ? <section className="my-missions-list">{accepted.map(({ acceptance, mission }) => mission && <article key={acceptance.id}><span className={`mission-line-type type-${mission.type.toLowerCase()}`}>{typeNames[mission.type]}</span><div><h2>{mission.title}</h2><p>{mission.instructions[0] || mission.description}</p><small>Взята {new Date(acceptance.acceptedAt).toLocaleDateString("ru-RU")} · дедлайн {deadline}</small></div><div><strong>{mission.rewardLabel}</strong><Link href={`/p/${portal.program.slug}/missions/${mission.id}/submit?access=${token}`}>Передать результат →</Link></div></article>)}</section> : <section className="partner-large-empty"><span>◎</span><h2>Вы ещё не взяли миссию</h2><p>Выберите одну понятную возможность. Она появится здесь вместе со следующим действием.</p><Link className="button button-primary" href={`/partner/${token}/opportunities`}>Открыть возможности <span>→</span></Link></section>}</div>;
}

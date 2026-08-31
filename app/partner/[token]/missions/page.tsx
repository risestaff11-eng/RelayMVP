import { notFound } from "next/navigation";
import { getPartnerPortal } from "../../../../db/partner";
import { SafeLink as Link } from "@/app/safe-link";
import { typeNames } from "../../_lib";

export default async function MyMissionsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const portal = await getPartnerPortal(token);
  if (!portal) notFound();
  const accepted = portal.acceptances.map((item) => ({ acceptance: item, mission: portal.missions.find((mission) => mission.id === item.missionId) })).filter((item) => item.mission);
  return <div className="partner-portal-content"><div className="partner-page-heading"><div><span>ПРИНЯТЫЕ ЗАДАНИЯ</span><h1>В работе</h1><p>Здесь только задания, которые вы уже выбрали. Доступные варианты находятся в соседнем разделе.</p></div><Link className="button button-primary" href={`/partner/${token}/opportunities`}>Открыть доступные задания <span>＋</span></Link></div>{accepted.length ? <section className="my-missions-list">{accepted.map(({ acceptance, mission }) => mission && <article key={acceptance.id}><span className={`mission-line-type type-${mission.type.toLowerCase()}`}>{typeNames[mission.type]}</span><div><small>{mission.programName}</small><h2>{mission.title}</h2><p>{mission.instructions[0] || mission.description}</p><small>Взято {new Date(acceptance.acceptedAt).toLocaleDateString("ru-RU")} · дедлайн {mission.programExpiresAt ? new Date(mission.programExpiresAt).toLocaleDateString("ru-RU") : "без ограничения"}</small></div><div><strong>{mission.rewardLabel}</strong><Link href={`/partner/${token}/submit/${mission.id}`}>Передать результат →</Link></div></article>)}</section> : <section className="partner-large-empty"><span>◎</span><h2>Заданий в работе пока нет</h2><p>Выберите одно доступное задание. После принятия оно появится здесь вместе со следующим действием.</p><Link className="button button-primary" href={`/partner/${token}/opportunities`}>Открыть доступные задания <span>→</span></Link></section>}</div>;
}

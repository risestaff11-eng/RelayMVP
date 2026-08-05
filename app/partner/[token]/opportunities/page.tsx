import { notFound } from "next/navigation";
import { getPartnerPortal } from "../../../../db/partner";
import { AcceptMissionButton, OpportunityFilters } from "../../_components/partner-actions";
import { typeNames } from "../../_lib";

export default async function OpportunitiesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const portal = await getPartnerPortal(token);
  if (!portal) notFound();
  const deadline = portal.program.expiresAt ? new Date(portal.program.expiresAt).toLocaleDateString("ru-RU") : "Без дедлайна";
  return <div className="partner-portal-content"><div className="partner-page-heading"><div><span>ЛЕНТА ВОЗМОЖНОСТЕЙ</span><h1>Миссии, где ваш контакт ценен</h1><p>Сначала возьмите миссию — после этого откроется передача результата.</p></div></div><OpportunityFilters companies={[portal.company.name]} currencies={[portal.program.currency]} /><section className="opportunity-grid">{portal.missions.map((mission) => { const accepted = portal.acceptances.some((item) => item.missionId === mission.id && item.status === "ACTIVE"); return <article className={`opportunity-card type-${mission.type.toLowerCase()}`} key={mission.id}><div><span>{typeNames[mission.type]}</span><small>● ДОСТУПНА</small></div><h2>{mission.title}</h2><p>{mission.description}</p><dl><div><dt>Награда</dt><dd>{mission.rewardLabel}</dd></div><div><dt>Дедлайн</dt><dd>{deadline}</dd></div><div><dt>Проверка</dt><dd>{mission.verificationRules}</dd></div></dl><div className="opportunity-card-actions"><AcceptMissionButton token={token} missionId={mission.id} accepted={accepted} resultHref={`/p/${portal.program.slug}/missions/${mission.id}/submit?access=${token}`} /></div></article>; })}</section></div>;
}

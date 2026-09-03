import { notFound } from "next/navigation";
import { getPartnerPortal } from "../../../../db/partner";
import { OpportunityBrowser } from "../../_components/partner-actions";

export default async function OpportunitiesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const portal = await getPartnerPortal(token);
  if (!portal) notFound();
  return <div className="partner-portal-content"><div className="partner-page-heading"><div><span>ЗАРАБОТОК НА РЕКОМЕНДАЦИЯХ</span><h1>Выберите, кому вы можете помочь</h1><p>Здесь собраны задания из всех программ {<bdi data-no-translate>{portal.company.name}</bdi>}, к которым у вас есть доступ.</p></div></div><OpportunityBrowser missions={portal.missions} acceptedMissionIds={portal.acceptances.filter((item) => item.status === "ACTIVE").map((item) => item.missionId)} token={token} /></div>;
}

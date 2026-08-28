import { notFound } from "next/navigation";
import { getPartnerPortal } from "../../../../db/partner";
import { ReferralLinkBuilder } from "../../_components/referral-link-builder";

export const dynamic = "force-dynamic";

export default async function ReferralPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const portal = await getPartnerPortal(token);
  if (!portal) notFound();
  const accepted = new Set(portal.acceptances.filter((item) => item.status === "ACTIVE").map((item) => item.missionId));
  const missions = portal.missions.filter((mission) => mission.status === "ACTIVE" && accepted.has(mission.id) && ["LEAD", "DEAL"].includes(mission.type)).map(({ id, title, programName, rewardLabel, type }) => ({ id, title, programName, rewardLabel, type }));
  return <div className="partner-portal-content"><div className="partner-page-heading"><div><span>БЫСТРАЯ РЕКОМЕНДАЦИЯ</span><h1>Ссылка для клиента</h1><p>Отправьте ссылку клиенту. Он сам укажет имя, контакт и комментарий, а результат появится у компании от вашего имени.</p></div></div><ReferralLinkBuilder token={token} missions={missions} /></div>;
}

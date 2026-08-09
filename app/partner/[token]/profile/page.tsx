import { notFound } from "next/navigation";
import { getPartnerPortal } from "../../../../db/partner";
import { PartnerProfileForm } from "../../_components/partner-actions";
import { PartnerExitButton, ProfileEarningsSummary } from "../../_components/profile-earnings-summary";

export default async function PartnerProfilePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const portal = await getPartnerPortal(token);
  if (!portal) notFound();
  const activeMissions = portal.missions.filter((mission) => mission.status === "ACTIVE");
  const bestReward = [...activeMissions].sort((left, right) => right.rewardValue - left.rewardValue)[0]?.rewardLabel || "";
  const rewardItems = portal.rewards.map((reward) => ({ amount: reward.amount, status: reward.status, partnerConfirmedAt: reward.partnerConfirmedAt, createdAt: reward.createdAt, type: portal.submissions.find((submission) => submission.id === reward.submissionId)?.mission?.type || "" }));
  return <div className="partner-portal-content"><div className="partner-page-heading"><div><span>ВАШ АККАУНТ</span><h1>Профиль агента</h1><p>Для работы достаточно имени и WhatsApp. Остальные данные помогают получать более подходящие задания и поддерживать связь.</p></div><PartnerExitButton /></div><ProfileEarningsSummary rewards={rewardItems} currency={portal.program.currency} missionCount={activeMissions.length} bestReward={bestReward} calculatedAt={new Date(portal.partner.lastActiveAt || portal.partner.joinedAt).getTime()} /><PartnerProfileForm token={token} partner={{ email: portal.partner.email, phone: portal.partner.phone }} profile={portal.profile} /></div>;
}

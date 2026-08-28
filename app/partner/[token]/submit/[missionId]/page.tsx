import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPartnerPortal } from "../../../../../db/partner";
import { parseSubmissionFormFields } from "../../../../../lib/submission-form";
import { SafeLink as Link } from "@/app/safe-link";
import { LeadSubmissionForm } from "../../../../p/[slug]/missions/[missionId]/submit/lead-submission-form";

export const metadata: Metadata = { title: "Передать результат" };
export const dynamic = "force-dynamic";

export default async function PartnerSubmitPage({ params }: { params: Promise<{ token: string; missionId: string }> }) {
  const { token, missionId } = await params;
  const portal = await getPartnerPortal(token);
  if (!portal) notFound();
  const mission = portal.missions.find((item) => item.id === missionId && item.status === "ACTIVE");
  if (!mission) notFound();
  if (!portal.acceptances.some((item) => item.missionId === missionId && item.status === "ACTIVE")) redirect(`/partner/${token}/opportunities`);
  const program = portal.programs.find((item) => item.id === mission.programId);
  if (!program) notFound();

  return <div className="partner-portal-content agent-submit-workspace">
    <div className="agent-submit-heading">
      <div><span>ПЕРЕДАЧА РЕЗУЛЬТАТА</span><h1>{mission.title}</h1><p>{portal.company.name} · {mission.rewardLabel}</p></div>
      <Link href={`/partner/${token}/missions`}>← Мои задания</Link>
    </div>
    <section className="agent-submit-context">
      <div><small>ЗАДАНИЕ</small><strong>{mission.description}</strong></div>
      <div><small>КОГДА ЗАСЧИТАЮТ</small><strong>{mission.verificationRules}</strong></div>
      <div><small>ВОЗНАГРАЖДЕНИЕ</small><strong>{mission.rewardLabel}</strong></div>
    </section>
    <LeadSubmissionForm programSlug={mission.programSlug} missionId={missionId} missionType={mission.type} token={token} formFields={parseSubmissionFormFields(program.submissionFormJson)} />
  </div>;
}

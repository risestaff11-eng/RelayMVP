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
    <header className="agent-submit-compact-bar">
      <Link href={`/partner/${token}/missions`} aria-label="Вернуться к заданиям">←</Link>
      <div><small>{portal.company.name}</small><strong>{mission.title}</strong></div>
      <span><small>ВОЗНАГРАЖДЕНИЕ</small><b>{mission.rewardLabel}</b></span>
    </header>
    <LeadSubmissionForm programSlug={mission.programSlug} missionId={missionId} missionType={mission.type} token={token} formFields={parseSubmissionFormFields(program.submissionFormJson)} />
    <details className="agent-submit-details">
      <summary><span>Описание и правила задания</span><b>Раскрыть ↓</b></summary>
      <div><section><small>ЧТО НУЖНО СДЕЛАТЬ</small><p>{mission.description}</p></section><section><small>КОГДА ЗАСЧИТАЮТ</small><p>{mission.verificationRules}</p></section><section><small>ВОЗНАГРАЖДЕНИЕ</small><p>{mission.rewardLabel}</p></section></div>
    </details>
  </div>;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMissionForPublicSubmission } from "../../../../../../db/partner";
import { SafeLink as Link } from "@/app/safe-link";
import { LeadSubmissionForm } from "./lead-submission-form";

export const metadata: Metadata = { title: "Передать рекомендацию" };
export const dynamic = "force-dynamic";

export default async function SubmitLeadPage({ params }: { params: Promise<{ slug: string; missionId: string }> }) {
  const { slug, missionId } = await params;
  const target = await getMissionForPublicSubmission(slug, missionId);
  if (!target) notFound();
  return <main className="partner-submit-page"><header><Link className="brand" href={`/p/${slug}`}><span className="brand-mark">R</span><span>Relay</span></Link><Link href={`/p/${slug}`}>← Вернуться к миссиям</Link></header><div className="partner-submit-layout"><aside><span className="module-kicker">ПЕРЕДАЧА ЛИДА</span><h1>{target.mission.title}</h1><p>{target.mission.description}</p><div className="submit-mission-facts"><div><small>КОМПАНИЯ</small><strong>{target.company.name}</strong></div><div><small>ВОЗНАГРАЖДЕНИЕ</small><strong>{target.mission.rewardLabel}</strong></div><div><small>УСЛОВИЕ</small><strong>{target.mission.verificationRules}</strong></div><div><small>ВЫПЛАТА</small><strong>{target.program.payoutTerms || "После подтверждения результата"}</strong></div></div></aside><LeadSubmissionForm programSlug={slug} missionId={missionId} /></div></main>;
}

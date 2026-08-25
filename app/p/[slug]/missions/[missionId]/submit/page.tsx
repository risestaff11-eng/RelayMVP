import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getMissionForPublicSubmission, getPartnerPortal } from "../../../../../../db/partner";
import { SafeLink as Link } from "@/app/safe-link";
import { LeadSubmissionForm } from "./lead-submission-form";
import { MarketingLogo } from "@/app/marketing-logo";

export const metadata: Metadata = { title: "Передать рекомендацию", referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default async function SubmitLeadPage({ params, searchParams }: { params: Promise<{ slug: string; missionId: string }>; searchParams: Promise<{ access?: string }> }) {
  const { slug, missionId } = await params;
  const { access = "" } = await searchParams;
  const [target, portal] = await Promise.all([getMissionForPublicSubmission(slug, missionId), access ? getPartnerPortal(access) : null]);
  if (!target) notFound();
  if (!portal || portal.program.id !== target.program.id || !portal.acceptances.some((item) => item.missionId === missionId && item.status === "ACTIVE")) redirect(`/p/${slug}`);
  return (
    <main className="partner-submit-page">
      <header>
        <Link className="brand" href={`/p/${slug}?access=${access}`}><MarketingLogo /><span>Relay</span></Link>
        <Link href={`/p/${slug}?access=${access}`}>← Вернуться к заданиям</Link>
      </header>
      <div className="partner-submit-layout">
        <aside>
          <span className="module-kicker">{["LEAD", "DEAL"].includes(target.mission.type) ? "ПЕРЕДАЧА КОНТАКТА" : "ПЕРЕДАЧА РЕЗУЛЬТАТА"}</span>
          <h1>{target.mission.title}</h1>
          <p>{target.mission.description}</p>
          <div className="submit-mission-facts">
            <div><small>КОМПАНИЯ</small><strong>{target.company.name}</strong></div>
            <div><small>ВОЗНАГРАЖДЕНИЕ</small><strong>{target.mission.rewardLabel}</strong></div>
            <div><small>УСЛОВИЕ</small><strong>{target.mission.verificationRules}</strong></div>
            <div><small>ВЫПЛАТА</small><strong>{target.program.payoutTerms || "После подтверждения результата"}</strong></div>
          </div>
        </aside>
        <LeadSubmissionForm programSlug={slug} missionId={missionId} missionType={target.mission.type} token={access} formFields={target.program.formFields} />
      </div>
    </main>
  );
}

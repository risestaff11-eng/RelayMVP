import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getMissionForPublicSubmission, getPartnerPortal } from "../../../../../../db/partner";

export const metadata: Metadata = { title: "Передать рекомендацию", referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default async function SubmitLeadPage({ params, searchParams }: { params: Promise<{ slug: string; missionId: string }>; searchParams: Promise<{ access?: string }> }) {
  const { slug, missionId } = await params;
  const { access = "" } = await searchParams;
  const [target, portal] = await Promise.all([getMissionForPublicSubmission(slug, missionId), access ? getPartnerPortal(access) : null]);
  if (!target) notFound();
  if (!portal || portal.program.id !== target.program.id || !portal.acceptances.some((item) => item.missionId === missionId && item.status === "ACTIVE")) redirect(`/p/${slug}`);
  redirect(`/partner/${access}/submit/${missionId}`);
}

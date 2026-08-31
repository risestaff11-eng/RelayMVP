import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicReferral } from "../../../db/referrals";
import { MarketingLogo } from "../../marketing-logo";
import { ClientReferralForm } from "./client-referral-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Передать контакт", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function ClientReferralPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const referral = await getPublicReferral(token);
  if (!referral) notFound();
  return <main className="client-referral-page"><section className="client-referral-shell"><header><div className="brand"><MarketingLogo /><span>Yaler</span></div><small>РЕКОМЕНДАЦИЯ АГЕНТА</small><h1>{referral.company.name}</h1><p>{referral.mission.title}</p></header><div className="client-referral-body"><span className="client-referral-kicker">3 КОРОТКИХ ПОЛЯ</span><h2>Оставьте контакт</h2><p>Компания свяжется с вами по этому запросу. Заполнение займёт меньше минуты.</p><ClientReferralForm referralToken={token} /></div></section></main>;
}

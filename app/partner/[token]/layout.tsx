import { notFound } from "next/navigation";
import { getPartnerPortal } from "../../../db/partner";
import { SafeLink as Link } from "@/app/safe-link";
import { PartnerNav } from "../_components/partner-nav";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer", title: "Кабинет партнёра" };

export default async function PartnerLayout({ children, params }: { children: React.ReactNode; params: Promise<{ token: string }> }) {
  const { token } = await params;
  const portal = await getPartnerPortal(token);
  if (!portal) notFound();
  return <main className="partner-portal-shell"><aside className="partner-portal-sidebar"><Link className="brand partner-brand" href={`/partner/${token}`}><span className="brand-mark">R</span><span>Relay</span></Link><div className="partner-company-chip"><small>ПРОГРАММА</small><strong>{portal.company.name}</strong><span>● Активна</span></div><PartnerNav token={token} /><div className="partner-trust-note"><i>✓</i><div><strong>Ваши лиды зафиксированы</strong><p>Дата, владелец и история статусов сохраняются.</p></div></div></aside><section className="partner-portal-main"><header className="partner-portal-topbar"><div><small>ПАРТНЁР</small><strong>{portal.partner.name}</strong></div><div className="partner-level-pill"><span>УРОВЕНЬ {portal.profile.level}</span><b>{portal.profile.level === 1 ? "Навигатор" : "Проверенный партнёр"}</b></div></header>{children}</section></main>;
}

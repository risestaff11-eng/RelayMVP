import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPartnerPortal } from "../../../db/partner";
import { SafeLink as Link } from "@/app/safe-link";
import { PartnerNav } from "../_components/partner-nav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer", title: "Кабинет партнёра" };

export default async function PartnerLayout({ children, params }: { children: React.ReactNode; params: Promise<{ token: string }> }) {
  const { token } = await params;
  const portal = await getPartnerPortal(token);
  if (!portal) notFound();
  const initials = `${portal.profile.firstName[0] || ""}${portal.profile.lastName[0] || ""}`.toUpperCase() || "P";
  return <main className="partner-portal-shell"><aside className="partner-portal-sidebar"><Link className="brand partner-brand" href={`/partner/${token}`}><span className="brand-mark">R</span><span>Relay</span></Link><div className="partner-company-chip"><small>ПРОГРАММА</small><strong>{portal.company.name}</strong><span>● Активна</span></div><PartnerNav token={token} /><div className="partner-trust-note"><i>✓</i><div><strong>Ваши лиды зафиксированы</strong><p>Дата, владелец и история статусов сохраняются.</p></div></div></aside><section className="partner-portal-main"><header className="partner-portal-topbar"><div className="partner-top-identity"><div className="partner-mini-avatar">{portal.profile.avatarObjectKey ? <img src={`/api/partner/avatar?token=${token}`} alt="" /> : <span>{initials}</span>}</div><div><small>ПАРТНЁР</small><strong>{portal.profile.firstName || portal.partner.email}</strong></div></div><div className="partner-level-pill"><span>УРОВЕНЬ {portal.profile.level}</span><b>{portal.profile.level === 1 ? "Навигатор" : "Проверенный партнёр"}</b><button className="level-help" type="button" aria-label="Как перейти на следующий уровень">?<span role="tooltip">Для уровня 2 подтвердите email и WhatsApp, затем получите первый принятый лид. После этого откроются повышенные комиссии, приоритетная проверка и лучшие миссии.</span></button></div></header>{children}</section></main>;
}

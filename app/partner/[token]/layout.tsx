import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPartnerPortal } from "../../../db/partner";
import { SafeLink as Link } from "@/app/safe-link";
import { PartnerNav } from "../_components/partner-nav";
import { PartnerEarningStrip } from "../_components/partner-earning-strip";
import { MarketingLogo } from "../../marketing-logo";
import { CompanyLogo } from "../../dashboard/_components/company-brand";
import { QuickResultLauncher } from "../_components/partner-actions";
import { countRu } from "@/lib/format-display";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer", title: "Кабинет агента" };

export default async function PartnerLayout({ children, params }: { children: React.ReactNode; params: Promise<{ token: string }> }) {
  const { token } = await params;
  const portal = await getPartnerPortal(token);
  if (!portal) notFound();
  const initials = `${portal.profile.firstName[0] || ""}${portal.profile.lastName[0] || ""}`.toUpperCase() || "A";
  const activeMissions = portal.missions.filter((mission) => mission.status === "ACTIVE");
  const bestReward = [...activeMissions].sort((left, right) => right.rewardValue - left.rewardValue)[0];

  return (
    <main className="partner-portal-shell">
      <aside className="partner-portal-sidebar">
        <Link className="brand partner-brand" href={`/partner/${token}`}><MarketingLogo /><span>Yaler</span></Link>
        <div className="partner-company-chip"><CompanyLogo company={portal.company} /><small>КОМПАНИЯ</small><strong>{portal.company.name}</strong><span>● {countRu(portal.programs.length, "программа", "программы", "программ")} · задания доступны</span><a href="/agent">Сменить компанию ↗</a></div>
        <PartnerNav token={token} />
        <div className="partner-trust-note"><i>✓</i><div><strong>Заявки зафиксированы</strong><p>Дата, автор и история статусов сохраняются.</p></div></div>
      </aside>
      <section className="partner-portal-main">
        <header className="partner-portal-topbar">
          <div className="partner-top-identity">
            <div className="partner-mini-avatar">{portal.profile.avatarObjectKey ? <img src={`/api/partner/avatar?token=${token}`} alt="Аватар агента" /> : <span>{initials}</span>}</div>
            <div className="partner-top-copy"><small>АГЕНТ</small><strong>{portal.profile.firstName || portal.partner.email}</strong><PartnerEarningStrip token={token} activeCount={activeMissions.length} bestReward={bestReward?.rewardLabel} currency={portal.program.currency} /></div>
          </div>
          <a className="partner-company-switch-mobile" href="/agent">{portal.company.name} · сменить</a>
          <QuickResultLauncher token={token} missions={portal.missions} acceptedMissionIds={portal.acceptances.filter((item) => item.status === "ACTIVE").map((item) => item.missionId)} />
        </header>
        {children}
      </section>
    </main>
  );
}

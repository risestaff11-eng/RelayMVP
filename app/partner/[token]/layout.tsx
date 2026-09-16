import type { Metadata } from "next";
import SiteImage from "next/image";
import { notFound } from "next/navigation";
import { getPartnerPortal } from "../../../db/partner";
import { SafeLink as Link } from "@/app/safe-link";
import { PartnerNav } from "../_components/partner-nav";
import { MarketingLogo } from "../../marketing-logo";
import { CompanyLogo } from "../../dashboard/_components/company-brand";
import { QuickResultLauncher } from "../_components/partner-actions";
import { countRu } from "@/lib/format-display";
import { LanguageSwitcher } from "../../language-switcher";
import { cookies } from "next/headers";
import { AccessLinkExpiry } from "../_components/access-link-expiry";
import { AgentInbox } from "../_components/agent-inbox";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer", title: "Кабинет агента" };

export default async function PartnerLayout({ children, params }: { children: React.ReactNode; params: Promise<{ token: string }> }) {
  const { token } = await params;
  const portal = await getPartnerPortal(token);
  if (!portal) notFound();
  const locale = (await cookies()).get("relay_locale")?.value === "kk" ? "kk" : "ru";
  const initials = `${portal.profile.firstName[0] || ""}${portal.profile.lastName[0] || ""}`.toUpperCase() || "A";

  return (
    <main className="partner-portal-shell">
      <aside className="partner-portal-sidebar">
        <Link className="brand partner-brand" href={`/partner/${token}`}><MarketingLogo /><span>RiseStaff</span></Link>
        <div className="partner-company-chip"><CompanyLogo company={portal.company} /><small>КОМПАНИЯ</small><strong>{<bdi data-no-translate>{portal.company.name}</bdi>}</strong><span>● {countRu(portal.programs.length, "программа", "программы", "программ")} · задания доступны</span><a href="/agent">Сменить компанию ↗</a></div>
        <PartnerNav token={token} />
        <div className="partner-trust-note"><i>✓</i><div><strong>Заявки зафиксированы</strong><p>Дата, автор и история статусов сохраняются.</p></div></div>
      </aside>
      <section className="partner-portal-main">
        <header className="partner-portal-topbar">
          <div className="partner-top-identity">
            <Link className="partner-mini-avatar" href={`/partner/${token}/profile`} aria-label="Мой профиль">{portal.profile.avatarObjectKey ? <SiteImage unoptimized width={64} height={64} src={`/api/partner/avatar?token=${token}`} alt="Аватар агента" /> : <span>{initials}</span>}</Link>
            <div className="partner-top-copy"><strong data-no-translate>{portal.profile.firstName || portal.partner.email}</strong></div>
          </div>
          <a className="partner-company-switch-mobile" href="/agent">{<bdi data-no-translate>{portal.company.name}</bdi>} · сменить</a>
          <div className="partner-top-actions"><LanguageSwitcher locale={locale} className="agent-language-switcher" manageTranslation={false} compact /><QuickResultLauncher token={token} missions={portal.missions} acceptedMissionIds={portal.acceptances.filter((item) => item.status === "ACTIVE").map((item) => item.missionId)} /></div>
        </header>
        <AgentInbox token={token} readAt={portal.profile.notificationsReadAt} events={portal.submissions.flatMap(s=>s.events.filter(e=>e.actorType!=="PARTNER"&&!e.actorType.startsWith("PARTNER_")).map(e=>({...e,submissionId:s.id,name:s.contactName||s.contactCompany}))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}><AccessLinkExpiry expiresAt={portal.accessExpiresAt} now={portal.accessCheckedAt}/></AgentInbox>
        {portal.historyOnly && <div className="form-notice">Программы завершены или приостановлены. История заявок и выплаты доступны; новые задания пока недоступны.</div>}
        {children}
      </section>
    </main>
  );
}

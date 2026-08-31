import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SafeLink as Link } from "@/app/safe-link";
import { chatGPTSignOutPath, requireChatGPTUser } from "../chatgpt-auth";
import { getCompanyForUser } from "../../db/company";
import { DashboardNav } from "./_components/dashboard-nav";
import { DashboardTour } from "./_components/dashboard-tour";
import { AccountMenu } from "./_components/account-menu";
import { CompanyBrand, CompanyLogo } from "./_components/company-brand";
import { DashboardContext } from "./_components/dashboard-context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

function initials(value: string) {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "R";
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireChatGPTUser("/dashboard");
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <CompanyBrand company={{ id: company.id, name: company.name, logoObjectKey: company.logoObjectKey }} />
        <DashboardNav />
        <div className="sidebar-footer"><Link className="sidebar-ai-agent" href="/dashboard/assistant"><span>✦</span><div><strong>Yaler</strong><small>Помощник по программам</small></div><b>→</b></Link><p className="powered-by-relay">Powered by Yaler</p></div>
      </aside>

      <section className="dashboard-main">
        {user.supportMode && <div className="support-session-banner" role="status"><span><b>Режим техподдержки</b> Вы работаете в кабинете «{company.name}». Вход и время сессии фиксируются.</span><a href="/api/system/support/logout">Завершить и вернуться в админку →</a></div>}
        <header className="dashboard-topbar">
          <div className="mobile-company-identity"><CompanyLogo company={company} className="mobile-relay-mark" /><div><small>РАБОЧЕЕ ПРОСТРАНСТВО</small><strong>{company.name}</strong></div></div>
          <DashboardContext nextStep={company.onboardingStatus === "PROGRAM_PUBLISHED" ? "Программа опубликована · отслеживайте агентов и результаты" : company.onboardingStatus === "PROFILE_CONFIRMED" || company.onboardingStatus === "PROGRAM_DRAFT" ? "Профиль подтверждён · создайте и опубликуйте программу" : "Следующий шаг — подтвердить профиль бизнеса"} />
          <div className="top-actions"><DashboardTour /><AccountMenu name={user.displayName} email={user.email} initials={initials(user.displayName)} signOutHref={chatGPTSignOutPath("/")} /></div>
        </header>
        {children}
      </section>
    </main>
  );
}

import { redirect } from "next/navigation";
import { SafeLink as Link } from "@/app/safe-link";
import { chatGPTSignOutPath, requireChatGPTUser } from "../chatgpt-auth";
import { getCompanyForUser } from "../../db/company";
import { DashboardNav } from "./_components/dashboard-nav";
import { DashboardTour } from "./_components/dashboard-tour";
import { AccountMenu } from "./_components/account-menu";

export const dynamic = "force-dynamic";

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
        <Link className="brand company-white-label-brand" href="/dashboard" aria-label={`Вернуться в кабинет ${company.name}`}><span className="brand-mark">{initials(company.name)}</span><span><strong>{company.name}</strong><small>Рабочее пространство</small></span></Link>
        <DashboardNav />
        <div className="sidebar-footer"><Link className="sidebar-ai-agent" href="/dashboard/assistant"><span>✦</span><div><strong>AI-агент</strong><small>Развивать агентскую сеть</small></div><b>→</b></Link><p className="powered-by-relay">Powered by Relay</p></div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="mobile-company-identity"><span className="mobile-relay-mark">{initials(company.name)}</span><div><small>РАБОЧЕЕ ПРОСТРАНСТВО</small><strong>{company.name}</strong></div></div>
          <p>{company.onboardingStatus === "PROGRAM_PUBLISHED" ? "Программа опубликована · отслеживайте агентов и результаты" : company.onboardingStatus === "PROFILE_CONFIRMED" || company.onboardingStatus === "PROGRAM_DRAFT" ? "Профиль подтверждён · создайте и опубликуйте программу" : "Следующий шаг — подтвердить профиль бизнеса"}</p>
          <div className="top-actions"><DashboardTour /><AccountMenu name={user.displayName} email={user.email} initials={initials(user.displayName)} signOutHref={chatGPTSignOutPath("/")} /></div>
        </header>
        {children}
      </section>
    </main>
  );
}

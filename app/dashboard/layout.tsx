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
        <Link className="brand" href="/dashboard" aria-label="Вернуться в кабинет компании"><span className="brand-mark">R</span><span>Relay</span></Link>
        <div className="sidebar-context"><small>РАБОЧЕЕ ПРОСТРАНСТВО</small><strong>{company.name}</strong></div>
        <DashboardNav />
        <div className="sidebar-footer"><div className="sidebar-token"><span>AI</span><div><small>ОСТАТОК ТОКЕНОВ</small><strong>{company.aiTokenBalance.toLocaleString("ru-RU")}</strong></div>{company.aiTokenBalance < 1000 && <a href="https://wa.me/77765086000?text=%D0%97%D0%B0%D0%BA%D0%BE%D0%BD%D1%87%D0%B8%D0%BB%D0%B8%D1%81%D1%8C%20%D1%82%D0%BE%D0%BA%D0%B5%D0%BD%D1%8B" target="_blank" rel="noreferrer" aria-label="Написать в WhatsApp: закончились токены">◉</a>}</div></div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="mobile-company-identity"><span className="mobile-relay-mark">R</span><div><small>RELAY · КОМПАНИЯ</small><strong>{company.name}</strong></div></div>
          <p>{company.onboardingStatus === "PROGRAM_PUBLISHED" ? "Программа опубликована · отслеживайте агентов и результаты" : company.onboardingStatus === "PROFILE_CONFIRMED" || company.onboardingStatus === "PROGRAM_DRAFT" ? "Профиль подтверждён · создайте и опубликуйте программу" : "Следующий шаг — подтвердить профиль бизнеса"}</p>
          <div className="top-actions"><DashboardTour /><AccountMenu name={user.displayName} email={user.email} initials={initials(user.displayName)} signOutHref={chatGPTSignOutPath("/")} /></div>
        </header>
        {children}
      </section>
    </main>
  );
}

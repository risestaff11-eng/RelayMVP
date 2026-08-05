import { redirect } from "next/navigation";
import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "../chatgpt-auth";
import { getCompanyForUser } from "../../db/company";
import { DashboardNav } from "./_components/dashboard-nav";

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
        <Link className="brand" href="/"><span className="brand-mark">R</span><span>Relay</span></Link>
        <div className="sidebar-context"><small>РАБОЧЕЕ ПРОСТРАНСТВО</small><strong>{company.name}</strong></div>
        <DashboardNav />
        <div className="sidebar-footer">
          <Link className="sidebar-settings-link" href="/dashboard/settings"><span>⚙</span> Настройки профиля</Link>
          <div className="sidebar-user"><span className="sidebar-avatar">{initials(user.displayName)}</span><div><strong>{user.displayName}</strong><small>{user.email}</small></div></div>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <p>Компания зарегистрирована · следующий шаг — профиль бизнеса</p>
          <div className="top-actions"><Link className="icon-button" href="/dashboard/settings" aria-label="Настройки профиля">⚙</Link><a className="icon-button" href={chatGPTSignOutPath("/")} aria-label="Выйти">↪</a></div>
        </header>
        {children}
      </section>
    </main>
  );
}

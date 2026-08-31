import type { Metadata } from "next";
import { SafeLink as Link } from "@/app/safe-link";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../chatgpt-auth";
import { getCompanyForUser } from "../../db/company";
import { CompanyRegistrationForm } from "./registration-form";
import { marketingUrl } from "../../lib/public-origins";

export const metadata: Metadata = { title: "Создание компании", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireChatGPTUser("/onboarding");
  const company = await getCompanyForUser(user.userId);
  if (company) redirect("/dashboard");

  return (
    <main className="auth-page">
      <aside className="auth-aside">
        <Link className="brand" href={marketingUrl()}><span className="brand-mark">R</span><span>Yaler</span></Link>
        <div className="auth-message">
          <span className="auth-kicker">ШАГ 1 ИЗ 4</span>
          <h1>Начнём с вашей компании.</h1>
          <p>Дальше Yaler изучит сайт, подготовит профиль бизнеса и предложит четыре агентские задания.</p>
        </div>
        <div className="auth-steps" aria-label="Прогресс настройки"><span /><span /><span /><span /></div>
      </aside>

      <section className="auth-main">
        <div className="auth-card">
          <div className="auth-user"><span>Вы вошли как <strong>{user.displayName}</strong></span><span>Защищённый вход ✓</span></div>
          <h2>Создайте рабочее пространство</h2>
          <p>Эти данные станут основой будущей агентской программы. Всё можно изменить позже.</p>
          <CompanyRegistrationForm email={user.email} />
        </div>
      </section>
    </main>
  );
}

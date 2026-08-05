import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getCompanyForUser } from "../../../db/company";

export const metadata: Metadata = { title: "AI-профиль компании" };
export const dynamic = "force-dynamic";

const industryNames: Record<string, string> = {
  IT_AND_AUTOMATION: "IT и автоматизация",
  MARKETING: "Маркетинг и реклама",
  CONSULTING: "Консалтинг",
  RECRUITING: "Рекрутинг и HR",
  EDUCATION: "Корпоративное обучение",
  OTHER: "Другая отрасль",
};

export default async function CompanyProfilePage() {
  const user = await requireChatGPTUser("/dashboard/company-profile");
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");

  return (
    <div className="dashboard-content module-content">
      <div className="module-heading">
        <div><span className="module-kicker">ШАГ 2 ИЗ 4 · AI-ПРОФИЛЬ</span><h1>Подготовим профиль компании</h1><p>Relay использует подтверждённые данные как основу для генерации миссий.</p></div>
        <span className="progress-badge">25% готово</span>
      </div>

      <div className="profile-layout">
        <section className="panel profile-source">
          <div className="panel-header"><h2>Источник данных</h2><span className="status-dot">● Сайт сохранён</span></div>
          <div className="website-card">
            <div className="website-icon">↗</div>
            <div><small>САЙТ КОМПАНИИ</small><strong>{company.website}</strong><p>Relay проанализирует открытые страницы сайта. Перед запуском ИИ проверьте, что адрес ведёт на актуальную версию.</p></div>
          </div>
          <div className="company-facts">
            <div><small>КОМПАНИЯ</small><strong>{company.name}</strong></div>
            <div><small>ОТРАСЛЬ</small><strong>{industryNames[company.industry] ?? company.industry}</strong></div>
            <div><small>РОЛЬ</small><strong>Владелец пространства</strong></div>
          </div>
          <div className="profile-actions">
            <a className="button button-ghost" href={company.website} target="_blank" rel="noreferrer">Проверить сайт ↗</a>
            <a className="button button-primary" href="/dashboard/programs">Сайт указан верно <span>→</span></a>
          </div>
        </section>

        <aside className="panel extraction-panel">
          <div className="panel-header"><h2>Что соберёт ИИ</h2><span>8 блоков</span></div>
          <div className="extraction-list">
            {["Описание бизнеса", "Продукты и услуги", "Целевая аудитория", "Ключевые преимущества", "Триггеры покупки", "Неподходящие клиенты", "География продаж", "Партнёрский питч"].map((item, index) => (
              <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong><i>○</i></div>
            ))}
          </div>
          <p className="module-note">На следующем этапе подключим реальный AI-анализ и обязательное подтверждение каждого блока перед публикацией.</p>
        </aside>
      </div>
    </div>
  );
}

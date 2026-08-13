"use client";

import { useState } from "react";
import { SafeLink as Link } from "@/app/safe-link";
import { formatInteger } from "@/lib/format-display";

const plans = [
  { code: "TRIAL", name: "Старт", description: "Для проверки первого агентского канала.", features: ["Программы без ограничений в бете", "Кабинеты агентов", "5 000 AI-кредитов при регистрации"] },
  { code: "STARTER", name: "Рост", description: "Для регулярной работы с внешними агентами.", features: ["Несколько направлений", "Реестр результатов и выплат", "Расширенная аналитика"] },
  { code: "GROWTH", name: "Сеть", description: "Для масштабной сети агентов и интеграторов.", features: ["Сложные правила мотивации", "Приоритетная поддержка", "Индивидуальная конфигурация"] },
];

export function PlanSettings({ user, company }: { user: { name: string; email: string }; company: { name: string; website: string; contactWhatsapp: string; contactInstagram: string; planCode: string; aiTokenBalance: number; aiTokensUsed: number } }) {
  const [notice, setNotice] = useState<string | null>(null);
  const [contactWhatsapp, setContactWhatsapp] = useState(company.contactWhatsapp);
  const [contactInstagram, setContactInstagram] = useState(company.contactInstagram);
  const current = plans.find((plan) => plan.code === company.planCode) ?? plans[0];
  const total = Math.max(5000, company.aiTokenBalance + company.aiTokensUsed);
  const balancePercent = Math.max(2, Math.round(company.aiTokenBalance / total * 100));
  const lowBalance = company.aiTokenBalance < 1000;

  async function saveContacts(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice("Сохраняем контакты…");
    try {
      const response = await fetch("/api/company/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ contactWhatsapp, contactInstagram }) });
      const data = await response.json() as { error?: string; contactWhatsapp?: string; contactInstagram?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось сохранить контакты");
      setContactWhatsapp(data.contactWhatsapp ?? ""); setContactInstagram(data.contactInstagram ?? ""); setNotice("Контакты сохранены. Агенты увидят их в базе знаний.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Не удалось сохранить контакты"); }
  }

  return <div className="dashboard-content module-content settings-page">
    <div className="module-heading"><div><span className="module-kicker">ПРОФИЛЬ И ДОСТУП</span><h1>Настройки компании</h1><p>Аккаунт владельца, текущий тариф и прозрачный расход AI-кредитов.</p></div><Link className="button button-ghost compact-button" href="/dashboard/company-profile">← Вернуться к AI-профилю</Link></div>
    {notice && <div className="inline-notice" role="status">{notice}</div>}
    <div className="settings-overview-grid">
      <section className="panel account-card"><div className="panel-header"><h2>Профиль владельца</h2><span>OWNER</span></div><dl><div><dt>Имя</dt><dd>{user.name}</dd></div><div><dt>Email</dt><dd>{user.email}</dd></div><div><dt>Компания</dt><dd>{company.name}</dd></div><div><dt>Сайт</dt><dd>{company.website}</dd></div></dl></section>
      <section className={`panel token-balance-card ${lowBalance ? "low" : ""}`}><div className="panel-header"><h2>Баланс AI-кредитов</h2><span>Gemini · {current.name}</span></div><strong>{formatInteger(company.aiTokenBalance)}</strong><p>AI-кредитов доступно</p><div className="token-progress"><span style={{ width: `${balancePercent}%` }} /></div><div className="token-stats"><span>Использовано <b>{formatInteger(company.aiTokensUsed)}</b></span><span>Стартовый баланс <b>5 000</b></span></div>{lowBalance ? <a className="token-whatsapp" href="https://wa.me/77765086000?text=%D0%97%D0%B0%D0%BA%D0%BE%D0%BD%D1%87%D0%B8%D0%BB%D0%B8%D1%81%D1%8C%20%D1%82%D0%BE%D0%BA%D0%B5%D0%BD%D1%8B" target="_blank" rel="noreferrer">◉ AI-кредиты заканчиваются — написать в WhatsApp</a> : <small>Чат: 8–120 · анализ сайта: до 600 · программа: до 900 AI-кредитов. Списание зависит от фактического объёма.</small>}</section>
    </div>
    <section className="panel company-contact-settings"><div className="panel-header"><div><h2>Контакты для агентов</h2><p>Они отображаются в базе знаний агента рядом с материалами компании.</p></div><span>ПУБЛИЧНЫЕ</span></div><form onSubmit={saveContacts}><label><span>WhatsApp компании</span><input type="tel" value={contactWhatsapp} onChange={(event) => setContactWhatsapp(event.target.value)} placeholder="+7 700 000 00 00" /></label><label><span>Instagram компании</span><input value={contactInstagram} onChange={(event) => setContactInstagram(event.target.value)} placeholder="company" /></label><button type="submit">Сохранить контакты</button></form></section>
    <section className="plan-section"><div className="plan-section-heading"><div><span className="module-kicker">ТЕКУЩИЙ ТАРИФ: {current.name.toUpperCase()}</span><h2>Варианты подключения</h2></div><span className="beta-pill">Бета-доступ</span></div><div className="plan-grid">{plans.map((plan) => { const active = plan.code === current.code; return <article className={`plan-card ${active ? "active" : ""}`} key={plan.code}><div><span className="plan-name">{plan.name}</span>{active && <span className="current-plan-badge">Текущий</span>}</div><strong>По запросу</strong><p>{plan.description}</p><ul>{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul><button type="button" disabled={active} onClick={() => setNotice(`Переключение на тариф «${plan.name}» пока не подключено. Напишите нам — настроим доступ вручную.`)}>{active ? "Подключён" : "Скоро"}</button></article>; })}</div><p className="billing-disclaimer">Цены пока не публикуются. Смена тарифа не создаёт подписку и не списывает деньги.</p></section>
  </div>;
}

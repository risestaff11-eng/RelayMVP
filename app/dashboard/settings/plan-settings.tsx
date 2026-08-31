"use client";

import { useState } from "react";
import { SafeLink as Link } from "@/app/safe-link";
import { formatInteger } from "@/lib/format-display";
import { INITIAL_COMPANY_AI_CREDITS } from "@/lib/company-credits";
import { aiCreditLimit } from "@/lib/ai-credits";

const plans = [
  { code: "TRIAL", name: "Старт", description: "Для запуска первого агентского канала.", features: ["Программы и задания для агентов", "Кабинеты компании и агентов", "50 000 AI-кредитов при регистрации"] },
  { code: "STARTER", name: "Рост", description: "Для регулярной работы с внешними агентами.", features: ["Несколько направлений", "Реестр результатов и выплат", "Расширенная аналитика"] },
  { code: "GROWTH", name: "Сеть", description: "Для масштабной сети агентов и интеграторов.", features: ["Сложные правила мотивации", "Приоритетная поддержка", "Индивидуальная конфигурация"] },
];

export function PlanSettings({ user, company }: { user: { name: string; email: string }; company: { name: string; website: string; contactWhatsapp: string; contactInstagram: string; planCode: string; aiTokenBalance: number; aiTokensUsed: number } }) {
  const [notice, setNotice] = useState<string | null>(null);
  const [contactWhatsapp, setContactWhatsapp] = useState(company.contactWhatsapp);
  const [contactInstagram, setContactInstagram] = useState(company.contactInstagram);
  const current = plans.find((plan) => plan.code === company.planCode) ?? plans[0];
  const total = Math.max(INITIAL_COMPANY_AI_CREDITS, company.aiTokenBalance + company.aiTokensUsed);
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
    <div className="module-heading"><div><span className="module-kicker">ПРОФИЛЬ И ДОСТУП</span><h1>Настройки компании</h1><p>Аккаунт владельца, текущий тариф и запас Yaler.</p></div><Link className="button button-ghost compact-button" href="/dashboard/company-profile">← Вернуться к профилю компании</Link></div>
    {notice && <div className="inline-notice" role="status">{notice}</div>}
    <div className="settings-overview-grid">
      <section className="panel account-card"><div className="panel-header"><h2>Профиль владельца</h2><span>OWNER</span></div><dl><div><dt>Имя</dt><dd>{user.name}</dd></div><div><dt>Email</dt><dd>{user.email}</dd></div><div><dt>Компания</dt><dd>{company.name}</dd></div><div><dt>Сайт</dt><dd>{company.website}</dd></div></dl></section>
      <section className={`panel token-balance-card ${lowBalance ? "low" : ""}`}><div className="panel-header"><h2>AI-кредиты</h2><span>{current.name}</span></div><strong>{formatInteger(company.aiTokenBalance)}</strong><p>доступно сейчас</p><div className="token-progress"><span style={{ width: `${balancePercent}%` }} /></div><div className="token-stats"><span>Лимит периода <b>{formatInteger(total)}</b></span><span>Фактически использовано <b>{formatInteger(company.aiTokensUsed)}</b></span><span>Следующая генерация программы <b>до {formatInteger(aiCreditLimit("PROGRAM_GENERATION"))}</b></span><span>Один ответ помощника <b>до {formatInteger(aiCreditLimit("ASSISTANT_REPLY"))}</b></span></div>{lowBalance ? <a className="token-whatsapp" href="https://wa.me/77765086000?text=%D0%97%D0%B0%D0%BA%D0%BE%D0%BD%D1%87%D0%B8%D0%BB%D0%B8%D1%81%D1%8C%20%D1%82%D0%BE%D0%BA%D0%B5%D0%BD%D1%8B" target="_blank" rel="noreferrer">Кредиты заканчиваются — написать в WhatsApp</a> : <small>После каждого AI-действия баланс обновляется по фактическому расходу. Указанные значения — максимальное списание за одну операцию.</small>}</section>
    </div>
    <section className="panel company-contact-settings"><div className="panel-header"><div><h2>Контакты для агентов</h2><p>Они отображаются в базе знаний агента рядом с материалами компании.</p></div><span>ПУБЛИЧНЫЕ</span></div><form onSubmit={saveContacts}><label><span>WhatsApp компании</span><input type="tel" value={contactWhatsapp} onChange={(event) => setContactWhatsapp(event.target.value)} placeholder="+7 700 000 00 00" /></label><label><span>Instagram компании</span><input value={contactInstagram} onChange={(event) => setContactInstagram(event.target.value)} placeholder="company" /></label><button type="submit">Сохранить контакты</button></form></section>
    <section className="panel company-data-export"><div><span className="module-kicker">РЕЗЕРВНАЯ КОПИЯ</span><h2>Экспорт данных компании</h2><p>Скачайте программы, задания, агентов, заявки, историю решений, выплаты, отчёты и материалы одним JSON-файлом.</p></div><a className="button button-ghost" href="/api/company/export" download>Скачать данные компании ↓</a></section>
    <section className="plan-section"><div className="plan-section-heading"><div><span className="module-kicker">ТЕКУЩИЙ ФОРМАТ: {current.name.toUpperCase()}</span><h2>Варианты подключения</h2></div><span className="beta-pill">Доступ активен</span></div><div className="plan-grid">{plans.map((plan) => { const active = plan.code === current.code; return <article className={`plan-card ${active ? "active" : ""}`} key={plan.code}><div><span className="plan-name">{plan.name}</span>{active && <span className="current-plan-badge">Текущий</span>}</div><strong>По заявке</strong><p>{plan.description}</p><ul>{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul><button type="button" disabled={active} onClick={() => setNotice(`Переход на формат «${plan.name}» согласуем с вами лично. Напишите нам — настроим доступ.`)}>{active ? "Подключён" : "Обсудить"}</button></article>; })}</div><p className="billing-disclaimer">Формат подключения подбирается под количество программ, агентов и нужный уровень сопровождения.</p></section>
  </div>;
}

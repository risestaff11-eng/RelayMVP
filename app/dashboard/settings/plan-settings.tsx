"use client";

import { useState } from "react";
import { SafeLink as Link } from "@/app/safe-link";
import { formatInteger } from "@/lib/format-display";
import { INITIAL_COMPANY_AI_CREDITS } from "@/lib/company-credits";
import { aiCreditLimit } from "@/lib/ai-credits";
import { SubscriptionPlans } from "./subscription-plans";
import { subscriptionState, type SubscriptionFields } from "@/lib/subscription-plans";

export function PlanSettings({ user, company }: { user: { name: string; email: string }; company: SubscriptionFields & { name: string; website: string; contactWhatsapp: string; contactInstagram: string; aiTokenBalance: number; aiTokensUsed: number; reviewSlaHours: number; payoutSlaDays: number } }) {
  const [notice, setNotice] = useState<string | null>(null);
  const [contactWhatsapp, setContactWhatsapp] = useState(company.contactWhatsapp);
  const [contactInstagram, setContactInstagram] = useState(company.contactInstagram);
  const [reviewSlaHours, setReviewSlaHours] = useState(company.reviewSlaHours);
  const [payoutSlaDays, setPayoutSlaDays] = useState(company.payoutSlaDays);
  const current = subscriptionState(company);
  const total = Math.max(INITIAL_COMPANY_AI_CREDITS, company.aiTokenBalance + company.aiTokensUsed);
  const balancePercent = Math.max(2, Math.round(company.aiTokenBalance / total * 100));
  const lowBalance = company.aiTokenBalance < 1000;

  async function saveContacts(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice("Сохраняем контакты…");
    try {
      const response = await fetch("/api/company/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ contactWhatsapp, contactInstagram, reviewSlaHours, payoutSlaDays }) });
      const data = await response.json() as { error?: string; contactWhatsapp?: string; contactInstagram?: string; reviewSlaHours?: number; payoutSlaDays?: number };
      if (!response.ok) throw new Error(data.error || "Не удалось сохранить контакты");
      setContactWhatsapp(data.contactWhatsapp ?? ""); setContactInstagram(data.contactInstagram ?? ""); setReviewSlaHours(data.reviewSlaHours ?? reviewSlaHours); setPayoutSlaDays(data.payoutSlaDays ?? payoutSlaDays); setNotice("Контакты и сроки работы сохранены.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Не удалось сохранить контакты"); }
  }

  return <div className="dashboard-content module-content settings-page">
    <div className="module-heading"><div><span className="module-kicker">ПРОФИЛЬ И ДОСТУП</span><h1>Настройки компании</h1><p>Аккаунт владельца, текущий тариф и AI-кредиты.</p></div><div className="heading-actions settings-heading-actions"><Link className="button button-ghost compact-button" href="/dashboard/company-profile">← Вернуться к профилю компании</Link><Link className="button button-ghost compact-button" href="/dashboard/notifications">Уведомления</Link><Link className="button button-ghost compact-button" href="/dashboard/integrations">Интеграции</Link></div></div>
    {notice && <div className="inline-notice" role="status">{notice}</div>}
    <div className="settings-overview-grid">
      <section className="panel account-card"><div className="panel-header"><h2>Профиль владельца</h2><span>OWNER</span></div><dl><div><dt>Имя</dt><dd>{user.name}</dd></div><div><dt>Email</dt><dd>{user.email}</dd></div><div><dt>Компания</dt><dd>{<bdi data-no-translate>{company.name}</bdi>}</dd></div><div><dt>Сайт</dt><dd>{company.website}</dd></div></dl></section>
      <section className={`panel token-balance-card ${lowBalance ? "low" : ""}`}><div className="panel-header"><h2>AI-кредиты</h2><span>{current.name}</span></div><strong>{formatInteger(company.aiTokenBalance)}</strong><p>доступно сейчас</p><div className="token-progress"><span style={{ width: `${balancePercent}%` }} /></div><div className="token-stats"><span>Всего выдано <b>{formatInteger(total)}</b></span><span>Использовано за всё время <b>{formatInteger(company.aiTokensUsed)}</b></span><span>Следующая генерация программы <b>до {formatInteger(aiCreditLimit("PROGRAM_GENERATION"))}</b></span><span>Один ответ помощника <b>до {formatInteger(aiCreditLimit("ASSISTANT_REPLY"))}</b></span></div>{lowBalance ? <a className="token-whatsapp" href="https://wa.me/77765086000?text=%D0%97%D0%B0%D0%BA%D0%BE%D0%BD%D1%87%D0%B8%D0%BB%D0%B8%D1%81%D1%8C%20%D1%82%D0%BE%D0%BA%D0%B5%D0%BD%D1%8B" target="_blank" rel="noreferrer">Кредиты заканчиваются — написать в WhatsApp</a> : <small>После каждого AI-действия баланс обновляется по фактическому расходу. Указанные значения — максимальное списание за одну операцию.</small>}</section>
    </div>
    <section className="panel company-contact-settings"><div className="panel-header"><div><h2>Контакты и сроки работы</h2><p>Контакты видят агенты. Сроки используются в заявках, выплатах и уведомлениях.</p></div><span>ПРАВИЛА</span></div><form onSubmit={saveContacts}><label><span>WhatsApp компании</span><input type="tel" value={contactWhatsapp} onChange={(event) => setContactWhatsapp(event.target.value)} placeholder="+7 700 000 00 00" /></label><label><span>Instagram компании</span><input value={contactInstagram} onChange={(event) => setContactInstagram(event.target.value)} placeholder="company" /></label><label><span>Проверить новую заявку за, часов</span><input type="number" min="1" max="336" value={reviewSlaHours} onChange={(event) => setReviewSlaHours(Number(event.target.value) || 1)} /></label><label><span>Выплатить после начисления за, дней</span><input type="number" min="1" max="90" value={payoutSlaDays} onChange={(event) => setPayoutSlaDays(Number(event.target.value) || 1)} /></label><button type="submit">Сохранить настройки</button></form></section>
    <section className="panel company-data-export"><div><span className="module-kicker">РЕЗЕРВНАЯ КОПИЯ</span><h2>Экспорт данных компании</h2><p>Скачайте программы, задания, агентов, заявки, историю решений, выплаты, отчёты и материалы одним JSON-файлом.</p></div><a className="button button-ghost" href="/api/company/export" download>Скачать данные компании ↓</a></section>
    <SubscriptionPlans company={company} />
  </div>;
}

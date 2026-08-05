"use client";

import { useState } from "react";
import Link from "next/link";

const plans = [
  { code: "TRIAL", name: "Пробный", price: "0 $", tokens: 100000, description: "Для первого AI-профиля и проверки сценария.", features: ["1 компания", "1 программа", "100 000 AI-токенов"] },
  { code: "STARTER", name: "Starter", price: "29 $ / мес", tokens: 500000, description: "Для запуска первого партнёрского канала.", features: ["До 3 программ", "До 100 партнёров", "500 000 AI-токенов"] },
  { code: "GROWTH", name: "Growth", price: "79 $ / мес", tokens: 2000000, description: "Для команды с несколькими программами.", features: ["Без лимита программ", "До 500 партнёров", "2 000 000 AI-токенов"] },
];

export function PlanSettings({ user, company }: { user: { name: string; email: string }; company: { name: string; website: string; planCode: string; aiTokenBalance: number; aiTokensUsed: number } }) {
  const [planCode, setPlanCode] = useState(company.planCode);
  const [balance, setBalance] = useState(company.aiTokenBalance);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const current = plans.find((plan) => plan.code === planCode) ?? plans[0];
  const total = balance + company.aiTokensUsed;
  const balancePercent = total > 0 ? Math.max(2, Math.round(balance / total * 100)) : 0;

  async function changePlan(code: string) {
    setPending(code);
    setNotice(null);
    try {
      const response = await fetch("/api/company/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ planCode: code }) });
      const data = await response.json() as { planCode?: string; aiTokenBalance?: number; error?: string };
      if (!response.ok || !data.planCode) throw new Error(data.error || "Не удалось изменить тариф");
      setPlanCode(data.planCode);
      if (typeof data.aiTokenBalance === "number") setBalance(data.aiTokenBalance);
      setNotice("Тариф изменён в бета-режиме. Платёж не списан; биллинг будет подключён отдельно.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Не удалось изменить тариф");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="dashboard-content module-content settings-page">
      <div className="module-heading"><div><span className="module-kicker">ПРОФИЛЬ И ТАРИФ</span><h1>Настройки компании</h1><p>Аккаунт владельца, текущий тариф и прозрачный расход AI-токенов.</p></div><Link className="button button-ghost compact-button" href="/dashboard/company-profile">← Вернуться к AI-профилю</Link></div>
      {notice && <div className="inline-notice success" role="status">{notice}</div>}

      <div className="settings-overview-grid">
        <section className="panel account-card"><div className="panel-header"><h2>Профиль владельца</h2><span>OWNER</span></div><dl><div><dt>Имя</dt><dd>{user.name}</dd></div><div><dt>Email</dt><dd>{user.email}</dd></div><div><dt>Компания</dt><dd>{company.name}</dd></div><div><dt>Сайт</dt><dd>{company.website}</dd></div></dl></section>
        <section className="panel token-balance-card"><div className="panel-header"><h2>Баланс AI</h2><span>{current.name}</span></div><strong>{balance.toLocaleString("ru-RU")}</strong><p>токенов доступно</p><div className="token-progress"><span style={{ width: `${balancePercent}%` }} /></div><div className="token-stats"><span>Использовано <b>{company.aiTokensUsed.toLocaleString("ru-RU")}</b></span><span>Текущий пакет <b>{current.tokens.toLocaleString("ru-RU")}</b></span></div><small>Баланс Relay считается по фактическим input + output токенам OpenAI. Это продуктовые кредиты, а не баланс аккаунта OpenAI.</small></section>
      </div>

      <section className="plan-section"><div className="plan-section-heading"><div><span className="module-kicker">ТЕКУЩИЙ ТАРИФ: {current.name.toUpperCase()}</span><h2>Сменить тариф</h2></div><span className="beta-pill">Бета · без списания оплаты</span></div><div className="plan-grid">{plans.map((plan) => { const active = plan.code === planCode; return <article className={`plan-card ${active ? "active" : ""}`} key={plan.code}><div><span className="plan-name">{plan.name}</span>{active && <span className="current-plan-badge">Текущий</span>}</div><strong>{plan.price}</strong><p>{plan.description}</p><ul>{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul><button type="button" onClick={() => changePlan(plan.code)} disabled={active || pending !== null}>{active ? "Подключён" : pending === plan.code ? "Меняем…" : "Выбрать тариф"}</button></article>; })}</div><p className="billing-disclaimer">Сейчас смена тарифа нужна для тестирования лимитов и интерфейса. До подключения Stripe или другого биллинга она не создаёт подписку и не списывает деньги.</p></section>
    </div>
  );
}

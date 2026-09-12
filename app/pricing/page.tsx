import type { Metadata } from "next";
import { SafeLink as Link } from "@/app/safe-link";
import { MarketingLogo } from "../marketing-logo";
import { PAID_PLANS, TRIAL_DAYS } from "@/lib/subscription-plans";
import { formatInteger, countRu } from "@/lib/format-display";

export const metadata: Metadata = { title: "Тарифы RiseStaff", description: "14 дней без карты. Три тарифа для управления рекомендациями, клиентами и вознаграждениями.", alternates: { canonical: "https://risestaff.kz/pricing" } };

export default function PricingPage() {
  return <main className="marketing-subpage pricing-page">
    <a className="skip-link" href="#main-content">К тарифам</a>
    <header className="subpage-header">
      <Link className="lp-brand" href="/" aria-label="RiseStaff — главная"><MarketingLogo /><span>RiseStaff</span></Link>
      <Link className="subpage-back" href="/">← На главную</Link>
    </header>
    <section className="pricing-hero" id="main-content">
      <span>ТАРИФЫ RISESTAFF</span>
      <h1>Начните с одной программы. Расширяйтесь, когда появляются продажи.</h1>
      <p>{TRIAL_DAYS} дней без карты: до 5 работающих программ, отчёты, интеграционный API и 50 000 AI-кредитов. Автоматического списания нет.</p>
    </section>
    <section className="pricing-grid" aria-label="Тарифы RiseStaff">
      {PAID_PLANS.map((plan) => <article key={plan.code}>
        <h2>{plan.name}</h2>
        <p><strong>{formatInteger(plan.price)} ₸</strong> / 30 дней</p>
        <ul>
          <li>{countRu(plan.programs, "работающая программа", "работающие программы", "работающих программ")}</li>
          <li>CRM, аналитика, вознаграждения и экспорт</li>
          <li>Без лимита на количество агентов и заявок</li>
          <li>{formatInteger(plan.credits)} AI-кредитов за оплаченный период</li>
          {plan.reports && <li>Отчёты амбассадоров и анализ</li>}
          {plan.integrations && <li>API и исходящие webhooks</li>}
        </ul>
        <Link href="https://company.risestaff.kz/auth?mode=register">Начать 14 дней <span aria-hidden="true">↗</span></Link>
      </article>)}
    </section>
    <section className="pricing-note"><strong>С чего начать?</strong><p>Создайте программу и пригласите первых рекомендателей. После тестирования выберите тариф — мы активируем его вручную после согласования оплаты. Опубликованные программы и программы на паузе входят в лимит; архив и черновики — нет. Готовые коннекторы к внешним CRM не включены: их подключение согласуется отдельно.</p></section>
  </main>;
}

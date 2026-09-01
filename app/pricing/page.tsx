import type { Metadata } from "next";
import { SafeLink as Link } from "@/app/safe-link";
import { MarketingLogo } from "../marketing-logo";

export const metadata: Metadata = { title: "Варианты подключения", description: "Форматы RiseStaff для одной программы, нескольких направлений и индивидуального внедрения.", alternates: { canonical: "https://risestaff.kz/pricing" } };

const plans = [
  { code: "01", name: "Старт", label: "ПЕРВАЯ ПРОГРАММА", text: "Для компании, которая приглашает первых агентов и хочет проверить, какие задания приносят результаты.", features: ["Четыре типа заданий", "Публичная ссылка и кабинет агента", "Статусы лидов и сделок", "Учёт вознаграждений"] },
  { code: "02", name: "Команда", label: "НЕСКОЛЬКО ПРОГРАММ", text: "Для отдела продаж или маркетинга, который ведёт несколько продуктов и регулярно работает с внешними агентами.", features: ["Несколько направлений и программ", "Управление списком агентов", "Фильтры по заданиям и результатам", "Аналитика по агентам"] },
  { code: "03", name: "Индивидуальный", label: "ПОД ПРОЦЕССЫ КОМПАНИИ", text: "Для компании, которой нужны свои правила проверки, роли сотрудников и передача данных в рабочие системы.", features: ["Настройка программы под ваши правила", "Роли команды и порядок проверки", "Интеграции с CRM и внутренними системами", "Помощь с запуском"] },
];

const whatsapp = "https://wa.me/77765086000?text=%D0%A0%D1%83%D1%81%20%D0%A1%D0%B0%D0%BB%D0%B5%D0%BC%20%D0%B4%D0%B0%D0%B2%D0%B0%D0%B9%20%D0%BE%D0%B1%D1%81%D1%83%D0%B4%D0%B8%D0%BC%20RiseStaff";

export default function PricingPage() {
  return <main className="marketing-subpage pricing-page">
    <a className="skip-link" href="#main-content">К тарифам</a>
    <header className="subpage-header">
      <Link className="lp-brand" href="/" aria-label="RiseStaff — главная"><MarketingLogo /><span>RiseStaff</span></Link>
      <Link className="subpage-back" href="/">← На главную</Link>
    </header>
    <section className="pricing-hero" id="main-content">
      <span>ВАРИАНТЫ ПОДКЛЮЧЕНИЯ</span>
      <h1>Выберите формат по количеству программ, агентов и задач команды.</h1>
      <p>Каждая новая компания получает 50 000 AI-кредитов для черновиков заданий и материалов. Условия подключения обсудим после короткого разговора о вашем процессе продаж.</p>
    </section>
    <section className="pricing-grid" aria-label="Варианты подключения RiseStaff">
      {plans.map((plan) => <article key={plan.code}>
        <div><span>{plan.code}</span><small>{plan.label}</small></div>
        <h2>{plan.name}</h2>
        <p>{plan.text}</p>
        <ul>{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>
        <a href={whatsapp} target="_blank" rel="noreferrer">Задать вопрос о подключении <span aria-hidden="true">↗</span></a>
      </article>)}
    </section>
    <section className="pricing-note"><strong>С чего начать?</strong><p>Опишите один продукт, один тип результата и круг первых агентов. Этого достаточно, чтобы выбрать формат и подготовить первую программу.</p></section>
  </main>;
}

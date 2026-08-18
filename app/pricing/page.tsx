import type { Metadata } from "next";
import { SafeLink as Link } from "@/app/safe-link";
import { MarketingLogo } from "../marketing-logo";

export const metadata: Metadata = { title: "Варианты подключения", description: "Форматы подключения Relay для запуска и масштабирования агентской программы.", alternates: { canonical: "https://risestaff.kz/pricing" } };

const plans = [
  { code: "01", name: "Старт", label: "ПРОВЕРИТЬ КАНАЛ", text: "Для компании, которая запускает первую агентскую программу и хочет получить первые рекомендации без сложного внедрения.", features: ["Агентские программы и четыре типа заданий", "Публичная ссылка и кабинет агента", "Воронка лидов и история статусов", "Ручная фиксация вознаграждений"] },
  { code: "02", name: "Рост", label: "МАСШТАБИРОВАТЬ", text: "Для команды с несколькими продуктами и регулярным потоком лидов от агентов, клиентов и отраслевых экспертов.", features: ["Несколько направлений и программ", "Расширенная работа с агентами", "Фильтры и сравнение заданий", "Аналитика агентского канала"] },
  { code: "03", name: "Сеть", label: "ПОСТРОИТЬ ЭКОСИСТЕМУ", text: "Для компании, которая строит полноценную сеть агентов и интеграторов с индивидуальными правилами и сопровождением.", features: ["Индивидуальная модель программы", "Роли команды и процессы проверки", "Интеграции с CRM и внутренними системами", "Совместный запуск и сопровождение"] },
];

const whatsapp = "https://wa.me/77765086000?text=%D0%A0%D1%83%D1%81%20%D0%A1%D0%B0%D0%BB%D0%B5%D0%BC%20%D0%B4%D0%B0%D0%B2%D0%B0%D0%B9%20%D0%BE%D0%B1%D1%81%D1%83%D0%B4%D0%B8%D0%BC%20Relay";

export default function PricingPage() {
  return <main className="marketing-subpage pricing-page">
    <a className="skip-link" href="#main-content">К тарифам</a>
    <header className="subpage-header">
      <Link className="lp-brand" href="/" aria-label="Relay — главная"><MarketingLogo /><span>Relay</span></Link>
      <Link className="subpage-back" href="/">← На главную</Link>
    </header>
    <section className="pricing-hero" id="main-content">
      <span>ВАРИАНТЫ ПОДКЛЮЧЕНИЯ</span>
      <h1>Начните со стартового формата и масштабируйте агентский канал по мере роста.</h1>
      <p>Каждая новая компания получает 50 000 AI-кредитов для настройки профиля и первых программ. Подходящий формат подключения подберём по вашим задачам и масштабу сети.</p>
    </section>
    <section className="pricing-grid" aria-label="Варианты подключения Relay">
      {plans.map((plan) => <article key={plan.code}>
        <div><span>{plan.code}</span><small>{plan.label}</small></div>
        <h2>{plan.name}</h2>
        <p>{plan.text}</p>
        <ul>{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>
        <a href={whatsapp} target="_blank" rel="noreferrer">Задать вопрос о подключении <span aria-hidden="true">↗</span></a>
      </article>)}
    </section>
    <section className="pricing-note"><strong>Как выбрать формат?</strong><p>Начните со своей первой программы. Когда появятся агенты и результаты, согласуем подходящий уровень подключения с учётом количества программ, участников и нужного сопровождения.</p></section>
  </main>;
}

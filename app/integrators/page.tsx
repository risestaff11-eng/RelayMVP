import type { Metadata } from "next";
import { SafeLink as Link } from "@/app/safe-link";
import { MarketingLogo } from "../marketing-logo";

export const metadata: Metadata = { title: "Стать интегратором", description: "Запускайте агентские каналы для клиентов вместе с Relay." };
const whatsapp = "https://wa.me/77765086000?text=%D0%A0%D1%83%D1%81%20%D0%A1%D0%B0%D0%BB%D0%B5%D0%BC%20%D0%B4%D0%B0%D0%B2%D0%B0%D0%B9%20%D0%BE%D0%B1%D1%81%D1%83%D0%B4%D0%B8%D0%BC%20Relay";

export default function IntegratorsPage() {
  return <main className="integrator-page">
    <a className="skip-link" href="#main-content">К предложению для интеграторов</a>
    <header>
      <Link className="lp-brand" href="/" aria-label="Relay — главная"><MarketingLogo /><span>Relay</span></Link>
      <Link className="subpage-back" href="/">← На главную</Link>
    </header>
    <section className="integrator-hero" id="main-content">
      <div className="integrator-center">
        <span>АГЕНТСКАЯ ПРОГРАММА RELAY</span>
        <h1>Станьте интегратором агентских продаж.</h1>
        <p>Помогайте B2B-компаниям запускать новый канал, сопровождайте программы и создавайте повторяемый доход на экспертизе.</p>
        <a href={whatsapp} target="_blank" rel="noreferrer">Обсудить сотрудничество <span aria-hidden="true">↗</span></a>
      </div>
      <div className="integrator-logo-grid" aria-label="Преимущества интегратора Relay">
        <article className="tile-lime"><small>01 · ДОХОД</small><h2>Зарабатывайте на запуске</h2><p>Продавайте настройку программ, упаковку заданий и сопровождение клиента.</p><b aria-hidden="true">↗</b></article>
        <article className="tile-dark"><small>02 · ПРОДУКТ</small><h2>Не создавайте платформу с нуля</h2><p>Relay уже даёт кабинеты компании и агента, воронку и прозрачные начисления.</p><b aria-hidden="true">◎</b></article>
        <article className="tile-blue"><small>03 · ЭКСПЕРТИЗА</small><h2>Станьте сильнее в B2B</h2><p>Добавьте агентские продажи к CRM, маркетингу, консалтингу или автоматизации.</p><b aria-hidden="true">✦</b></article>
        <article className="tile-paper"><small>04 · РОСТ</small><h2>Получайте повторные проекты</h2><p>После запуска клиенту нужны новые задания, аналитика и развитие агентской сети.</p><b aria-hidden="true">✓</b></article>
      </div>
    </section>
  </main>;
}

import type { Metadata } from "next";
import { SafeLink as Link } from "@/app/safe-link";
import { MarketingLogo } from "../marketing-logo";

export const metadata: Metadata = { title: "Интеграторам RiseStaff", description: "Настраивайте RiseStaff для компаний и зарабатывайте на запуске, материалах и сопровождении агентских программ.", alternates: { canonical: "https://risestaff.kz/integrators" } };
const whatsapp = "https://wa.me/77765086000?text=%D0%A0%D1%83%D1%81%20%D0%A1%D0%B0%D0%BB%D0%B5%D0%BC%20%D0%B4%D0%B0%D0%B2%D0%B0%D0%B9%20%D0%BE%D0%B1%D1%81%D1%83%D0%B4%D0%B8%D0%BC%20RiseStaff";

export default function IntegratorsPage() {
  return <main className="integrator-page">
    <a className="skip-link" href="#main-content">К предложению для интеграторов</a>
    <header>
      <Link className="lp-brand" href="/" aria-label="RiseStaff — главная"><MarketingLogo /><span>RiseStaff</span></Link>
      <Link className="subpage-back" href="/">← На главную</Link>
    </header>
    <section className="integrator-hero" id="main-content">
      <div className="integrator-center">
        <span>ДЛЯ CRM-ИНТЕГРАТОРОВ, МАРКЕТОЛОГОВ И КОНСУЛЬТАНТОВ</span>
        <h1>Запускайте RiseStaff клиентам и зарабатывайте на настройке.</h1>
        <p>Вы готовите программу, задания и материалы для агентов. Клиент получает рабочий кабинет, а вы — отдельный проект на запуск и дальнейшее сопровождение.</p>
        <a href={whatsapp} target="_blank" rel="noreferrer">Обсудить сотрудничество <span aria-hidden="true">↗</span></a>
      </div>
      <div className="integrator-logo-grid" aria-label="Преимущества интегратора RiseStaff">
        <article className="tile-lime"><small>01 · ЗАПУСК</small><h2>Настройте первую программу</h2><p>Возьмите оплату за профиль компании, правила, задания и форму передачи результата.</p><b aria-hidden="true">↗</b></article>
        <article className="tile-dark"><small>02 · ГОТОВЫЙ СЕРВИС</small><h2>Работайте в кабинетах RiseStaff</h2><p>Компания проверяет результаты, агент выполняет задания, а история хранится в одном сервисе.</p><b aria-hidden="true">◎</b></article>
        <article className="tile-blue"><small>03 · ТЕКУЩИЕ УСЛУГИ</small><h2>Дополните CRM и маркетинг</h2><p>Предложите агентскую программу клиентам, которым уже настраиваете продажи или автоматизацию.</p><b aria-hidden="true">✦</b></article>
        <article className="tile-paper"><small>04 · СОПРОВОЖДЕНИЕ</small><h2>Обновляйте программы клиента</h2><p>Добавляйте задания, готовьте материалы и разбирайте результаты вместе с командой.</p><b aria-hidden="true">✓</b></article>
      </div>
    </section>
  </main>;
}

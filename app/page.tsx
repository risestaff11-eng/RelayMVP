import type { Metadata } from "next";
import Link from "next/link";
import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";

export const metadata: Metadata = {
  title: "Партнёрские продажи по одной ссылке",
  description:
    "Relay превращает рекомендации, амбассадоров и внешних продавцов в управляемый канал продаж.",
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  const primaryHref = user ? "/dashboard" : chatGPTSignInPath("/onboarding");
  const primaryLabel = user ? "Открыть кабинет" : "Создать программу";

  return (
    <main className="landing-shell">
      <nav className="landing-nav" aria-label="Основная навигация">
        <Link className="brand" href="/" aria-label="Relay — главная">
          <span className="brand-mark">R</span>
          <span>Relay</span>
        </Link>
        <div className="landing-nav-links">
          <a href="#how">Как работает</a>
          <a href="#missions">Миссии</a>
          <a className="nav-login" href={user ? "/dashboard" : chatGPTSignInPath("/dashboard")}>
            {user ? "Кабинет" : "Войти"}
          </a>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span /> AI-платформа партнёрских продаж</div>
          <h1>Превратите деловые связи в канал продаж.</h1>
          <p className="hero-lead">
            Relay помогает B2B-компаниям запускать партнёрские программы,
            ставить понятные миссии и прозрачно вознаграждать тех, кто приводит результат.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href={primaryHref}>{primaryLabel}<span>↗</span></a>
            <a className="button button-ghost" href="#how">Посмотреть сценарий</a>
          </div>
          <div className="hero-proof">
            <div className="avatar-stack" aria-hidden="true">
              <span>АК</span><span>МИ</span><span>ДВ</span>
            </div>
            <p><strong>10 минут</strong><br />до первой программы</p>
          </div>
        </div>

        <div className="hero-product" aria-label="Пример кабинета Relay">
          <div className="product-topbar">
            <div className="product-brand"><span className="mini-mark">R</span> Relay</div>
            <div className="product-company">Northstar Studio <span>НС</span></div>
          </div>
          <div className="product-body">
            <div className="product-heading">
              <div><span className="micro-label">ПАРТНЁРСКАЯ ПРОГРАММА</span><h2>Выберите свою миссию</h2></div>
              <span className="live-pill">● Активна</span>
            </div>
            <div className="mission-grid" id="missions">
              <article className="mission-card mission-lime">
                <span className="mission-index">01</span><span className="mission-icon">↗</span>
                <div><small>ЛИДЫ</small><h3>Найдите компанию для внедрения CRM</h3><p>30 000 ₸ за встречу</p></div>
              </article>
              <article className="mission-card mission-dark">
                <span className="mission-index">02</span><span className="mission-icon">◎</span>
                <div><small>СДЕЛКИ</small><h3>Познакомьте с руководителем продаж</h3><p>10% от первой оплаты</p></div>
              </article>
              <article className="mission-card mission-blue">
                <span className="mission-index">03</span><span className="mission-icon">✦</span>
                <div><small>ИМИДЖ</small><h3>Поделитесь кейсом в сообществе</h3><p>5 000 ₸ после проверки</p></div>
              </article>
              <article className="mission-card mission-paper">
                <span className="mission-index">04</span><span className="mission-icon">✓</span>
                <div><small>ВОВЛЕЧЕНИЕ</small><h3>Пройдите короткий продуктовый квиз</h3><p>Откройте новые миссии</p></div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="how-strip" id="how" aria-label="Как работает Relay">
        <div><span>01</span><strong>Вставьте сайт</strong><p>ИИ соберёт профиль компании и продуктов.</p></div>
        <div><span>02</span><strong>Подтвердите миссии</strong><p>Настройте результат, награду и сроки.</p></div>
        <div><span>03</span><strong>Отправьте ссылку</strong><p>Партнёры начнут передавать результаты.</p></div>
      </section>
    </main>
  );
}

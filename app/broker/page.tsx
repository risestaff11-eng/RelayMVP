import type { Metadata } from "next";
import { BrokerForm, BrokerDemo } from "./broker-interactions";
import { MarketingAnalytics } from "../marketing-analytics";
import "./broker.css";

const description = "Запустите партнёрскую программу агентства недвижимости: получайте рекомендации покупателей и продавцов, фиксируйте источник клиента и учитывайте вознаграждения в RiseStaff.";
export const metadata: Metadata = {
  title: { absolute: "RiseStaff Broker — клиенты для агентства через рекомендации" },
  description,
  alternates: { canonical: "https://broker.risestaff.kz/" },
  openGraph: { title: "RiseStaff Broker — клиенты для агентства через рекомендации", description, url: "https://broker.risestaff.kz/", siteName: "RiseStaff Broker", locale: "ru_KZ", type: "website", images: [{ url: "https://risestaff.kz/broker-building.jpg", alt: "Современная жилая архитектура" }] },
  twitter: { card: "summary_large_image", title: "RiseStaff для агентств недвижимости", description, images: ["https://risestaff.kz/broker-building.jpg"] },
};

const questions = [
  ["Вы предоставляете базу покупателей?", "Нет. RiseStaff помогает организовать рекомендации от ваших клиентов и партнёров. Вы приглашаете людей из своего окружения и определяете, каких покупателей или продавцов хотите получать. Готовую базу и гарантированное количество сделок мы не обещаем."],
  ["Нужно ли менять нашу CRM?", "Нет. Продажи остаются в вашей CRM. RiseStaff нужен для партнёрской программы: кто порекомендовал клиента, на каких условиях и какое вознаграждение нужно учесть. На демонстрации разберём передачу заявок в ваш текущий процесс."],
  ["Что делать, если клиент уже есть в базе?", "Заранее задайте правило: например, принимать только клиентов, которых ещё нет в активной работе агентства. Менеджер проверяет контакт по своей базе, принимает или отклоняет рекомендацию и указывает причину."],
  ["Когда партнёр получает вознаграждение?", "Условие определяете вы. Например, после закрытия сделки и получения агентской комиссии. RiseStaff позволяет учитывать начисления и отмечать выплаты. Деньги партнёру перечисляет ваше агентство своим способом."],
  ["Сколько стоит подключение?", "Сейчас подключение обсуждаем в пилотном формате. На встрече определим объём запуска и заранее согласуем стоимость платформы и сопровождения. Вознаграждения партнёрам — отдельный бюджет агентства."],
  ["С чего начать, если партнёрской программы ещё нет?", "Выберите один понятный сценарий: например, рекомендации собственников, которые планируют продать квартиру. Подготовьте условия, назначьте ответственного и пригласите первых партнёров. На демонстрации покажем, как это организовать в RiseStaff."],
];

function Arrow() { return <span aria-hidden="true">↗</span>; }

export default function BrokerPage() {
  return <main className="br-site" lang="ru" data-no-translate>
    <MarketingAnalytics />
    <a className="br-skip" href="#broker-main">К содержанию</a>
    <header className="br-header br-container">
      <a href="#broker-main" className="br-brand" aria-label="RiseStaff Broker — главная"><span className="br-mark" aria-hidden="true">r<span>.</span></span><span>RiseStaff<span className="br-brand-sub">ДЛЯ НЕДВИЖИМОСТИ</span></span></a>
      <nav aria-label="Навигация по странице"><a href="#how">Как работает</a><a href="#partners">Для кого</a><a href="#faq">Вопросы</a></nav>
      <a className="br-button br-button-small" href="#request" data-track="application_header">Обсудить запуск <Arrow /></a>
    </header>

    <section className="br-hero br-container" id="broker-main">
      <div className="br-hero-copy"><div className="br-eyebrow"><span className="br-line" /> ПАРТНЁРСКИЕ ПРОДАЖИ В НЕДВИЖИМОСТИ</div>
        <h1>Хорошие связи.<br />Новые клиенты.<br /><span>Ваши сделки.</span></h1>
        <p>Превратите рекомендации клиентов и партнёров в канал продаж вашего агентства. С понятными правилами, учётом заявок и вознаграждений.</p>
        <div className="br-hero-actions"><a className="br-button" href="#request" data-track="hero_primary">Показать на примере агентства <Arrow /></a><a className="br-text-link" href="#demo" data-track="hero_secondary">Как это выглядит <span aria-hidden="true">↓</span></a></div>
        <div className="br-hero-note"><span aria-hidden="true">✓</span> Для агентств недвижимости Казахстана</div>
      </div>
      <div className="br-hero-visual">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="br-building" src="/broker-building.jpg" alt="Современный жилой дом с белыми фасадами и стеклянными балконами" width="1200" height="1400" fetchPriority="high" />
        <div className="br-photo-label">СВЯЗИ, КОТОРЫЕ СТАНОВЯТСЯ ВОЗМОЖНОСТЯМИ</div>
        <div className="br-floating-card"><div className="br-card-head"><span className="br-avatar">АК</span><div><b>Новая рекомендация</b><span>от вашего партнёра</span></div><span className="br-card-icon" aria-hidden="true">↗</span></div><div className="br-card-property"><span>ПОКУПКА КВАРТИРЫ</span><b>Ищет 2-комнатную в Алматы</b></div><div className="br-card-bottom"><span>Готов к разговору с агентом</span><span className="br-pill">Новая</span></div><small>Иллюстрация сценария</small></div>
        <span className="br-visual-index">01 / ОТ ЗНАКОМСТВА К СДЕЛКЕ</span>
      </div>
    </section>

    <div className="br-principles br-container"><div><span>01</span><b>Ваши партнёры</b><p>Клиенты и люди, которые вам доверяют</p></div><div><span>02</span><b>Ваши условия</b><p>Вы решаете, за какой результат платить</p></div><div><span>03</span><b>Всё под контролем</b><p>Источник клиента, статус и вознаграждение</p></div></div>

    <section className="br-section br-container" id="partners"><div className="br-section-top"><div><div className="br-eyebrow">ВАШ СЛЕДУЮЩИЙ КАНАЛ ПРОДАЖ</div><h2>Клиенты ближе,<br />чем кажется.</h2></div><p>Рекомендации уже есть вокруг вашего агентства. Дайте людям понятный повод и простой способ передать вам клиента.</p></div>
      <div className="br-partner-grid">{[
        ["01", "Довольные клиенты", "Помогли купить квартиру? Пригласите клиента рекомендовать вас друзьям и коллегам.", "ЛИЧНЫЙ ОПЫТ → ДОВЕРИЕ"],
        ["02", "Партнёры по сделкам", "Ипотечные консультанты, дизайнеры и ремонтные команды встречают людей с жилищными планами.", "ОБЩАЯ АУДИТОРИЯ → КОНТАКТ"],
        ["03", "Ваш профессиональный круг", "Коллеги и знакомые могут знать собственника, который собирается продавать недвижимость.", "НУЖНЫЙ МОМЕНТ → РЕКОМЕНДАЦИЯ"],
      ].map(([n,title,body,tag])=><article className="br-partner-card" key={n}><span className="br-card-number">{n}</span><h3>{title}</h3><p>{body}</p><span className="br-card-tag">{tag}</span></article>)}</div>
    </section>

    <section className="br-dark" id="how"><div className="br-container br-section"><div className="br-section-top"><div><div className="br-eyebrow">ПРОСТОЙ ПРОЦЕСС. ПОНЯТНАЯ ОТВЕТСТВЕННОСТЬ.</div><h2>От «есть знакомый»<br />до учтённой выплаты.</h2></div><p>Без поиска договорённостей в переписках. У каждой рекомендации — источник, условия и следующий шаг.</p></div>
      <div className="br-steps">{[
        ["01", "Задайте правила", "Кого ищете, какие контакты принимаете и когда начисляете вознаграждение."],
        ["02", "Пригласите партнёров", "Поделитесь ссылкой на программу. Условия и отправка рекомендации доступны в браузере."],
        ["03", "Примите клиента", "Проверьте контакт, назначьте ответственного и ведите продажу в привычном процессе."],
        ["04", "Учтите результат", "Обновите статус, начислите награду по вашим правилам и отметьте выплату партнёру."],
      ].map(([n,t,p])=><article key={n}><span>{n}</span><h3>{t}</h3><p>{p}</p></article>)}</div>
      <div className="br-dark-bottom"><span>RiseStaff дополняет работу агентства и вашу CRM.</span><a href="#request" className="br-text-link">Разобрать мой процесс <Arrow /></a></div>
    </div></section>

    <section className="br-section br-container br-demo-section" id="demo"><div className="br-demo-copy"><div className="br-eyebrow">ВИДНО ОБЕИМ СТОРОНАМ</div><h2>Рекомендация<br />не теряется<br /><span>в переписке.</span></h2><p>Менеджер видит, от кого пришёл клиент. Партнёр понимает, что происходит с рекомендацией. Вы контролируете обязательства агентства.</p><ul className="br-check-list"><li>Кто и когда передал контакт</li><li>На каком этапе работа с клиентом</li><li>За что начислено вознаграждение</li></ul><p className="br-caption">Справа — интерактивный пример процесса, а не данные действующего агентства.</p></div><BrokerDemo /></section>

    <section className="br-offer br-container"><div><div className="br-eyebrow">НАЧНИТЕ С ОДНОГО СЦЕНАРИЯ</div><h2>Сначала понятный запуск.<br />Потом — масштабирование.</h2><p>Выберите, кого привлекать первым: покупателей, продавцов или собственников для аренды. Проверьте канал на небольшой группе ваших партнёров.</p></div><div className="br-offer-list"><div><span>01</span> Определим подходящего клиента</div><div><span>02</span> Обсудим условия вознаграждения</div><div><span>03</span> Покажем путь заявки в RiseStaff</div><a className="br-button" href="#request" data-track="offer_primary">Обсудить пилот <Arrow /></a><p>Стоимость и объём запуска согласуем заранее.</p></div></section>

    <section className="br-section br-container br-faq" id="faq"><div><div className="br-eyebrow">БЕЗ МЕЛКОГО ШРИФТА</div><h2>До первого<br />запуска.</h2><a className="br-text-link" href="https://wa.me/77765086000?text=Здравствуйте!%20Хочу%20обсудить%20RiseStaff%20для%20агентства%20недвижимости." target="_blank" rel="noopener noreferrer">Задать вопрос в WhatsApp <Arrow /></a></div><div>{questions.map(([q,a])=><details key={q}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>)}</div></section>

    <section className="br-contact" id="request"><div className="br-container br-contact-grid"><div><div className="br-eyebrow">RISESTAFF × ВАШЕ АГЕНТСТВО</div><h2>Давайте превратим<br />ваши связи<br /><span>в новый канал.</span></h2><p>Оставьте контакты — обсудим задачу агентства и покажем, как может работать ваша партнёрская программа.</p><a href="https://wa.me/77765086000?text=Здравствуйте!%20Хочу%20демонстрацию%20RiseStaff%20для%20агентства%20недвижимости." className="br-text-link" target="_blank" rel="noopener noreferrer">Или напишите нам в WhatsApp <Arrow /></a></div><BrokerForm /></div></section>
    <footer className="br-footer br-container"><a className="br-brand" href="https://risestaff.kz"><span className="br-mark" aria-hidden="true">r<span>.</span></span><span>RiseStaff</span></a><p>Партнёрские рекомендации для недвижимости.</p><a href="https://risestaff.kz/legal/privacy">Конфиденциальность</a><span>© {new Date().getFullYear()} RiseStaff</span></footer>
    <a className="br-mobile-cta br-button" href="#request" data-track="mobile_sticky">Обсудить запуск <Arrow /></a>
  </main>;
}

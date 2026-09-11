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
  return <main className="br-site br-premium" lang="ru" data-no-translate>
    <MarketingAnalytics />
    <a className="br-skip" href="#broker-main">К содержанию</a>
    <div className="br-opening">
      <header className="br-header br-container">
        <a href="#broker-main" className="br-brand" aria-label="RiseStaff Broker — главная">RiseStaff<span>Broker</span></a>
        <nav aria-label="Навигация по странице"><a href="#problems">Задачи агентства</a><a href="#demo">Как работает</a><a href="#faq">Условия</a></nav>
        <a className="br-header-link" href="#request" data-track="application_header">Запросить демонстрацию <Arrow /></a>
      </header>
      <section className="br-hero br-container" id="broker-main">
        <div className="br-hero-copy">
          <p className="br-eyebrow">ДЛЯ СОБСТВЕННИКОВ АГЕНТСТВ НЕДВИЖИМОСТИ</p>
          <h1>Сделку закрыли.<br />А кто приведёт<br /><em>следующего клиента?</em></h1>
          <p className="br-hero-description">Дайте бывшим клиентам и партнёрам повод рекомендовать ваше агентство. RiseStaff фиксирует, кто привёл покупателя или собственника, что стало с заявкой и кому положена выплата.</p>
          <div className="br-hero-actions"><a className="br-button" href="#request" data-track="hero_primary">Посмотреть RiseStaff <Arrow /></a><a className="br-text-link" href="#problems" data-track="hero_secondary">Задачи агентства ↓</a></div>
        </div>
        <figure className="br-hero-visual">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="br-building" src="/broker-building.jpg" alt="Белый фасад жилого дома со стеклянными балконами" width="1600" height="2400" fetchPriority="high" />
          <figcaption><span>RISESTAFF / НЕДВИЖИМОСТЬ</span><span>Казахстан</span></figcaption>
        </figure>
      </section>
      <div className="br-intro-strip br-container"><span>Управление рекомендациями</span><p>Покупатели · Собственники · Партнёры агентства</p><a href="#demo">Посмотреть пример <Arrow /></a></div>
    </div>

    <section className="br-section br-container br-pains" id="problems">
      <div className="br-section-heading"><p className="br-eyebrow">ЗНАКОМО СОБСТВЕННИКУ АГЕНТСТВА</p><h2>Когда рекомендации<br />остаются<br /><em>в переписках.</em></h2><p className="br-lead">Если контакты хранятся в личных сообщениях риелторов, руководителю приходится выяснять судьбу каждой заявки отдельно.</p></div>
      <div className="br-pain-list">{[
        ["01", "Каждый месяц нужен новый бюджет на заявки", "Если обращения идут только из платной рекламы, следующий месяц снова начинается с покупки заявок. При этом база клиентов после закрытых сделок может годами не использоваться.", "Пригласите этих клиентов в программу рекомендаций: объясните, кого ищете и за какой результат готовы платить."],
        ["02", "«Я скинул вам номер. Вы ему позвонили?»", "Контакт отправили в WhatsApp. Сообщение ушло вверх, ответственный не назначен, партнёр снова спрашивает о клиенте.", "Принимайте рекомендации через одну форму. Сохраняйте автора и обновляйте статус заявки в RiseStaff."],
        ["03", "Один клиент. Два претендента на комиссию", "Партнёр считает клиента своим, а риелтор говорит, что уже работал с ним. Договорённость приходится восстанавливать по переписке.", "Фиксируйте источник и условия при передаче контакта. Перед принятием менеджер проверяет клиента по базе агентства."],
        ["04", "Партнёр привёл клиента — и остался без ответа", "Он не знает, состоялась ли сделка и будет ли выплата. Прежде чем рекомендовать следующего человека, ему придётся напомнить о себе.", "Показывайте статус рекомендации и учитывайте начисления. После перевода отмечайте выплату в кабинете."],
      ].map(([n,title,pain,solution])=><article className="br-pain" key={n}><span className="br-number">{n}</span><div><h3>{title}</h3><p>{pain}</p><div className="br-resolution"><span>С RISESTAFF</span><p>{solution}</p></div></div></article>)}</div>
    </section>

    <section className="br-control" id="demo"><div className="br-container br-section br-demo-section">
      <div className="br-demo-copy"><p className="br-eyebrow">УЧЁТ РЕКОМЕНДАЦИЙ</p><h2>Кто привёл.<br />Что с клиентом.<br /><em>Сколько должны.</em></h2><p>Три вопроса, на которые руководитель должен получать ответ без звонков каждому риелтору.</p><dl className="br-control-list"><div><dt>Источник</dt><dd>Клиент закреплён за автором рекомендации.</dd></div><div><dt>Работа</dt><dd>Менеджер обновляет статус по мере работы с клиентом.</dd></div><div><dt>Деньги</dt><dd>Вознаграждение учитывается по условиям агентства.</dd></div></dl><p className="br-caption">Переключите этапы в примере. Имена и сумма условные.</p></div>
      <BrokerDemo />
    </div></section>

    <section className="br-section br-container" id="how">
      <div className="br-section-top"><div><p className="br-eyebrow">ЗАПУСК В АГЕНТСТВЕ</p><h2>Начните с тех,<br /><em>кто уже вас знает.</em></h2></div><p>Не нужно искать сотни партнёров. Для первого запуска выберите одну группу: бывших клиентов, ипотечных консультантов или коллег по рынку.</p></div>
      <div className="br-launch-grid">{[
        ["01", "Определите, кого привлекать", "Например, собственников, которые хотят продать квартиру. Укажите город, тип объекта и требования к контакту."],
        ["02", "Зафиксируйте условия", "Размер вознаграждения, момент начисления, правила для повторных клиентов. Партнёр видит их до отправки заявки."],
        ["03", "Пригласите и обработайте заявки", "Отправьте ссылку на программу. Назначьте сотрудника, который проверяет рекомендации и обновляет их статусы."],
      ].map(([n,t,p])=><article key={n}><span className="br-number">{n}</span><h3>{t}</h3><p>{p}</p></article>)}</div>
      <div className="br-crm-note"><b>Продажи остаются в вашей CRM.</b><p>RiseStaff ведёт партнёрскую программу. Способ передачи заявок в текущий процесс агентства обсудим на демонстрации.</p><a href="#request" className="br-text-link" data-track="offer_primary">Обсудить подключение <Arrow /></a></div>
    </section>

    <section className="br-section br-container br-faq" id="faq"><div><p className="br-eyebrow">УСЛОВИЯ РАБОТЫ</p><h2>Что нужно знать<br /><em>до подключения.</em></h2><a className="br-text-link" href="https://wa.me/77765086000?text=Здравствуйте!%20Хочу%20обсудить%20RiseStaff%20для%20агентства%20недвижимости." target="_blank" rel="noopener noreferrer">Спросить в WhatsApp <Arrow /></a></div><div>{questions.map(([q,a])=><details key={q}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>)}</div></section>

    <section className="br-contact" id="request"><div className="br-container br-contact-grid"><div><p className="br-eyebrow">ДЕМОНСТРАЦИЯ ДЛЯ ВАШЕГО АГЕНТСТВА</p><h2>Как сейчас<br />к вам приходят<br /><em>рекомендации?</em></h2><p>Разберём, где вы получаете контакты, кто их обрабатывает и как рассчитываетесь с партнёрами. Покажем этот процесс в RiseStaff и назовём стоимость подключения.</p><a href="https://wa.me/77765086000?text=Здравствуйте!%20Хочу%20демонстрацию%20RiseStaff%20для%20агентства%20недвижимости." className="br-text-link" target="_blank" rel="noopener noreferrer">Написать напрямую в WhatsApp <Arrow /></a></div><BrokerForm /></div></section>
    <footer className="br-footer"><div className="br-container"><a className="br-brand" href="https://risestaff.kz">RiseStaff<span>Broker</span></a><p>Программы рекомендаций для агентств недвижимости.</p><a href="https://risestaff.kz/legal/privacy">Конфиденциальность</a><span>© {new Date().getFullYear()} RiseStaff</span></div></footer>
    <a className="br-mobile-cta br-button" href="#request" data-track="mobile_sticky">Запросить демонстрацию <Arrow /></a>
  </main>;
}

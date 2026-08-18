import type { Metadata } from "next";
import { SafeLink as Link } from "@/app/safe-link";
import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";
import { MarketingAnalytics } from "./marketing-analytics";
import { MarketingLogo } from "./marketing-logo";
import { companyUrl } from "../lib/public-origins";

export const metadata: Metadata = {
  title: { absolute: "Relay — агентские продажи и реферальные программы" },
  description: "Запустите агентскую программу: создайте задания, пригласите агентов по одной ссылке и отслеживайте каждую рекомендацию до выплаты.",
  alternates: { canonical: "https://risestaff.kz/" },
};

export const dynamic = "force-dynamic";

const missionCards = [
  { index: "01", type: "ЛИДЫ", title: "Найдите компанию для внедрения CRM", reward: "30 000 ₸ за встречу", icon: "↗", tone: "lime" },
  { index: "02", type: "СДЕЛКИ", title: "Приведите клиента до первой сделки", reward: "10% от первой оплаты", icon: "◎", tone: "dark" },
  { index: "03", type: "ИМИДЖ", title: "Поделитесь кейсом в сообществе", reward: "5 000 ₸ после проверки", icon: "✦", tone: "blue" },
  { index: "04", type: "ВОВЛЕЧЕНИЕ", title: "Пройдите продуктовый квиз", reward: "Откройте новые задания", icon: "✓", tone: "paper" },
];

const faqs = [
  ["Relay — это агентская или реферальная программа?", "И то и другое. Компания сама определяет результат: квалифицированный лид, встреча, сделка, имиджевая публикация или полезное действие. Relay фиксирует правила и ведёт результат до выплаты."],
  ["Где искать агентов?", "Начните с тех, кто уже знает ваш продукт и аудиторию: клиентов, партнёров, консультантов, интеграторов, экспертов и знакомых команды. Relay не является биржей агентов — он помогает организовать работу с вашей сетью рекомендаций."],
  ["Нужно ли агенту устанавливать приложение?", "Нет. Он открывает публичную ссылку, указывает email, выбирает задание и передаёт результат в браузере. Отдельное приложение не требуется."],
  ["Как компания защищается от нецелевых лидов?", "В каждом задании заранее задаются критерии подходящего клиента, подтверждения результата, срок проверки и причины отказа. Компания принимает только то, что соответствует правилам."],
  ["Как агент понимает, что его лид не присвоили?", "Relay фиксирует владельца и дату передачи, предупреждает о дублях и сохраняет историю статусов и комментариев. Агент видит путь рекомендации до начисления и выплаты."],
  ["Relay сам выплачивает вознаграждения?", "На текущем этапе компания проводит выплату самостоятельно, а в Relay подтверждает сумму, основание, плановую дату и факт выплаты."],
  ["Где здесь используется ИИ?", "Только как ускоритель настройки: он анализирует открытые страницы сайта, собирает черновик профиля компании и предлагает задания. Компания редактирует и обязательно подтверждает результат перед публикацией."],
  ["Что входит в бесплатный ранний доступ?", "Можно создавать программы без ограничения, использовать кабинеты компании и агента и получить 5 000 AI-кредитов для настройки. Банковская карта не нужна. После регистрации мы проверим заявку и активируем кабинет."],
];

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite", "@id": "https://risestaff.kz/#website", url: "https://risestaff.kz/", name: "Relay",
      alternateName: ["RiseStaff", "Relay by RiseStaff"], inLanguage: "ru-KZ",
      publisher: { "@id": "https://risestaff.kz/#organization" },
    },
    {
      "@type": "Organization", "@id": "https://risestaff.kz/#organization", name: "Relay", alternateName: "RiseStaff",
      url: "https://risestaff.kz/", logo: { "@type": "ImageObject", url: "https://risestaff.kz/icon-512.png", width: 512, height: 512 },
    },
    {
      "@type": "SoftwareApplication", "@id": "https://risestaff.kz/#software", name: "Relay", url: "https://risestaff.kz/",
      applicationCategory: "BusinessApplication", operatingSystem: "Web", inLanguage: "ru-KZ",
      description: "Платформа для запуска и управления агентскими и реферальными программами по одной ссылке.",
      featureList: ["Программы и задания для агентов", "Фиксация владельца рекомендации", "Статусы результатов и выплат", "Кабинет агента без установки приложения"],
      provider: { "@id": "https://risestaff.kz/#organization" },
    },
  ],
};

export default async function Home() {
  const user = await getChatGPTUser();
  const dashboardHref = companyUrl(user ? "/dashboard" : chatGPTSignInPath("/onboarding"));
  const loginHref = companyUrl(user ? "/dashboard" : chatGPTSignInPath("/dashboard"));
  const whatsappHref = "https://wa.me/77765086000?text=%D0%A0%D1%83%D1%81%2C%20%D0%B7%D0%B4%D1%80%D0%B0%D0%B2%D1%81%D1%82%D0%B2%D1%83%D0%B9%D1%82%D0%B5!%20%D0%A5%D0%BE%D1%87%D1%83%20%D0%BE%D0%B1%D1%81%D1%83%D0%B4%D0%B8%D1%82%D1%8C%20Relay";

  return <main className="lp-shell">
    <MarketingAnalytics />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    <a className="skip-link" href="#main-content">К основному содержанию</a>
    <header className="lp-header">
      <Link className="lp-brand" href="/" aria-label="Relay — главная"><MarketingLogo /><span>Relay</span></Link>
      <nav className="lp-nav" aria-label="Основная навигация"><a href="#product">Продукт</a><a href="#how">Как работает</a><a href="#offer">Условия</a><Link href="/integrators">Интеграторам</Link><a href="#faq">FAQ</a></nav>
      <div className="lp-header-actions"><a className="lp-login" href={loginHref} data-track="header_primary">{user ? "Открыть кабинет" : "Создать программу"}</a><a className="lp-nav-cta lp-whatsapp-cta" href={whatsappHref} target="_blank" rel="noreferrer" data-track="whatsapp_header"><span className="lp-whatsapp-icon" aria-hidden="true" />Задать вопрос</a></div>
    </header>

    <section className="lp-hero" id="main-content">
      <div className="lp-orbit lp-orbit-one" aria-hidden="true" /><div className="lp-orbit lp-orbit-two" aria-hidden="true" />
      <div className="lp-hero-copy">
        <div className="lp-kicker"><span>●</span> ПЛАТФОРМА АГЕНТСКИХ ПРОДАЖ ДЛЯ РАСТУЩИХ КОМПАНИЙ</div>
        <h1>Запустите <span className="lp-color-word">агентский канал</span> и отслеживайте каждого клиента до выплаты.</h1>
        <p>Создайте задания, укажите вознаграждение и отправьте агентам одну ссылку. Relay закрепит автора рекомендации, покажет статус результата и поможет вести выплаты без таблиц и переписок.</p>
        <div className="lp-mobile-audience" aria-label="Для кого и какую задачу решает Relay"><span><b>ДЛЯ КОГО</b>Владельцы и руководители продаж</span><span><b>ВМЕСТО ЧЕГО</b>Чаты, таблицы и ручная сверка</span></div>
        <div className="lp-hero-actions"><a className="lp-primary" href={dashboardHref} data-track="hero_primary">{user ? "Открыть кабинет" : "Создать первую программу бесплатно"}<span>↗</span></a><a className="lp-secondary" href="#product" data-track="hero_secondary">Посмотреть продукт <span>↓</span></a></div>
        <p className="lp-cta-note">Без банковской карты · агентам не нужно приложение · заявку проверяем перед активацией</p>
        <div className="lp-hero-facts"><span><b>1</b> ссылка для агентов</span><span><b>0</b> новых приложений</span><span><b>100%</b> истории результата</span></div>
      </div>
      <div className="lp-demo" aria-label="Пример страницы заданий Relay">
        <div className="lp-demo-top"><div><MarketingLogo /><b>Relay</b></div><span>ПРОГРАММА АКТИВНА <i>●</i></span></div>
        <div className="lp-demo-heading"><div><small>ПРОГРАММА ДЛЯ АГЕНТОВ</small><h2>Выберите задание</h2></div><span>4 ЗАДАНИЯ</span></div>
        <div className="lp-mission-grid">{missionCards.map((card) => <article className={`lp-mission lp-${card.tone}`} key={card.index}><div><small>{card.index}</small><b>{card.icon}</b></div><span>{card.type}</span><h3>{card.title}</h3><p>{card.reward}</p></article>)}</div>
        <div className="lp-demo-event"><i>✓</i><div><strong>Новый лид закреплён за агентом</strong><span>Статус и история доступны обеим сторонам</span></div><b>сейчас</b></div>
      </div>
    </section>

    <section className="lp-trust-line" aria-label="Ключевые свойства"><div className="lp-marquee-track">{[0, 1].map((copy) => <div className="lp-marquee-set" aria-hidden={copy === 1} key={copy}><span><b>01</b>Понятные условия</span><span><b>02</b>Защита владельца лида</span><span><b>03</b>Прозрачные выплаты</span><span><b>04</b>Быстрый запуск</span></div>)}</div></section>
    <section className="lp-pilot-proof" aria-label="Фактические показатели пилота Relay"><div><span>ТЕКУЩИЙ ПИЛОТ RELAY</span><p>Фактические показатели рабочего кабинета, показанного ниже.</p></div><dl><div><dt>1</dt><dd>активная программа</dd></div><div><dt>14</dt><dd>подключённых агентов</dd></div><div><dt>6</dt><dd>переданных результатов</dd></div><div><dt>3</dt><dd>ожидают проверки</dd></div></dl></section>

    <section className="lp-problem lp-section"><i className="lp-motion-orbit orbit-black" aria-hidden="true" />
      <div className="lp-section-intro"><span>БЫЛО → СТАЛО</span><h2>Сарафанное радио работает. Но им невозможно управлять.</h2><p>Знакомые могут рекомендовать вас уже сегодня. Проблема начинается, когда нужно объяснить предложение, закрепить лид, проверить результат и честно рассчитать вознаграждение.</p></div>
      <div className="lp-compare"><article className="lp-before"><small>БЕЗ RELAY</small><h3>Рекомендации теряются в переписках</h3><ul><li>Условия каждый понимает по-своему</li><li>Лиды приходят в чат, почту и таблицы</li><li>Агент не знает, что стало со сделкой</li><li>Выплаты приходится сверять вручную</li></ul><strong>Итог: канал не масштабируется</strong></article><article className="lp-after"><small>С RELAY</small><h3>У каждого результата есть правила и владелец</h3><ul><li>Задание объясняет, кого искать и что передать</li><li>Одна ссылка собирает агентов и лиды</li><li>Статусы и комментарии видны в кабинете</li><li>Начисления связаны с конкретным результатом</li></ul><strong>Итог: рекомендации становятся процессом</strong></article></div>
    </section>

    <section className="lp-ai lp-section" id="product"><i className="lp-motion-orbit orbit-gray" aria-hidden="true" />
      <figure className="lp-ai-visual lp-live-screen"><div className="lp-live-screen-label"><span>РЕАЛЬНЫЙ КАБИНЕТ КОМПАНИИ</span><b>Рабочий стол Relay</b></div><div className="lp-screen-wrap"><img src="/company-cabinet.png?v=20260818" width="1440" height="900" loading="lazy" alt="Рабочий стол компании в Relay с программами, агентами, результатами и выплатами" /><div className="lp-screen-callouts" aria-hidden="true"><span>14 агентов</span><span>6 результатов</span><span>Статусы и выплаты</span></div></div></figure>
      <div className="lp-ai-copy"><span>ВСЁ ПОД КОНТРОЛЕМ</span><h2>Управляйте каналом с одного экрана.</h2><p>На рабочем столе собраны программы, агенты, переданные результаты, выплаты и следующие действия. Руководитель сразу видит состояние канала и понимает, на чём сосредоточиться.</p><ul><li>Показывает активные программы и агентов</li><li>Собирает результаты и выплаты в одном месте</li><li>Подсказывает следующий шаг для запуска</li></ul><small>Это реальный экран кабинета компании Relay.</small></div>
    </section>

    <section className="lp-how lp-section" id="how"><div className="lp-section-intro light"><span>КАК ЭТО РАБОТАЕТ</span><h2>От идеи до первой ссылки для агентов — четыре шага.</h2></div><span className="lp-swipe-hint">Листайте шаги →</span><div className="lp-steps">
      <article><b>01</b><div className="lp-step-visual lp-step-program" aria-hidden="true"><div className="lp-step-window"><span><i /><i /><i /></span><small>НОВАЯ ПРОГРАММА</small><strong>Новые клиенты</strong><em>Создать&nbsp; +</em></div></div><small>НЕСКОЛЬКО МИНУТ</small><h3>Создайте программу</h3><p>Опишите продукт, целевого клиента и результат, за который готовы платить.</p></article>
      <article><b>02</b><div className="lp-step-visual lp-step-tasks" aria-hidden="true"><div><span>01</span><strong>Найти клиента</strong><em>15 000 ₸</em></div><div><span>02</span><strong>Закрыть сделку</strong><em>15%</em></div></div><small>ПРАВИЛА ЗАФИКСИРОВАНЫ</small><h3>Соберите задания</h3><p>Добавьте награду, срок, критерии проверки и материалы для знакомства.</p></article>
      <article><b>03</b><div className="lp-step-visual lp-step-invite" aria-hidden="true"><div className="lp-step-link"><span>risestaff.kz/p/...</span><b>↗</b></div><div className="lp-step-avatars"><i>А</i><i>Б</i><i>К</i><em>+12 агентов</em></div></div><small>ОДНА ВНЕШНЯЯ ССЫЛКА</small><h3>Пригласите агентов</h3><p>Агент входит по email, выбирает задание и передаёт подходящий результат.</p></article>
      <article><b>04</b><div className="lp-step-visual lp-step-result" aria-hidden="true"><div><span>Получен</span><i /><span>Проверен</span><i /><span>Оплачен</span></div><strong>15 000 ₸</strong><small>ВОЗНАГРАЖДЕНИЕ</small></div><small>ПРОЗРАЧНАЯ ВОРОНКА</small><h3>Проверяйте и платите</h3><p>Меняйте статусы, объясняйте решения и фиксируйте начисления без ручной сверки.</p></article>
    </div></section>

    <section className="lp-partner lp-section" id="partners"><i className="lp-motion-orbit orbit-lime" aria-hidden="true" />
      <div className="lp-partner-copy"><span>ПОЧЕМУ АГЕНТ ВЕРНЁТСЯ</span><h2>Условия, статус и выплата — всегда перед глазами.</h2><p>Агент сразу видит доступные задания и движение каждой рекомендации до получения денег.</p><ul className="lp-agent-benefits"><li>Понятно, что именно нужно сделать</li><li>Видно, кто и когда передал результат</li><li>Есть история проверки и начисления</li></ul></div>
      <figure className="lp-partner-card lp-live-screen lp-agent-live-screen"><div className="lp-live-screen-label"><span>РЕАЛЬНЫЙ КАБИНЕТ АГЕНТА</span><b>Доступные задания</b></div><div className="lp-screen-wrap"><img src="/agent-cabinet.png?v=20260818" width="1440" height="900" loading="lazy" alt="Кабинет агента Relay с доступными заданиями и условиями вознаграждения" /><div className="lp-screen-callouts agent" aria-hidden="true"><span>Задания</span><span>Условия награды</span><span>Статус рекомендации</span></div></div></figure>
    </section>

    <section className="lp-agent-sources lp-section"><div className="lp-section-intro"><span>ГДЕ ВЗЯТЬ ПЕРВЫХ АГЕНТОВ</span><h2>Они уже рядом с вашим бизнесом.</h2><p>Начните с людей, которые знают ваш продукт и могут сделать тёплую рекомендацию.</p></div><div className="lp-source-grid"><article><b>01</b><h3>Клиенты</h3><p>Довольные покупатели, готовые познакомить вас с коллегами.</p></article><article><b>02</b><h3>Партнёры</h3><p>Интеграторы и подрядчики с похожей целевой аудиторией.</p></article><article><b>03</b><h3>Эксперты</h3><p>Консультанты и лидеры сообществ, которым доверяют.</p></article><article><b>04</b><h3>Команда</h3><p>Сотрудники и знакомые, которые понимают ценность продукта.</p></article></div><p className="lp-marketplace-note"><strong>Важно:</strong> Relay не является биржей агентов. Сервис организует работу с вашей сетью рекомендаций и делает правила прозрачными для обеих сторон.</p></section>

    <section className="lp-audience lp-section"><div className="lp-section-intro"><span>КОМУ ПОДХОДИТ</span><h2>Тем, у кого покупают через доверие и рекомендации.</h2></div><span className="lp-swipe-hint">Листайте сценарии →</span><div className="lp-audience-grid">
      <article><b>01</b><div className="lp-role-visual lp-role-sales" aria-hidden="true"><div><span>АГЕНТЫ</span><strong>14</strong><i>в текущем пилоте</i></div><div><span>РЕЗУЛЬТАТЫ</span><strong>6</strong><i>3 на проверке</i></div><footer><em /><em /><em /><em /></footer></div><h3>Руководителю продаж</h3><p>Подключить внешних продавцов и видеть вклад каждого без новой CRM.</p></article>
      <article><b>02</b><div className="lp-role-visual lp-role-marketing" aria-hidden="true"><header><span>КАМПАНИЯ</span><i>● активна</i></header><strong>Амбассадоры бренда</strong><div><span>единые правила</span><span>видимые статусы</span></div><footer><i /><i /><i /><i /><i /></footer></div><h3>Руководителю маркетинга</h3><p>Запустить амбассадорские и имиджевые задания с понятной проверкой.</p></article>
      <article><b>03</b><div className="lp-role-visual lp-role-founder" aria-hidden="true"><header><span>АГЕНТСКИЙ КАНАЛ</span><strong>1 ссылка</strong></header><div className="lp-role-bars"><i /><i /><i /><i /><i /><i /></div><footer><span>ПРОГРАММЫ</span><span>АГЕНТЫ</span></footer></div><h3>Основателю компании</h3><p>Превратить сеть знакомых, клиентов и экспертов в повторяемый канал.</p></article>
    </div></section>

    <section className="lp-offer lp-section" id="offer"><div className="lp-offer-copy"><span>БЕСПЛАТНЫЙ РАННИЙ ДОСТУП</span><h2>Проверьте агентский канал на реальном продукте.</h2><p>Начните без банковской карты. После регистрации мы проверим заявку, активируем кабинет и поможем дойти до первой программы.</p><ul><li>Программы без ограничений во время бета-тестирования</li><li>Кабинеты компании и агентов</li><li>5 000 AI-кредитов для настройки</li><li>Фиксация результатов, статусов и выплат</li></ul><div className="lp-offer-actions"><a className="lp-primary" href={dashboardHref} data-track="offer_primary">{user ? "Перейти к программам" : "Создать первую программу бесплатно"}<span>↗</span></a><Link href="/pricing" data-track="pricing_link">Подробнее об условиях →</Link></div></div><ol className="lp-offer-steps"><li><b>01</b><span><strong>Зарегистрируйтесь</strong>Оставьте данные компании.</span></li><li><b>02</b><span><strong>Дождитесь активации</strong>Мы проверим заявку и откроем кабинет.</span></li><li><b>03</b><span><strong>Создайте программу</strong>Зафиксируйте задания и награды.</span></li><li><b>04</b><span><strong>Отправьте ссылку</strong>Пригласите первых агентов.</span></li></ol></section>

    <section className="lp-faq lp-section" id="faq"><div className="lp-section-intro"><span>FAQ</span><h2>Вопросы до запуска.</h2></div><div className="lp-faq-list">{faqs.map(([question, answer], index) => <details key={question}><summary><span>{String(index + 1).padStart(2, "0")}</span><strong>{question}</strong><i>+</i></summary><p>{answer}</p></details>)}</div></section>
    <section className="lp-final"><div className="lp-final-tiles" aria-hidden="true">{missionCards.map((card) => <i className={`lp-${card.tone}`} key={card.index}>{card.icon}</i>)}</div><span>ПЕРВАЯ ПРОГРАММА НАЧИНАЕТСЯ С ОДНОЙ ССЫЛКИ</span><h2>Дайте агентам понятный повод рекомендовать вас.</h2><p>Создайте программу бесплатно. Банковская карта не нужна, а агентам не придётся устанавливать приложение.</p><a className="lp-primary" href={dashboardHref} data-track="final_primary">{user ? "Открыть кабинет" : "Создать первую программу бесплатно"}<span>↗</span></a></section>
    <a className="lp-mobile-sticky-cta" href={dashboardHref} data-track="mobile_sticky">{user ? "Открыть кабинет" : "Начать бесплатно"}<span>↗</span></a>
    <footer className="lp-footer"><div><Link className="lp-brand" href="/"><MarketingLogo /><span>Relay</span></Link><p>Агентские продажи по одной ссылке.<br />Казахстан · <a href={whatsappHref} target="_blank" rel="noreferrer">WhatsApp +7 776 508 6000</a></p></div><nav><a href="#product">Продукт</a><a href="#offer">Условия</a><Link href="/integrators">Интеграторам</Link><a href="#faq">FAQ</a><Link href="/legal/privacy">Конфиденциальность</Link><Link href="/legal/license">Соглашение</Link></nav><span>© 2026 Relay</span></footer>
  </main>;
}

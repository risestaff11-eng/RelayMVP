import type { Metadata } from "next";
import { SafeLink as Link } from "@/app/safe-link";
import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";
import { MarketingAnalytics } from "./marketing-analytics";
import { MarketingLogo } from "./marketing-logo";
import { MarketingSpecialOffer } from "./marketing-special-offer";
import { companyUrl } from "../lib/public-origins";

export const metadata: Metadata = {
  title: { absolute: "Yaler — продажи через агентов и амбассадоров" },
  description: "Создавайте задания для внешних агентов, получайте новых клиентов по одной ссылке и отслеживайте каждый результат до выплаты.",
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
  ["Что такое Yaler?", "Yaler — сервис для компаний, которые продают через рекомендации. Компания публикует задания и награды, агенты передают лиды или другие результаты, а обе стороны видят статус и сумму вознаграждения."],
  ["Кому подходит Yaler?", "Собственникам, руководителям продаж и маркетинга. Особенно тем, у кого клиенты, партнёры, консультанты или отраслевые эксперты уже готовы рекомендовать продукт."],
  ["Кто может стать агентом?", "Клиент, партнёр, консультант, сотрудник или знакомый, у которого есть контакт с вашей целевой аудиторией. Вы сами решаете, кого пригласить и какие задания ему показать."],
  ["Где найти первых агентов?", "Пригласите людей, которые уже знают ваш продукт: действующих клиентов, партнёров, экспертов и сотрудников. Yaler не является биржей амбассадоров и не подбирает агентов за компанию."],
  ["Что увидит агент по ссылке?", "Описание компании, доступные задания, критерии результата, размер награды и срок проверки. Агент выбирает задание, передаёт результат и затем следит за его статусом."],
  ["Какие задания можно создать?", "Четыре типа: поиск людей и лидов, помощь со сделкой, имиджевые публикации и вовлекающие действия. Для каждого задания компания задаёт свои поля, подтверждения и награду."],
  ["Как Yaler фиксирует лид?", "Сервис сохраняет агента, дату передачи, контакт, комментарии и историю статусов. Перед проверкой компания видит, кто и когда передал результат."],
  ["Кто решает, платить ли вознаграждение?", "Компания заранее задаёт условие награды и проверяет результат. После выполнения условия она подтверждает начисление и отмечает выплату."],
  ["Нужно ли агенту устанавливать приложение?", "Нет. Он открывает публичную ссылку в браузере, указывает email и получает доступ к заданиям и своему кабинету."],
  ["Что делает AI внутри Yaler?", "AI готовит черновики заданий и материалов из данных компании. Пользователь редактирует текст и подтверждает его перед публикацией."],
  ["Заменяет ли Yaler CRM?", "CRM хранит клиентов и ведёт сделки. Yaler отвечает за работу с внешними агентами: задания, авторство результата, проверку и вознаграждения."],
  ["Сколько времени занимает запуск?", "Если вы знаете, кого ищете и за какой результат готовы платить, первую программу можно опубликовать примерно за 10 минут."],
];

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite", "@id": "https://risestaff.kz/#website", url: "https://risestaff.kz/", name: "Yaler",
      alternateName: ["RiseStaff", "Yaler by RiseStaff"], inLanguage: "ru-KZ",
      publisher: { "@id": "https://risestaff.kz/#organization" },
    },
    {
      "@type": "Organization", "@id": "https://risestaff.kz/#organization", name: "Yaler", alternateName: "RiseStaff",
      url: "https://risestaff.kz/", logo: { "@type": "ImageObject", url: "https://risestaff.kz/icon-512.png", width: 512, height: 512 },
    },
    {
      "@type": "SoftwareApplication", "@id": "https://risestaff.kz/#software", name: "Yaler", url: "https://risestaff.kz/",
      applicationCategory: "BusinessApplication", operatingSystem: "Web", inLanguage: "ru-KZ",
      description: "Сервис для продаж через внешних агентов и амбассадоров.",
      featureList: ["Задания и награды для агентов", "Фиксация автора рекомендации", "Статусы результатов и выплат", "Кабинет агента без установки приложения"],
      provider: { "@id": "https://risestaff.kz/#organization" },
    },
  ],
};

export default async function Home() {
  const user = await getChatGPTUser();
  const dashboardHref = companyUrl(user ? "/dashboard" : chatGPTSignInPath("/onboarding"));
  const loginHref = companyUrl(user ? "/dashboard" : chatGPTSignInPath("/dashboard"));
  const whatsappHref = "https://wa.me/77765086000?text=%D0%A0%D1%83%D1%81%2C%20%D0%B7%D0%B4%D1%80%D0%B0%D0%B2%D1%81%D1%82%D0%B2%D1%83%D0%B9%D1%82%D0%B5!%20%D0%A5%D0%BE%D1%87%D1%83%20%D0%BE%D0%B1%D1%81%D1%83%D0%B4%D0%B8%D1%82%D1%8C%20Yaler";

  return <main className="lp-shell">
    <MarketingAnalytics />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    <a className="skip-link" href="#main-content">К основному содержанию</a>
    <header className="lp-header">
      <Link className="lp-brand" href="/" aria-label="Yaler — главная"><MarketingLogo /><span>Yaler</span></Link>
      <nav className="lp-nav" aria-label="Основная навигация"><a href="#product">Продукт</a><a href="#how">Как работает</a><a href="#offer">Условия</a><Link href="/integrators">Интеграторам</Link><a href="#faq">FAQ</a></nav>
      <div className="lp-header-actions"><a className="lp-login" href={loginHref} data-track="header_primary">{user ? "Открыть кабинет" : "Запустить канал"}</a><a className="lp-nav-cta lp-whatsapp-cta" href={whatsappHref} target="_blank" rel="noreferrer" data-track="whatsapp_header"><span className="lp-whatsapp-icon" aria-hidden="true" />Задать вопрос</a></div>
    </header>

    <section className="lp-hero" id="main-content">
      <div className="lp-orbit lp-orbit-one" aria-hidden="true" /><div className="lp-orbit lp-orbit-two" aria-hidden="true" />
      <div className="lp-hero-copy">
        <div className="lp-kicker"><span>●</span> ДЛЯ КОМПАНИЙ, КОТОРЫМ НУЖНЫ КЛИЕНТЫ ПО РЕКОМЕНДАЦИИ</div>
        <h1>Привлекайте новых клиентов через <span className="lp-color-word">агентов и амбассадоров.</span></h1>
        <p>Создайте задания с наградой и отправьте одну ссылку клиентам, партнёрам и экспертам. Yaler покажет, кто передал контакт, что с ним происходит и сколько нужно выплатить.</p>
        <div className="lp-mobile-audience" aria-label="Для кого и какую задачу решает Yaler"><span><b>КТО ПОЛЬЗУЕТСЯ</b>Собственник, продажи и маркетинг</span><span><b>ЧТО ПОЛУЧАЕТ</b>Лиды, сделки и учёт наград</span></div>
        <div className="lp-hero-actions"><a className="lp-primary" href={dashboardHref} data-track="hero_primary">{user ? "Открыть кабинет" : "Создать первую программу"}<span>↗</span></a><a className="lp-secondary" href="#how" data-track="hero_secondary">Посмотреть четыре шага <span>↓</span></a></div>
        <p className="lp-cta-note">Вы назначаете награду и проверяете результат · агент работает в браузере</p>
        <div className="lp-hero-facts"><span><b>1</b> ссылка для агентов</span><span><b>4</b> типа заданий</span><span><b>1</b> история результата</span></div>
      </div>
      <div className="lp-demo" aria-label="Пример страницы заданий Yaler">
        <div className="lp-demo-top"><div><MarketingLogo /><b>Yaler</b></div><span>ПРОГРАММА АКТИВНА <i>●</i></span></div>
        <div className="lp-demo-heading"><div><small>ПРОГРАММА ДЛЯ АМБАССАДОРОВ</small><h2>Выберите задание</h2></div><span>4 ЗАДАНИЯ</span></div>
        <div className="lp-mission-grid">{missionCards.map((card) => <article className={`lp-mission lp-${card.tone}`} key={card.index}><div><small>{card.index}</small><b>{card.icon}</b></div><span>{card.type}</span><h3>{card.title}</h3><p>{card.reward}</p></article>)}</div>
        <div className="lp-demo-event"><i>✓</i><div><strong>Новый лид закреплён за амбассадором</strong><span>Статус и история доступны обеим сторонам</span></div><b>сейчас</b></div>
      </div>
    </section>

    <section className="lp-trust-line" aria-label="Ключевые свойства"><div className="lp-marquee-track">{[0, 1].map((copy) => <div className="lp-marquee-set" aria-hidden={copy === 1} key={copy}><span><b>01</b>Условия до старта</span><span><b>02</b>Автор каждого лида</span><span><b>03</b>Статус каждого результата</span><span><b>04</b>Сумма каждой награды</span></div>)}</div></section>
    <section className="lp-pilot-proof" aria-label="Фактические показатели пилота Yaler"><div><span>ТЕКУЩИЙ ПИЛОТ YALER</span><p>Фактические показатели рабочего кабинета, показанного ниже.</p></div><dl><div><dt>1</dt><dd>активная программа</dd></div><div><dt>14</dt><dd>подключённых амбассадоров</dd></div><div><dt>6</dt><dd>переданных результатов</dd></div><div><dt>3</dt><dd>ожидают проверки</dd></div></dl></section>

    <section className="lp-problem lp-section"><i className="lp-motion-orbit orbit-black" aria-hidden="true" />
      <div className="lp-section-intro"><span>ПОЧЕМУ ТАБЛИЦЫ НЕ СПРАВЛЯЮТСЯ</span><h2>Рекомендации теряются в чатах, а выплаты — в таблицах.</h2><p>Агент отправляет контакт в переписку. Менеджер переносит его в CRM. Через месяц никто не помнит автора лида, обещанную сумму и срок выплаты.</p></div>
      <div className="lp-compare"><article className="lp-before"><small>РУЧНОЙ УЧЁТ</small><h3>Каждый результат приходится собирать по частям</h3><ul><li>Условия хранятся в переписках</li><li>Контакты приходят в разные каналы</li><li>Автор лида теряется после передачи в продажи</li><li>Начисления сверяют вручную</li></ul><strong>Компания не видит канал целиком</strong></article><article className="lp-after"><small>УЧЁТ В YALER</small><h3>У каждого результата есть автор, правило и статус</h3><ul><li>Агент выбирает готовое задание</li><li>Контакт попадает в кабинет компании</li><li>Менеджер меняет статус и оставляет комментарий</li><li>Награда связана с конкретным результатом</li></ul><strong>Следующий шаг виден сразу</strong></article></div>
    </section>

    <section className="lp-ai lp-section" id="product"><i className="lp-motion-orbit orbit-gray" aria-hidden="true" />
      <figure className="lp-ai-visual lp-live-screen"><div className="lp-live-screen-label"><span>РЕАЛЬНЫЙ КАБИНЕТ КОМПАНИИ</span><b>Рабочий стол Yaler</b></div><div className="lp-screen-wrap"><img src="/company-cabinet.png?v=20260818" width="1440" height="900" loading="lazy" alt="Рабочий стол компании в Yaler с программами, амбассадорами, результатами и выплатами" /><div className="lp-screen-callouts" aria-hidden="true"><span>14 амбассадоров</span><span>6 результатов</span><span>Статусы и выплаты</span></div></div></figure>
      <div className="lp-ai-copy"><span>РАБОЧИЙ СТОЛ ДЛЯ КОМПАНИИ</span><h2>Проверяйте лиды, работу агентов и выплаты на одном экране.</h2><p>Кабинет показывает активные программы, новых агентов и результаты, которые ждут решения. По каждому лиду видны контакт, автор, статус и награда.</p><ul><li>Назначайте условие и сумму награды</li><li>Принимайте результат или указывайте причину отказа</li><li>Смотрите историю статусов и выплат</li></ul><small>На изображении — рабочий кабинет компании Yaler.</small></div>
    </section>

    <section className="lp-how lp-section" id="how"><div className="lp-section-intro light"><span>КАК ЭТО РАБОТАЕТ</span><h2>Четыре шага от условий программы до первого результата.</h2></div><span className="lp-swipe-hint">Листайте шаги →</span><div className="lp-steps">
      <article><b>01</b><div className="lp-step-visual lp-step-program" aria-hidden="true"><div className="lp-step-window"><span><i /><i /><i /></span><small>НОВАЯ ПРОГРАММА</small><strong>Новые клиенты</strong><em>Создать&nbsp; +</em></div></div><small>НЕСКОЛЬКО МИНУТ</small><h3>Создайте программу</h3><p>Опишите продукт, целевого клиента и результат, за который готовы платить.</p></article>
      <article><b>02</b><div className="lp-step-visual lp-step-tasks" aria-hidden="true"><div><span>01</span><strong>Найти клиента</strong><em>15 000 ₸</em></div><div><span>02</span><strong>Закрыть сделку</strong><em>15%</em></div></div><small>ПРАВИЛА ЗАФИКСИРОВАНЫ</small><h3>Создайте задания</h3><p>Укажите действие, критерии результата, вознаграждение и материалы.</p></article>
      <article><b>03</b><div className="lp-step-visual lp-step-invite" aria-hidden="true"><div className="lp-step-link"><span>risestaff.kz/p/...</span><b>↗</b></div><div className="lp-step-avatars"><i>А</i><i>Б</i><i>К</i><em>+12 агентов</em></div></div><small>ОДНА ВНЕШНЯЯ ССЫЛКА</small><h3>Отправьте ссылку агентам</h3><p>Агент открывает программу, выбирает задание и передаёт результат.</p></article>
      <article><b>04</b><div className="lp-step-visual lp-step-result" aria-hidden="true"><div><span>Получен</span><i /><span>Проверен</span><i /><span>Оплачен</span></div><strong>15 000 ₸</strong><small>ВОЗНАГРАЖДЕНИЕ</small></div><small>ИСТОРИЯ РЕЗУЛЬТАТА</small><h3>Проверьте результат и отметьте выплату</h3><p>Компания меняет статус, пишет комментарий и подтверждает награду.</p></article>
    </div></section>

    <section className="lp-partner lp-section" id="partners"><i className="lp-motion-orbit orbit-lime" aria-hidden="true" />
      <div className="lp-partner-copy"><span>КАБИНЕТ ДЛЯ АГЕНТА</span><h2>Агент сразу видит, кого искать и сколько заработает.</h2><p>В каждом задании указаны нужный результат, критерии проверки, сумма награды и срок. После отправки агент видит решение компании и историю статусов.</p><ul className="lp-agent-benefits"><li>Кого знакомить с компанией</li><li>Что приложить для проверки</li><li>Когда и за что начислят награду</li></ul></div>
      <figure className="lp-partner-card lp-live-screen lp-agent-live-screen"><div className="lp-live-screen-label"><span>РЕАЛЬНЫЙ КАБИНЕТ АМБАССАДОРА</span><b>Доступные задания</b></div><div className="lp-screen-wrap"><img src="/agent-cabinet.png?v=20260818" width="1440" height="900" loading="lazy" alt="Кабинет амбассадора Yaler с доступными заданиями и условиями вознаграждения" /><div className="lp-screen-callouts agent" aria-hidden="true"><span>Задания</span><span>Условия награды</span><span>Статус рекомендации</span></div></div></figure>
    </section>

    <section className="lp-agent-sources lp-section"><div className="lp-section-intro"><span>КОГО ПРИГЛАСИТЬ ПЕРВЫМ</span><h2>Начните с людей, которые уже знают ваш продукт.</h2><p>Yaler ведёт учёт заданий и результатов. Первых агентов компания приглашает из своей сети.</p></div><div className="lp-source-grid"><article><b>01</b><h3>Клиенты</h3><p>Уже пользовались продуктом и могут рассказать о нём знакомым.</p></article><article><b>02</b><h3>Партнёры</h3><p>Работают с той же аудиторией и встречают подходящих клиентов.</p></article><article><b>03</b><h3>Эксперты</h3><p>Консультируют вашу целевую аудиторию и знают её задачи.</p></article><article><b>04</b><h3>Команда</h3><p>Общается с рынком и может передать тёплый контакт.</p></article></div><p className="lp-marketplace-note"><strong>Yaler не ищет агентов за компанию.</strong> Сервис даёт каждому приглашённому человеку задания, ссылку для передачи результата и кабинет со статусами.</p></section>

    <section className="lp-audience lp-section"><div className="lp-section-intro"><span>КТО РАБОТАЕТ С YALER</span><h2>Три роли, которым нужен общий учёт рекомендаций.</h2></div><span className="lp-swipe-hint">Листайте сценарии →</span><div className="lp-audience-grid">
      <article><b>01</b><div className="lp-role-visual lp-role-sales" aria-hidden="true"><div><span>АГЕНТЫ</span><strong>14</strong><i>в текущем пилоте</i></div><div><span>РЕЗУЛЬТАТЫ</span><strong>6</strong><i>3 на проверке</i></div><footer><em /><em /><em /><em /></footer></div><h3>Руководитель продаж</h3><p>Видит, кто привёл клиента, на каком этапе результат и кому начислить награду.</p></article>
      <article><b>02</b><div className="lp-role-visual lp-role-marketing" aria-hidden="true"><header><span>ПРОГРАММА</span><i>● активна</i></header><strong>Амбассадоры бренда</strong><div><span>единые правила</span><span>видимые статусы</span></div><footer><i /><i /><i /><i /><i /></footer></div><h3>Руководитель маркетинга</h3><p>Публикует имиджевые задания и проверяет материалы по заданным критериям.</p></article>
      <article><b>03</b><div className="lp-role-visual lp-role-founder" aria-hidden="true"><header><span>АГЕНТСКИЙ КАНАЛ</span><strong>1 ссылка</strong></header><div className="lp-role-bars"><i /><i /><i /><i /><i /><i /></div><footer><span>ПРОГРАММЫ</span><span>АГЕНТЫ</span></footer></div><h3>Собственник компании</h3><p>Получает дополнительный источник лидов через клиентов, партнёров и знакомых.</p></article>
    </div></section>

    <section className="lp-offer lp-section" id="offer"><div className="lp-offer-copy"><span>ПЕРВУЮ ПРОГРАММУ МОЖНО ПОДГОТОВИТЬ ПРИМЕРНО ЗА 10 МИНУТ</span><h2>Опубликуйте задания и отправьте ссылку агентам.</h2><p>Вы указываете результат, критерии проверки и сумму награды. Yaler собирает ответы агентов и показывает, что требует решения.</p><ul><li>Четыре типа заданий: люди, сделки, имидж и вовлечение</li><li>Одна публичная ссылка для приглашённых агентов</li><li>Контакт, автор, статус и награда по каждому результату</li><li>50 000 AI-кредитов для черновиков заданий и материалов</li></ul><div className="lp-offer-actions"><a className="lp-primary" href={dashboardHref} data-track="offer_primary">{user ? "Перейти к программам" : "Создать первую программу"}<span>↗</span></a><Link href="/pricing" data-track="pricing_link">Выбрать формат подключения →</Link></div></div><ol className="lp-offer-steps"><li><b>01</b><span><strong>Укажите данные компании</strong>Добавьте продукт и целевого клиента.</span></li><li><b>02</b><span><strong>Создайте программу</strong>Выберите результат и награду.</span></li><li><b>03</b><span><strong>Проверьте задания</strong>Отредактируйте черновики перед публикацией.</span></li><li><b>04</b><span><strong>Отправьте ссылку</strong>Пригласите клиентов, партнёров и экспертов.</span></li></ol></section>

    <MarketingSpecialOffer />
    <section className="lp-faq lp-section" id="faq"><div className="lp-section-intro"><span>ВОПРОСЫ И ОТВЕТЫ</span><h2>Что нужно знать перед запуском.</h2></div><div className="lp-faq-list">{faqs.map(([question, answer], index) => <details key={question}><summary><span>{String(index + 1).padStart(2, "0")}</span><strong>{question}</strong><i>+</i></summary><p>{answer}</p></details>)}</div></section>
    <section className="lp-final"><div className="lp-final-tiles" aria-hidden="true">{missionCards.map((card) => <i className={`lp-${card.tone}`} key={card.index}>{card.icon}</i>)}</div><span>ПЕРВАЯ ПРОГРАММА</span><h2>Опишите результат, назначьте награду и пригласите первых агентов.</h2><p>Yaler сохранит каждого участника, переданный контакт, решение компании и отметку о выплате.</p><a className="lp-primary" href={dashboardHref} data-track="final_primary">{user ? "Открыть кабинет" : "Создать первую программу"}<span>↗</span></a></section>
    <a className="lp-mobile-sticky-cta" href={dashboardHref} data-track="mobile_sticky">{user ? "Открыть кабинет" : "Создать программу"}<span>↗</span></a>
    <footer className="lp-footer"><div><Link className="lp-brand" href="/"><MarketingLogo /><span>Yaler</span></Link><p>Задания, лиды и награды для продаж через агентов.<br />Казахстан · <a href={whatsappHref} target="_blank" rel="noreferrer">WhatsApp +7 776 508 6000</a></p></div><nav><a href="#product">Продукт</a><a href="#offer">Условия</a><Link href="/integrators">Интеграторам</Link><a href="#faq">FAQ</a><Link href="/legal/privacy">Конфиденциальность</Link><Link href="/legal/license">Соглашение</Link></nav><span>© 2026 Yaler</span></footer>
  </main>;
}

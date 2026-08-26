import type { Metadata } from "next";
import { SafeLink as Link } from "@/app/safe-link";
import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";
import { MarketingAnalytics } from "./marketing-analytics";
import { MarketingLogo } from "./marketing-logo";
import { companyUrl } from "../lib/public-origins";

export const metadata: Metadata = {
  title: { absolute: "Relay — канал продаж через амбассадоров" },
  description: "Запускайте и управляйте каналом амбассадоров: задавайте результат, условия, вознаграждение и контролируйте путь рекомендации до выплаты.",
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
  ["Relay — это реферальная программа или система управления каналом?", "Это система управления каналом амбассадоров. Вы создаёте программу, задания и правила, а Relay фиксирует результат, статусы и начисления."],
  ["Кто такой амбассадор?", "Это человек, который может рекомендовать ваш продукт, привести потенциального клиента, помочь довести сделку или выполнить другое задание за заранее установленное вознаграждение."],
  ["Где брать амбассадоров?", "Начните с тех, кто уже знает ваш бизнес: клиентов, партнёров, экспертов, команды и других людей из вашей сети. Relay не является биржей амбассадоров."],
  ["Нужно ли амбассадору устанавливать приложение?", "Нет. Амбассадор открывает ссылку на программу, указывает email, выбирает задание и передаёт результат в браузере."],
  ["Как компания защищается от нецелевых лидов?", "В задании заранее задаются критерии подходящего клиента, нужное подтверждение, срок проверки и причины отказа. Компания принимает только результат по своим правилам."],
  ["Как фиксируется результат?", "Relay сохраняет автора и дату передачи, статусы, комментарии и историю проверки. Это помогает увидеть, кто привёл результат, и избежать споров о дублях."],
  ["Когда возникает вознаграждение?", "В момент, который компания задаёт в задании: например, после подтверждённого лида, встречи, сделки или другого целевого действия."],
  ["Как Relay зарабатывает?", "В базовой модели Relay получает 30% от комиссии амбассадора. Условия Enterprise-внедрения — фиксированная плата и процент от продаж — обсуждаются индивидуально."],
  ["Как используется AI?", "AI помогает быстрее создать и отредактировать задания, а также подготовить базу знаний. Он сокращает настройку, но правила и публикацию всегда контролирует компания."],
  ["Что получает компания после регистрации?", "После активации доступны кабинет компании, программы, задания, ссылка для амбассадоров и инструменты для фиксации результатов и выплат. Стартовый резерв 50 000 AI-кредитов помогает подготовить первые материалы."],
  ["Сколько времени занимает запуск?", "От регистрации до первой опубликованной программы и ссылки для амбассадоров обычно можно пройти примерно за 10 минут — если исходные условия уже определены."],
  ["Чем Relay отличается от таблицы, CRM и обычной реферальной программы?", "CRM ведёт работу с клиентами, а Relay организует внешний канал рекомендаций: задания, условия, авторство результата, статусы и вознаграждения. Это не замена CRM, а отдельный управляемый процесс."],
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
      description: "Платформа для запуска и управления каналом продаж через амбассадоров.",
      featureList: ["Программы и задания для амбассадоров", "Фиксация автора рекомендации", "Статусы результатов и выплат", "Кабинет амбассадора без установки приложения"],
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
      <div className="lp-header-actions"><a className="lp-login" href={loginHref} data-track="header_primary">{user ? "Открыть кабинет" : "Запустить канал"}</a><a className="lp-nav-cta lp-whatsapp-cta" href={whatsappHref} target="_blank" rel="noreferrer" data-track="whatsapp_header"><span className="lp-whatsapp-icon" aria-hidden="true" />Задать вопрос</a></div>
    </header>

    <section className="lp-hero" id="main-content">
      <div className="lp-orbit lp-orbit-one" aria-hidden="true" /><div className="lp-orbit lp-orbit-two" aria-hidden="true" />
      <div className="lp-hero-copy">
        <div className="lp-kicker"><span>●</span> ПЛАТФОРМА ДЛЯ КАНАЛА ПРОДАЖ ЧЕРЕЗ АМБАССАДОРОВ</div>
        <h1>Превратите рекомендации в <span className="lp-color-word">управляемый канал продаж.</span></h1>
        <p>Relay помогает компаниям запускать канал амбассадоров: вы задаёте нужный результат, условия и вознаграждение, а система фиксирует рекомендации, статусы и выплаты в одном месте.</p>
        <div className="lp-mobile-audience" aria-label="Для кого и какую задачу решает Relay"><span><b>ДЛЯ КОГО</b>Продажи, маркетинг и основатели</span><span><b>ВМЕСТО ЧЕГО</b>Чаты, таблицы и ручная сверка</span></div>
        <div className="lp-hero-actions"><a className="lp-primary" href={dashboardHref} data-track="hero_primary">{user ? "Открыть кабинет" : "Запустить канал амбассадоров"}<span>↗</span></a><a className="lp-secondary" href="#product" data-track="hero_secondary">Посмотреть, как это работает <span>↓</span></a></div>
        <p className="lp-cta-note">Вы сами определяете результат и вознаграждение · амбассадорам не нужно приложение</p>
        <div className="lp-hero-facts"><span><b>1</b> ссылка на программу</span><span><b>0</b> новых приложений</span><span><b>1</b> история результата</span></div>
      </div>
      <div className="lp-demo" aria-label="Пример страницы заданий Relay">
        <div className="lp-demo-top"><div><MarketingLogo /><b>Relay</b></div><span>ПРОГРАММА АКТИВНА <i>●</i></span></div>
        <div className="lp-demo-heading"><div><small>ПРОГРАММА ДЛЯ АМБАССАДОРОВ</small><h2>Выберите задание</h2></div><span>4 ЗАДАНИЯ</span></div>
        <div className="lp-mission-grid">{missionCards.map((card) => <article className={`lp-mission lp-${card.tone}`} key={card.index}><div><small>{card.index}</small><b>{card.icon}</b></div><span>{card.type}</span><h3>{card.title}</h3><p>{card.reward}</p></article>)}</div>
        <div className="lp-demo-event"><i>✓</i><div><strong>Новый лид закреплён за амбассадором</strong><span>Статус и история доступны обеим сторонам</span></div><b>сейчас</b></div>
      </div>
    </section>

    <section className="lp-trust-line" aria-label="Ключевые свойства"><div className="lp-marquee-track">{[0, 1].map((copy) => <div className="lp-marquee-set" aria-hidden={copy === 1} key={copy}><span><b>01</b>Понятные условия</span><span><b>02</b>Защита владельца лида</span><span><b>03</b>Прозрачные выплаты</span><span><b>04</b>Быстрый запуск</span></div>)}</div></section>
    <section className="lp-pilot-proof" aria-label="Фактические показатели пилота Relay"><div><span>ТЕКУЩИЙ ПИЛОТ RELAY</span><p>Фактические показатели рабочего кабинета, показанного ниже.</p></div><dl><div><dt>1</dt><dd>активная программа</dd></div><div><dt>14</dt><dd>подключённых амбассадоров</dd></div><div><dt>6</dt><dd>переданных результатов</dd></div><div><dt>3</dt><dd>ожидают проверки</dd></div></dl></section>

    <section className="lp-problem lp-section"><i className="lp-motion-orbit orbit-black" aria-hidden="true" />
      <div className="lp-section-intro"><span>БЫЛО → СТАЛО</span><h2>Сарафанное радио работает. Но им невозможно управлять.</h2><p>У многих компаний рекомендации уже есть. Когда условия живут в переписках и таблицах, невозможно прозрачно проверить результат, рассчитать вознаграждение и масштабировать канал.</p></div>
      <div className="lp-compare"><article className="lp-before"><small>БЕЗ RELAY</small><h3>Рекомендации зависят от ручных договорённостей</h3><ul><li>Условия у каждого свои</li><li>Результаты приходят в чаты и таблицы</li><li>Непонятно, кто привёл клиента</li><li>Выплаты приходится проверять вручную</li></ul><strong>Итог: канал не масштабируется</strong></article><article className="lp-after"><small>С RELAY</small><h3>У результата есть правило, статус и автор</h3><ul><li>Задание описывает нужное действие</li><li>Одна ссылка даёт доступ к программе</li><li>Статусы и история собраны в кабинете</li><li>Начисление связано с результатом</li></ul><strong>Итог: рекомендации становятся процессом</strong></article></div>
    </section>

    <section className="lp-ai lp-section" id="product"><i className="lp-motion-orbit orbit-gray" aria-hidden="true" />
      <figure className="lp-ai-visual lp-live-screen"><div className="lp-live-screen-label"><span>РЕАЛЬНЫЙ КАБИНЕТ КОМПАНИИ</span><b>Рабочий стол Relay</b></div><div className="lp-screen-wrap"><img src="/company-cabinet.png?v=20260818" width="1440" height="900" loading="lazy" alt="Рабочий стол компании в Relay с программами, амбассадорами, результатами и выплатами" /><div className="lp-screen-callouts" aria-hidden="true"><span>14 амбассадоров</span><span>6 результатов</span><span>Статусы и выплаты</span></div></div></figure>
      <div className="lp-ai-copy"><span>КОНТРОЛЬ ЭКОНОМИКИ КАНАЛА</span><h2>Задавайте правила — и видьте каждый результат.</h2><p>В одном рабочем столе собраны программы, амбассадоры, переданные результаты и выплаты. Руководитель видит, за какой результат платит и что происходит с каналом.</p><ul><li>Определяйте цель и вознаграждение программы</li><li>Проверяйте результаты по своим критериям</li><li>Ведите историю статусов и начислений</li></ul><small>Это реальный экран кабинета компании Relay.</small></div>
    </section>

    <section className="lp-how lp-section" id="how"><div className="lp-section-intro light"><span>КАК ЭТО РАБОТАЕТ</span><h2>От программы до первой ссылки для амбассадоров — четыре шага.</h2></div><span className="lp-swipe-hint">Листайте шаги →</span><div className="lp-steps">
      <article><b>01</b><div className="lp-step-visual lp-step-program" aria-hidden="true"><div className="lp-step-window"><span><i /><i /><i /></span><small>НОВАЯ ПРОГРАММА</small><strong>Новые клиенты</strong><em>Создать&nbsp; +</em></div></div><small>НЕСКОЛЬКО МИНУТ</small><h3>Создайте программу</h3><p>Опишите продукт, целевого клиента и результат, за который готовы платить.</p></article>
      <article><b>02</b><div className="lp-step-visual lp-step-tasks" aria-hidden="true"><div><span>01</span><strong>Найти клиента</strong><em>15 000 ₸</em></div><div><span>02</span><strong>Закрыть сделку</strong><em>15%</em></div></div><small>ПРАВИЛА ЗАФИКСИРОВАНЫ</small><h3>Создайте задания</h3><p>Укажите действие, критерии результата, вознаграждение и материалы.</p></article>
      <article><b>03</b><div className="lp-step-visual lp-step-invite" aria-hidden="true"><div className="lp-step-link"><span>risestaff.kz/p/...</span><b>↗</b></div><div className="lp-step-avatars"><i>А</i><i>Б</i><i>К</i><em>+12 амбассадоров</em></div></div><small>ОДНА ВНЕШНЯЯ ССЫЛКА</small><h3>Пригласите амбассадоров</h3><p>Они выбирают задание и передают результат по вашей ссылке.</p></article>
      <article><b>04</b><div className="lp-step-visual lp-step-result" aria-hidden="true"><div><span>Получен</span><i /><span>Проверен</span><i /><span>Оплачен</span></div><strong>15 000 ₸</strong><small>ВОЗНАГРАЖДЕНИЕ</small></div><small>ПРОЗРАЧНАЯ ВОРОНКА</small><h3>Проверяйте результат и платите</h3><p>Статусы, результат и начисления фиксируются в системе по заданному правилу.</p></article>
    </div></section>

    <section className="lp-partner lp-section" id="partners"><i className="lp-motion-orbit orbit-lime" aria-hidden="true" />
      <div className="lp-partner-copy"><span>ПОНЯТНЫЕ УСЛОВИЯ ДЛЯ ОБЕИХ СТОРОН</span><h2>Амбассадор знает, что делать. Компания — за что платит.</h2><p>В задании заранее зафиксированы действие, критерий результата и вознаграждение. Амбассадор видит статус, а компания сохраняет контроль и историю.</p><ul className="lp-agent-benefits"><li>Понятно, что именно нужно сделать</li><li>Видно статус и автора результата</li><li>Есть история проверки и начисления</li></ul></div>
      <figure className="lp-partner-card lp-live-screen lp-agent-live-screen"><div className="lp-live-screen-label"><span>РЕАЛЬНЫЙ КАБИНЕТ АМБАССАДОРА</span><b>Доступные задания</b></div><div className="lp-screen-wrap"><img src="/agent-cabinet.png?v=20260818" width="1440" height="900" loading="lazy" alt="Кабинет амбассадора Relay с доступными заданиями и условиями вознаграждения" /><div className="lp-screen-callouts agent" aria-hidden="true"><span>Задания</span><span>Условия награды</span><span>Статус рекомендации</span></div></div></figure>
    </section>

    <section className="lp-agent-sources lp-section"><div className="lp-section-intro"><span>ГДЕ ВЗЯТЬ ПЕРВЫХ АМБАССАДОРОВ</span><h2>Начните с людей, которые уже знают ваш бизнес.</h2><p>Relay организует и масштабирует работу с вашей сетью — он не предоставляет амбассадоров как биржа.</p></div><div className="lp-source-grid"><article><b>01</b><h3>Клиенты</h3><p>Люди, которые уже знают ценность вашего продукта.</p></article><article><b>02</b><h3>Партнёры</h3><p>Компании и специалисты с похожей аудиторией.</p></article><article><b>03</b><h3>Эксперты</h3><p>Консультанты и лидеры сообществ, которым доверяют.</p></article><article><b>04</b><h3>Команда</h3><p>Сотрудники и знакомые, которые могут рекомендовать вас.</p></article></div><p className="lp-marketplace-note"><strong>Важно:</strong> Relay не является биржей амбассадоров. Он помогает организовать работу с вашей сетью рекомендаций и сделать условия прозрачными для обеих сторон.</p></section>

    <section className="lp-audience lp-section"><div className="lp-section-intro"><span>КОМУ ПОДХОДИТ</span><h2>Тем, у кого покупают через доверие и рекомендации.</h2></div><span className="lp-swipe-hint">Листайте сценарии →</span><div className="lp-audience-grid">
      <article><b>01</b><div className="lp-role-visual lp-role-sales" aria-hidden="true"><div><span>АМБАССАДОРЫ</span><strong>14</strong><i>в текущем пилоте</i></div><div><span>РЕЗУЛЬТАТЫ</span><strong>6</strong><i>3 на проверке</i></div><footer><em /><em /><em /><em /></footer></div><h3>Руководителю продаж</h3><p>Подключить внешних амбассадоров и видеть вклад каждого без отдельного процесса учёта.</p></article>
      <article><b>02</b><div className="lp-role-visual lp-role-marketing" aria-hidden="true"><header><span>КАМПАНИЯ</span><i>● активна</i></header><strong>Амбассадоры бренда</strong><div><span>единые правила</span><span>видимые статусы</span></div><footer><i /><i /><i /><i /><i /></footer></div><h3>Руководителю маркетинга</h3><p>Запустить амбассадорские и имиджевые задания с понятной проверкой.</p></article>
      <article><b>03</b><div className="lp-role-visual lp-role-founder" aria-hidden="true"><header><span>КАНАЛ АМБАССАДОРОВ</span><strong>1 ссылка</strong></header><div className="lp-role-bars"><i /><i /><i /><i /><i /><i /></div><footer><span>ПРОГРАММЫ</span><span>АМБАССАДОРЫ</span></footer></div><h3>Основателю компании</h3><p>Превратить сеть клиентов, партнёров и знакомых в управляемый канал продаж.</p></article>
    </div></section>

    <section className="lp-offer lp-section" id="offer"><div className="lp-offer-copy"><span>ПЕРВУЮ ПРОГРАММУ МОЖНО ПОДГОТОВИТЬ ПРИМЕРНО ЗА 10 МИНУТ</span><h2>Запустите канал на своих условиях.</h2><p>Вы определяете, за какой результат платите и сколько он стоит бизнесу. AI помогает быстрее подготовить задания и базу знаний, чтобы опубликовать первую программу без долгой настройки.</p><ul><li>Программы и задания для четырёх типов задач</li><li>Одна ссылка для вашей сети амбассадоров</li><li>Фиксация результатов, статусов и выплат</li><li>50 000 AI-кредитов на старте — для подготовки материалов</li></ul><div className="lp-offer-actions"><a className="lp-primary" href={dashboardHref} data-track="offer_primary">{user ? "Перейти к программам" : "Запустить канал амбассадоров"}<span>↗</span></a><Link href="/pricing" data-track="pricing_link">Посмотреть условия подключения →</Link></div></div><ol className="lp-offer-steps"><li><b>01</b><span><strong>Зарегистрируйтесь</strong>Укажите данные компании.</span></li><li><b>02</b><span><strong>Создайте программу</strong>Опишите нужный бизнес-результат.</span></li><li><b>03</b><span><strong>Подготовьте задания</strong>AI поможет с черновиком и базой знаний.</span></li><li><b>04</b><span><strong>Отправьте ссылку</strong>Пригласите первых амбассадоров.</span></li></ol></section>

    <section className="lp-faq lp-section" id="faq"><div className="lp-section-intro"><span>FAQ</span><h2>Вопросы до запуска.</h2></div><div className="lp-faq-list">{faqs.map(([question, answer], index) => <details key={question}><summary><span>{String(index + 1).padStart(2, "0")}</span><strong>{question}</strong><i>+</i></summary><p>{answer}</p></details>)}</div></section>
    <section className="lp-final"><div className="lp-final-tiles" aria-hidden="true">{missionCards.map((card) => <i className={`lp-${card.tone}`} key={card.index}>{card.icon}</i>)}</div><span>ВАША СЕТЬ МОЖЕТ СТАТЬ КАНАЛОМ ПРОДАЖ</span><h2>Задайте результат. Подключите людей. Контролируйте экономику.</h2><p>Создайте первую программу примерно за 10 минут: условия и вознаграждение определяете вы, а амбассадоры получают понятную ссылку и задания.</p><a className="lp-primary" href={dashboardHref} data-track="final_primary">{user ? "Открыть кабинет" : "Запустить канал амбассадоров"}<span>↗</span></a></section>
    <a className="lp-mobile-sticky-cta" href={dashboardHref} data-track="mobile_sticky">{user ? "Открыть кабинет" : "Запустить канал амбассадоров"}<span>↗</span></a>
    <footer className="lp-footer"><div><Link className="lp-brand" href="/"><MarketingLogo /><span>Relay</span></Link><p>Управляемый канал продаж через амбассадоров.<br />Казахстан · <a href={whatsappHref} target="_blank" rel="noreferrer">WhatsApp +7 776 508 6000</a></p></div><nav><a href="#product">Продукт</a><a href="#offer">Условия</a><Link href="/integrators">Интеграторам</Link><a href="#faq">FAQ</a><Link href="/legal/privacy">Конфиденциальность</Link><Link href="/legal/license">Соглашение</Link></nav><span>© 2026 Relay</span></footer>
  </main>;
}

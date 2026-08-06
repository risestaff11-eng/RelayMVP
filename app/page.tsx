import type { Metadata } from "next";
import { SafeLink as Link } from "@/app/safe-link";
import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";
import { MarketingLogo } from "./marketing-logo";
import { TypedReasons } from "./typed-reasons";

export const metadata: Metadata = {
  title: "Relay — запустите партнёрский канал продаж",
  description: "Создайте программу, выдайте агентам понятные задания и прозрачно ведите каждый лид от рекомендации до выплаты.",
};

export const dynamic = "force-dynamic";

const missionCards = [
  { index: "01", type: "ЛИДЫ", title: "Найдите компанию для внедрения CRM", reward: "30 000 ₸ за встречу", icon: "↗", tone: "lime" },
  { index: "02", type: "СДЕЛКИ", title: "Приведите клиента до первой сделки", reward: "10% от первой оплаты", icon: "◎", tone: "dark" },
  { index: "03", type: "ИМИДЖ", title: "Поделитесь кейсом в сообществе", reward: "5 000 ₸ после проверки", icon: "✦", tone: "blue" },
  { index: "04", type: "ВОВЛЕЧЕНИЕ", title: "Пройдите продуктовый квиз", reward: "Откройте новые задания", icon: "✓", tone: "paper" },
];

const faqs = [
  ["Relay — это партнёрская или реферальная программа?", "И то и другое. Компания сама определяет результат: квалифицированный лид, встреча, сделка, имиджевая публикация или полезное действие. Relay фиксирует правила и ведёт результат до выплаты."],
  ["Нужно ли агенту устанавливать приложение?", "Нет. Он открывает публичную ссылку, указывает email, выбирает задание и передаёт результат в браузере. Отдельное приложение не требуется."],
  ["Как компания защищается от нецелевых лидов?", "В каждом задании заранее задаются критерии подходящего клиента, подтверждения результата, срок проверки и причины отказа. Компания принимает только то, что соответствует правилам."],
  ["Как агент понимает, что его лид не присвоили?", "Relay фиксирует владельца и дату передачи, предупреждает о дублях и сохраняет историю статусов и комментариев. Агент видит путь рекомендации до начисления и выплаты."],
  ["Relay сам выплачивает вознаграждения?", "На текущем этапе компания проводит выплату самостоятельно, а в Relay подтверждает сумму, основание, плановую дату и факт выплаты."],
  ["Где здесь используется ИИ?", "Только как ускоритель настройки: он анализирует открытые страницы сайта, собирает черновик профиля компании и предлагает задания. Компания редактирует и обязательно подтверждает результат перед публикацией."],
  ["Можно ли запустить несколько программ?", "Да. Сейчас создание программ не ограничено: можно разделять предложения по продуктам, рынкам или типам агентов."],
];

export default async function Home() {
  const user = await getChatGPTUser();
  const dashboardHref = user ? "/dashboard" : chatGPTSignInPath("/onboarding");
  const loginHref = user ? "/dashboard" : chatGPTSignInPath("/dashboard");
  const whatsappHref = "https://wa.me/77765086000?text=%D0%A0%D1%83%D1%81%20%D0%A1%D0%B0%D0%BB%D0%B5%D0%BC%20%D0%B4%D0%B0%D0%B2%D0%B0%D0%B9%20%D0%BE%D0%B1%D1%81%D1%83%D0%B4%D0%B8%D0%BC%20Relay";

  return <main className="lp-shell">
    <header className="lp-header">
      <Link className="lp-brand" href="/" aria-label="Relay — главная"><MarketingLogo /><span>Relay</span></Link>
      <nav className="lp-nav" aria-label="Основная навигация"><a href="#product">Продукт</a><a href="#how">Как работает</a><Link href="/pricing">Тарифы</Link><Link href="/integrators">Стать интегратором</Link><a href="#faq">FAQ</a></nav>
      <div className="lp-header-actions"><a className="lp-login" href={loginHref}>{user ? "Кабинет" : "Войти"}</a><a className="lp-nav-cta" href={whatsappHref} target="_blank" rel="noreferrer">Оставить заявку<span>↗</span></a></div>
    </header>

    <section className="lp-hero">
      <div className="lp-orbit lp-orbit-one" aria-hidden="true" /><div className="lp-orbit lp-orbit-two" aria-hidden="true" />
      <div className="lp-hero-copy">
        <div className="lp-kicker"><span>●</span> ПЛАТФОРМА ПАРТНЁРСКИХ ПРОДАЖ</div>
        <h1>Превратите <span className="lp-color-word">рекомендации</span> в управляемый канал продаж.</h1>
        <p>Запустите программу по одной ссылке. Агенты увидят, кого искать и сколько заработают, а вы — кто привёл лида и что с ним происходит.</p>
        <div className="lp-hero-actions"><a className="lp-primary" href={dashboardHref}>{user ? "Открыть кабинет" : "Создать программу"}<span>↗</span></a><a className="lp-secondary" href="#how">Посмотреть сценарий <span>↓</span></a></div>
        <div className="lp-hero-facts"><span><b>4</b> типа заданий</span><span><b>1</b> ссылка для агентов</span><span><b>0</b> таблиц для сверки</span></div>
      </div>

      <div className="lp-demo" aria-label="Пример страницы заданий Relay">
        <div className="lp-demo-top"><div><MarketingLogo /><b>Relay</b></div><span>ПРОГРАММА АКТИВНА <i>●</i></span></div>
        <div className="lp-demo-heading"><div><small>ПРОГРАММА ДЛЯ АГЕНТОВ</small><h2>Выберите задание</h2></div><span>4 ЗАДАНИЯ</span></div>
        <div className="lp-mission-grid">{missionCards.map((card) => <article className={`lp-mission lp-${card.tone}`} key={card.index}><div><small>{card.index}</small><b>{card.icon}</b></div><span>{card.type}</span><h3>{card.title}</h3><p>{card.reward}</p></article>)}</div>
        <div className="lp-demo-event"><i>✓</i><div><strong>Новый лид закреплён за агентом</strong><span>Статус и история доступны обеим сторонам</span></div><b>сейчас</b></div>
      </div>
    </section>

    <section className="lp-trust-line" aria-label="Ключевые свойства"><div className="lp-marquee-track">{[0, 1].map((copy) => <div className="lp-marquee-set" aria-hidden={copy === 1} key={copy}><span><b>01</b>Понятные условия</span><span><b>02</b>Защита владельца лида</span><span><b>03</b>Прозрачные выплаты</span><span><b>04</b>Быстрый запуск</span></div>)}</div></section>

    <section className="lp-problem lp-section"><i className="lp-motion-orbit orbit-black" aria-hidden="true" />
      <div className="lp-section-intro"><span>БЫЛО → СТАЛО</span><h2>Сарафанное радио работает. Но им невозможно управлять.</h2><p>Знакомые могут рекомендовать вас уже сегодня. Проблема начинается, когда нужно объяснить предложение, закрепить лид, проверить результат и честно рассчитать вознаграждение.</p></div>
      <div className="lp-compare"><article className="lp-before"><small>БЕЗ RELAY</small><h3>Рекомендации теряются в переписках</h3><ul><li>Условия каждый понимает по-своему</li><li>Лиды приходят в чат, почту и таблицы</li><li>Агент не знает, что стало со сделкой</li><li>Выплаты приходится сверять вручную</li></ul><strong>Итог: канал не масштабируется</strong></article><article className="lp-after"><small>С RELAY</small><h3>У каждого результата есть правила и владелец</h3><ul><li>Задание объясняет, кого искать и что передать</li><li>Одна ссылка собирает агентов и лиды</li><li>Статусы и комментарии видны в кабинете</li><li>Начисления связаны с конкретным результатом</li></ul><strong>Итог: рекомендации становятся процессом</strong></article></div>
    </section>

    <section className="lp-how lp-section" id="how">
      <div className="lp-section-intro light"><span>КАК ЭТО РАБОТАЕТ</span><h2>От идеи до первой ссылки для агентов — четыре шага.</h2></div>
      <div className="lp-steps"><article><b>01</b><small>НЕСКОЛЬКО МИНУТ</small><h3>Создайте программу</h3><p>Опишите продукт, целевого клиента и результат, за который готовы платить.</p></article><article><b>02</b><small>ПРАВИЛА ЗАФИКСИРОВАНЫ</small><h3>Соберите задания</h3><p>Добавьте награду, срок, критерии проверки и материалы для знакомства.</p></article><article><b>03</b><small>ОДНА ВНЕШНЯЯ ССЫЛКА</small><h3>Пригласите агентов</h3><p>Агент входит по email, выбирает задание и передаёт подходящий результат.</p></article><article><b>04</b><small>ПРОЗРАЧНАЯ ВОРОНКА</small><h3>Проверяйте и платите</h3><p>Меняйте статусы, объясняйте решения и фиксируйте начисления без ручной сверки.</p></article></div>
    </section>

    <section className="lp-product lp-section" id="product"><i className="lp-motion-orbit orbit-blue" aria-hidden="true" />
      <div className="lp-section-intro"><span>ОДИН ПРОДУКТ · ДВЕ СТОРОНЫ</span><h2>Компания управляет каналом. Агент понимает, как заработать.</h2></div>
      <div className="lp-bento"><article className="lp-bento-wide"><small>КАБИНЕТ КОМПАНИИ</small><h3>Все рекомендации — в одной воронке</h3><p>От нового лида до сделки и вознаграждения. Владелец, дата, доказательства, комментарии и история статусов не теряются.</p><div className="lp-pipeline"><span className="done">Отправлен</span><span className="done">Проверяется</span><span className="active">Принят</span><span>В работе</span><span>Сделка</span><span>Выплата</span></div></article><article className="lp-bento-link"><small>ПУБЛИЧНАЯ ССЫЛКА</small><h3>Без сложной регистрации</h3><p>Агент открывает программу, видит условия и сразу выбирает задание.</p><div>relay.app/p/<b>sales-team</b><span>↗</span></div></article><article className="lp-bento-wallet"><small>КАБИНЕТ АГЕНТА</small><h3>Деньги и прогресс на виду</h3><div><span>Ожидается</span><strong>75 000 ₸</strong></div><ul><li><i /> Лид принят компанией</li><li><i /> Выплата запланирована</li></ul></article><article className="lp-bento-trust"><small>ДОВЕРИЕ</small><h3>Никаких «мы не помним, чей это контакт»</h3><p>Проверка дубля до раскрытия контакта, журнал изменений, причина отказа и возможность открыть спор.</p><strong>Каждый лид закреплён</strong></article></div>
    </section>

    <section className="lp-ai lp-section"><i className="lp-motion-orbit orbit-gray" aria-hidden="true" />
      <div className="lp-ai-visual lp-app-shot" aria-label="Экран AI-профиля компании в Relay"><div className="lp-app-shot-top"><div><MarketingLogo /><strong>Relay</strong></div><span>AI-ПРОФИЛЬ КОМПАНИИ</span><b>Черновик готов</b></div><div className="lp-app-shot-body"><aside><small>РАЗДЕЛЫ</small><span>Обзор</span><span className="active">✦ AI-профиль</span><span>Программы</span><span>Агенты</span></aside><section><div className="lp-app-shot-url"><small>САЙТ КОМПАНИИ</small><strong>relay-demo.kz</strong><span>✓ анализ завершён</span></div><div className="lp-app-shot-fields"><article><small>ОПИСАНИЕ БИЗНЕСА</small><p>Внедрение CRM для отделов продаж B2B-компаний.</p></article><article><small>ПРОДУКТЫ И УСЛУГИ</small><p>Аудит, настройка, интеграции и обучение команды.</p></article><article><small>ЦЕЛЕВАЯ АУДИТОРИЯ</small><p>Руководители продаж в компаниях от 20 сотрудников.</p></article><article><small>ПРЕИМУЩЕСТВА</small><p>Запуск за 30 дней и прозрачный план внедрения.</p></article></div><div className="lp-app-shot-confirm"><span>Проверьте данные перед созданием программы</span><b>Подтвердить профиль →</b></div></section></div></div>
      <div className="lp-ai-copy"><span>УМНЫЙ СТАРТ</span><h2>Не начинайте с пустого экрана.</h2><p>Вспомогательный ИИ анализирует открытые страницы сайта, собирает профиль компании и предлагает задания для агентов. Вы редактируете результат и только после подтверждения публикуете программу.</p><ul><li>Выделяет продукты и целевых клиентов</li><li>Предлагает задания и критерии проверки</li><li>Готовит основу сообщений и материалов</li></ul><small>ИИ помогает настроить программу, но не принимает бизнес-решения за компанию.</small></div>
    </section>

    <section className="lp-partner lp-section" id="partners"><i className="lp-motion-orbit orbit-lime" aria-hidden="true" />
      <div className="lp-partner-copy"><span>ПОЧЕМУ АГЕНТ ВЕРНЁТСЯ</span><h2>Агент возвращается.<br /><TypedReasons /></h2><p>Игровой прогресс поддерживает полезные действия: подтверждённые контакты, качественные лиды и выполненные задания открывают новый уровень и более выгодные предложения.</p><div className="lp-level"><div><b>1</b><span>НАВИГАТОР</span></div><i><em /></i><div><b>2</b><span>ПРОВЕРЕННЫЙ</span></div></div></div>
      <div className="lp-partner-card"><div><small>ДО СЛЕДУЮЩЕГО УРОВНЯ</small><strong>2 из 3 условий</strong></div><ul><li className="done">✓ Email подтверждён</li><li className="done">✓ WhatsApp подтверждён</li><li>○ Первый принятый лид</li></ul><footer><span>Откроется после уровня 2</span><b>Повышенная комиссия · Быстрая проверка</b></footer></div>
    </section>

    <section className="lp-audience lp-section"><div className="lp-section-intro"><span>КОМУ ПОДХОДИТ</span><h2>Тем, у кого покупают через доверие и рекомендации.</h2></div><div className="lp-audience-grid"><article><b>01</b><h3>Руководителю продаж</h3><p>Подключить внешних продавцов и видеть вклад каждого без новой CRM.</p></article><article><b>02</b><h3>Руководителю маркетинга</h3><p>Запустить амбассадорские и имиджевые задания с понятной проверкой.</p></article><article><b>03</b><h3>Основателю B2B-компании</h3><p>Превратить сеть знакомых, клиентов и экспертов в повторяемый канал.</p></article></div></section>

    <section className="lp-plans-preview lp-section"><div className="lp-section-intro"><span>ТАРИФЫ БЕЗ СЮРПРИЗОВ</span><h2>Начните с нужного масштаба.</h2><p>Стоимость обсудим после короткой встречи — сначала определим количество программ, агентов и необходимый уровень сопровождения.</p></div><div className="lp-plan-teasers"><article><span>СТАРТ</span><h3>Проверить канал</h3><p>Для первой программы и ручного управления результатами.</p></article><article><span>РОСТ</span><h3>Масштабировать агентов</h3><p>Для нескольких программ и регулярного потока рекомендаций.</p></article><article><span>СЕТЬ</span><h3>Построить экосистему</h3><p>Для компаний с интеграторами, агентами и сложной мотивацией.</p></article></div><Link className="lp-plan-link" href="/pricing">Смотреть варианты подключения <span>→</span></Link></section>

    <section className="lp-access lp-section"><div><span>РАННИЙ ДОСТУП</span><h2>Запускайте столько программ, сколько нужно.</h2><p>Сейчас создание программ не ограничено. Проверьте канал на одном продукте, соберите первые рекомендации и только потом усложняйте механику.</p></div><a className="lp-primary inverse" href={dashboardHref}>{user ? "Перейти к программам" : "Запустить первую программу"}<span>↗</span></a></section>

    <section className="lp-faq lp-section" id="faq"><div className="lp-section-intro"><span>FAQ</span><h2>Вопросы до запуска.</h2></div><div className="lp-faq-list">{faqs.map(([question, answer], index) => <details key={question}><summary><span>{String(index + 1).padStart(2, "0")}</span><strong>{question}</strong><i>+</i></summary><p>{answer}</p></details>)}</div></section>

    <section className="lp-final"><div className="lp-final-tiles" aria-hidden="true">{missionCards.map((card) => <i className={`lp-${card.tone}`} key={card.index}>{card.icon}</i>)}</div><span>ПЕРВАЯ ПРОГРАММА НАЧИНАЕТСЯ С ОДНОЙ ССЫЛКИ</span><h2>Дайте агентам понятный повод рекомендовать вас.</h2><p>А себе — прозрачный способ принять результат, довести его до сделки и не потерять доверие.</p><a className="lp-primary" href={dashboardHref}>Начать бесплатно<span>↗</span></a></section>

    <footer className="lp-footer"><div><Link className="lp-brand" href="/"><MarketingLogo /><span>Relay</span></Link><p>Партнёрские продажи по одной ссылке.</p></div><nav><a href="#product">Продукт</a><Link href="/pricing">Тарифы</Link><Link href="/integrators">Интеграторам</Link><a href="#faq">FAQ</a><Link href="/legal/privacy">Конфиденциальность</Link><Link href="/legal/license">Соглашение</Link></nav><span>© 2026 Relay</span></footer>
  </main>;
}

import type { Metadata } from "next";
import { SafeLink as Link } from "@/app/safe-link";
import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";
import { MarketingAnalytics } from "./marketing-analytics";
import { MarketingLogo } from "./marketing-logo";
import { MarketingSpecialOffer } from "./marketing-special-offer";
import { CompanyApplicationForm } from "./company-application-form";
import { agentUrl, companyUrl } from "../lib/public-origins";

export const metadata: Metadata = {
  title: { absolute: "RiseStaff — новые клиенты через рекомендации" },
  description:
    "Ваши клиенты и партнёры рекомендуют вас покупателям. Вы видите, кто привёл каждого клиента, что стало с заявкой и сколько нужно выплатить.",
  alternates: { canonical: "https://risestaff.kz/" },
};

export const dynamic = "force-dynamic";

const missionCards = [
  {
    index: "01",
    type: "ЛИДЫ",
    title: "Пригласите родителей на пробный урок",
    reward: "10 000 ₸ за оплату курса",
    icon: "↗",
    tone: "lime",
  },
  {
    index: "02",
    type: "СДЕЛКИ",
    title: "Помогите записать ученика на годовой курс",
    reward: "25 000 ₸ после первой оплаты",
    icon: "◎",
    tone: "dark",
  },
  {
    index: "03",
    type: "ИМИДЖ",
    title: "Расскажите о курсе в родительском сообществе",
    reward: "5 000 ₸ после проверки",
    icon: "✦",
    tone: "blue",
  },
  {
    index: "04",
    type: "ВОВЛЕЧЕНИЕ",
    title: "Пригласите знакомых на открытый урок",
    reward: "Бонус за участие",
    icon: "✓",
    tone: "paper",
  },
];

const faqs = [
  [
    "Где взять людей, которые будут нас рекомендовать?",
    "Начните с тех, кто уже знает вашу работу: клиентов, партнёров, консультантов и знакомых. RiseStaff не продаёт базу людей. Вы сами решаете, кого пригласить.",
  ],
  [
    "Сколько это стоит?",
    "Сейчас RiseStaff работает в пилотном формате. Оставьте заявку — мы покажем подходящий вариант и заранее назовём стоимость. Вознаграждения людям вы платите напрямую, RiseStaff не удерживает процент с выплат.",
  ],
  [
    "Это заменит CRM?",
    "Нет. CRM ведёт продажи после получения контакта. RiseStaff помогает до этого: объясняет, кого вы ищете, принимает заявки от рекомендателей и считает, кому сколько вы должны.",
  ],
  [
    "Как оформить выплату человеку в Казахстане?",
    "RiseStaff хранит основание, сумму и отметку о выплате. Саму выплату компания оформляет своим способом. Для физлица обычно проверяют договор ГПХ и обязательные платежи, для ИП — договор и документы ИП. Точный порядок согласуйте с бухгалтером под ваш случай.",
  ],
  [
    "Сколько времени нужно на запуск?",
    "Если вы знаете, кого ищете и сколько готовы платить, черновик можно собрать примерно за 10 минут. ИИ поможет с текстом, а перед публикацией вы всё проверите.",
  ],
  [
    "А если приведут клиента, который и так к нам шёл?",
    "Вы решаете, принимать заявку или нет, и указываете причину. Правило можно написать заранее: например, не засчитывать ученика, который уже оставил заявку в вашем центре.",
  ],
  [
    "А если посыпятся неподходящие заявки?",
    "Вы платите только за принятые заявки. До запуска напишите, какой клиент подходит, какие данные обязательны и в каких случаях вы откажете.",
  ],
];

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://risestaff.kz/#website",
      url: "https://risestaff.kz/",
      name: "RiseStaff",
      alternateName: ["risestaff.kz"],
      inLanguage: "ru-KZ",
      publisher: { "@id": "https://risestaff.kz/#organization" },
    },
    {
      "@type": "Organization",
      "@id": "https://risestaff.kz/#organization",
      name: "RiseStaff",
      url: "https://risestaff.kz/",
      logo: {
        "@type": "ImageObject",
        url: "https://risestaff.kz/icon-512.png",
        width: 512,
        height: 512,
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://risestaff.kz/#software",
      name: "RiseStaff",
      url: "https://risestaff.kz/",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: "ru-KZ",
      description: "Помогает компаниям получать новых клиентов через рекомендации покупателей и партнёров.",
      featureList: [
        "Правила и вознаграждения за приведённых клиентов",
        "Кто привёл каждого клиента",
        "Статусы заявок и выплат",
        "Кабинет рекомендателя без установки приложения",
      ],
      provider: { "@id": "https://risestaff.kz/#organization" },
    },
  ],
};

export default async function Home() {
  const user = await getChatGPTUser();
  const dashboardHref = companyUrl(
    user ? "/dashboard" : chatGPTSignInPath("/onboarding"),
  );
  const loginHref = companyUrl(
    user ? "/dashboard" : chatGPTSignInPath("/dashboard"),
  );
  const whatsappHref = "https://wa.me/77765086000?text=%D0%A5%D0%BE%D1%87%D1%83%20%D0%BE%D0%B1%D1%81%D1%83%D0%B4%D0%B8%D1%82%D1%8C%20%D0%B7%D0%B0%D0%BF%D1%83%D1%81%D0%BA%20RiseStaff";

  return (
    <main className="lp-shell">
      <MarketingAnalytics />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <a className="skip-link" href="#main-content">
        К основному содержанию
      </a>
      <header className="lp-header">
        <Link className="lp-brand" href="/" aria-label="RiseStaff — главная">
          <MarketingLogo />
          <span>RiseStaff</span>
        </Link>
        <nav className="lp-nav" aria-label="Основная навигация">
          <a href="#how">Как работает</a>
          <a href="#example">Пример</a>
          <a href="#payments">Выплаты</a>
          <Link href="/integrators">Интеграторам</Link>
          <a href="#faq">Вопросы</a>
        </nav>
        <div className="lp-header-actions">
          <a
            className="lp-agent-login"
            href={agentUrl("/p/relay-kz-13c34fa")}
            data-track="agent_login"
          >
            Заработать на рекомендациях
          </a>
          <a className="lp-login" href={loginHref} data-track="header_primary">
            {user ? "Открыть кабинет" : "Начать бесплатно"}
          </a>
          <a
            className="lp-nav-cta lp-whatsapp-cta"
            href="#company-application"
            data-track="application_header"
          >
            Оставить заявку
          </a>
        </div>
      </header>

      <section className="lp-hero" id="main-content">
        <div className="lp-orbit lp-orbit-one" aria-hidden="true" />
        <div className="lp-orbit lp-orbit-two" aria-hidden="true" />
        <div className="lp-hero-copy">
          <div className="lp-kicker">
            <span>●</span> БОЛЬШЕ НОВЫХ КЛИЕНТОВ ИЗ ТЕХ, КТО УЖЕ ВАМ ДОВЕРЯЕТ
          </div>
          <h1>
            Превратите рекомендации в стабильный источник{" "}
            <span className="lp-color-word">новых клиентов.</span>
          </h1>
          <p>
            Ваши клиенты и партнёры рекомендуют вас знакомым. Вы получаете новые
            контакты и сразу видите, кто привёл покупателя и сколько ему заплатить.
          </p>
          <p className="lp-hero-definition"><strong>Амбассадор</strong> — ваш клиент, партнёр или знакомый, который рекомендует вас подходящему покупателю.</p>
          <div
            className="lp-mobile-audience"
            aria-label="Для кого и какую задачу решает RiseStaff"
          >
            <span>
              <b>ДЛЯ КОГО</b>Собственник, продажи и маркетинг
            </span>
            <span>
              <b>ЧТО ПОЛУЧАЕТЕ</b>Новых клиентов из уже знакомого круга
            </span>
          </div>
          <div className="lp-hero-actions">
            <a
              className="lp-primary"
              href={dashboardHref}
              data-track="hero_primary"
            >
              {user ? "Открыть кабинет" : "Запустить рекомендации бесплатно"}
              <span>↗</span>
            </a>
            <a className="lp-secondary" href="#how" data-track="hero_secondary">
              Посмотреть пример <span>↓</span>
            </a>
          </div>
          <p className="lp-cta-note">
            Это не биржа. Вы приглашаете своих клиентов, партнёров и знакомых.
          </p>
          <div className="lp-hero-facts">
            <span>
              <b>0 ₸</b> за отклонённые заявки
            </span>
            <span>
              <b>100%</b> решений остаются за вами
            </span>
            <span>
              <b>1</b> список клиентов и выплат
            </span>
          </div>
        </div>
        <div className="lp-demo" aria-label="Пример страницы заданий RiseStaff">
          <div className="lp-demo-top">
            <div>
              <MarketingLogo />
              <b>RiseStaff</b>
            </div>
            <span>
              ПРОГРАММА АКТИВНА <i>●</i>
            </span>
          </div>
          <div className="lp-demo-heading">
            <div>
              <small>ЗАЯВКА №14 · ПРИМЕР</small>
              <h2>Образовательный центр Qadam</h2>
            </div>
            <span>НУЖНО РЕШЕНИЕ</span>
          </div>
          <div className="lp-lead-example">
            <dl>
              <div><dt>Контакт</dt><dd>Алия · +7 701 000 00 00</dd></div>
              <div><dt>Кто привёл</dt><dd>Данияр Т. · родитель ученика</dd></div>
              <div><dt>Что нужно</dt><dd>Годовой курс английского для подростка</dd></div>
              <div><dt>Сумма сделки</dt><dd>600 000 ₸</dd></div>
            </dl>
            <div><span>К ВЫПЛАТЕ ПО ВАШЕМУ ПРАВИЛУ</span><strong>25 000 ₸</strong></div>
            <nav aria-label="Действия с примером заявки"><button type="button">Не подходит</button><button type="button">Принять заявку</button></nav>
          </div>
          <div className="lp-demo-event">
            <i>✓</i>
            <div>
              <strong>Видно, кто привёл клиента</strong>
              <span>Условия и сумма не теряются в переписке</span>
            </div>
            <b>сейчас</b>
          </div>
        </div>
      </section>

      <section className="lp-trust-line" aria-label="Ключевые свойства">
        <div className="lp-marquee-track">
          {[0, 1].map((copy) => (
            <div className="lp-marquee-set" aria-hidden={copy === 1} key={copy}>
              <span>
                <b>01</b>Кого вы ищете
              </span>
              <span>
                <b>02</b>Кто привёл клиента
              </span>
              <span>
                <b>03</b>Что стало с заявкой
              </span>
              <span>
                <b>04</b>Сколько нужно выплатить
              </span>
            </div>
          ))}
        </div>
      </section>
      <section className="lp-problem lp-section">
        <i className="lp-motion-orbit orbit-black" aria-hidden="true" />
        <div className="lp-section-intro">
          <span>ЭТО ПРО ВАС, ЕСЛИ…</span>
          <h2>Клиенты уже приходят по знакомству, но этим каналом никто не управляет.</h2>
          <p>
            Узнали себя хотя бы в двух пунктах? Значит, рекомендации уже работают.
            RiseStaff помогает сделать их понятным каналом продаж.
          </p>
        </div>
        <div className="lp-compare">
          <article className="lp-before">
            <small>СЕЙЧАС</small>
            <h3>Договорённости живут в чатах и памяти</h3>
            <ul>
              <li>Клиента прислали в WhatsApp, менеджер забыл перенести контакт</li>
              <li>Через месяц начинается спор: кто именно привёл покупателя</li>
              <li>Обещанный процент ищут в старой переписке</li>
              <li>Бухгалтер сводит суммы вручную перед выплатой</li>
            </ul>
            <strong>Непонятно, сколько денег дают рекомендации</strong>
          </article>
          <article className="lp-after">
            <small>С RISESTAFF</small>
            <h3>Каждая заявка сразу попадает в один список</h3>
            <ul>
              <li>Видны контакт, дата и человек, который его прислал</li>
              <li>Правило и сумма заранее видны обеим сторонам</li>
              <li>Вы принимаете заявку или объясняете отказ</li>
              <li>Сумма к выплате считается по вашему правилу</li>
            </ul>
            <strong>Видно: заявки, сделки, выплаты и прибыль канала</strong>
          </article>
        </div>
      </section>

      <section className="lp-example lp-section" id="example">
        <div className="lp-section-intro">
          <span>ОДИН ПРИМЕР С ЦИФРАМИ</span>
          <h2>Допустим, образовательный центр продаёт годовой курс за 600 000 ₸.</h2>
          <p>Центр хочет получать новых учеников через родителей, выпускников и преподавателей.</p>
        </div>
        <div className="lp-example-steps">
          <article><b>01</b><h3>Назначили вознаграждение</h3><p>«Приведи ученика на годовой курс. Платим 25 000 ₸ после первой оплаты».</p><strong>25 000 ₸ за ученика</strong></article>
          <article><b>02</b><h3>Отправили одну ссылку</h3><p>Родителям учеников, выпускникам и преподавателям. Одно сообщение в WhatsApp.</p><strong>30 человек</strong></article>
          <article><b>03</b><h3>Получили заявки</h3><p>По каждой сразу видны контакт, комментарий, дата и кто привёл.</p><strong>6 заявок</strong></article>
          <article><b>04</b><h3>Получили новых учеников</h3><p>Четыре семьи оплатили годовую программу. Центр получил 2 400 000 ₸ выручки.</p><strong>100 000 ₸ к выплате</strong></article>
        </div>
        <div className="lp-example-total"><span>В ЭТОМ ПРИМЕРЕ</span><strong>Рекомендации принесли 2 400 000 ₸. Вознаграждения — 100 000 ₸. За неподходящие заявки центр не платил.</strong></div>
      </section>

      <section className="lp-ai lp-section" id="product">
        <i className="lp-motion-orbit orbit-gray" aria-hidden="true" />
        <figure className="lp-ai-visual lp-live-screen">
          <div className="lp-live-screen-label">
            <span>РЕАЛЬНЫЙ КАБИНЕТ КОМПАНИИ</span>
            <b>Рабочий стол RiseStaff</b>
          </div>
          <div className="lp-screen-wrap">
            <img
              src="/company-cabinet.jpg?v=20260902"
              width="1138"
              height="904"
              loading="lazy"
              alt="Рабочий стол компании в RiseStaff с заявками, приглашёнными участниками и выплатами"
            />
            <div className="lp-screen-callouts" aria-hidden="true">
              <span>Кто привёл</span>
              <span>Заявки на проверке</span>
              <span>Суммы к выплате</span>
            </div>
          </div>
        </figure>
        <div className="lp-ai-copy">
          <span>ВЫРУЧКА ОТ РЕКОМЕНДАЦИЙ ПОД КОНТРОЛЕМ</span>
          <h2>Вы знаете, кто приводит клиентов и сколько приносит этот канал.</h2>
          <p>
            Каждая заявка хранит контакт, дату, имя рекомендателя и ваше решение.
            Принятые суммы сразу попадают в список выплат.
          </p>
          <ul>
            <li>Новые контакты не теряются в WhatsApp</li>
            <li>Вы платите только за результат по своим правилам</li>
            <li>В любой момент видны выручка и сумма вознаграждений</li>
          </ul>
          <small>На изображении — рабочий кабинет компании RiseStaff.</small>
        </div>
      </section>

      <section className="lp-how lp-section" id="how">
        <div className="lp-section-intro light">
          <span>КАК ЭТО РАБОТАЕТ</span>
          <h2>Подключите первых рекомендателей за четыре понятных шага.</h2>
        </div>
        <span className="lp-swipe-hint">Листайте шаги →</span>
        <div className="lp-steps">
          <article>
            <b>01</b>
            <div className="lp-step-visual lp-step-program" aria-hidden="true">
              <div className="lp-step-window">
                <span>
                  <i />
                  <i />
                  <i />
                </span>
                <small>НОВАЯ ПРОГРАММА</small>
                <strong>Новые клиенты</strong>
                <em>Создать&nbsp; +</em>
              </div>
            </div>
            <small>СКАЖИТЕ ОБЫЧНЫМИ СЛОВАМИ</small>
            <h3>Скажите, кто вам нужен</h3>
            <p>
              Например: «стоматология в Алматы, минимум три кресла».
            </p>
          </article>
          <article>
            <b>02</b>
            <div className="lp-step-visual lp-step-tasks" aria-hidden="true">
              <div>
                <span>01</span>
                <strong>Найти клиента</strong>
                <em>15 000 ₸</em>
              </div>
              <div>
                <span>02</span>
                <strong>Закрыть сделку</strong>
                <em>15%</em>
              </div>
            </div>
            <small>ФИКСИРОВАННАЯ СУММА ИЛИ ПРОЦЕНТ</small>
            <h3>Назначьте цену</h3>
            <p>
              Например, 30 000 ₸ за встречу или 10% с первой оплаты.
            </p>
          </article>
          <article>
            <b>03</b>
            <div className="lp-step-visual lp-step-invite" aria-hidden="true">
              <div className="lp-step-link">
                <span>risestaff.kz/p/...</span>
                <b>↗</b>
              </div>
              <div className="lp-step-avatars">
                <i>А</i>
                <i>Б</i>
                <i>К</i>
                <em>+12 амбассадоров</em>
              </div>
            </div>
            <small>ОДНА ССЫЛКА В WHATSAPP</small>
            <h3>Отправьте ссылку своим людям</h3>
            <p>
              Человек открывает её в браузере. Ничего устанавливать не нужно.
            </p>
          </article>
          <article>
            <b>04</b>
            <div className="lp-step-visual lp-step-result" aria-hidden="true">
              <div>
                <span>Получен</span>
                <i />
                <span>Проверен</span>
                <i />
                <span>Оплачен</span>
              </div>
              <strong>15 000 ₸</strong>
              <small>ВОЗНАГРАЖДЕНИЕ</small>
            </div>
            <small>РЕШЕНИЕ ОСТАЁТСЯ ЗА ВАМИ</small>
            <h3>Примите заявку и заплатите</h3>
            <p>
              Вы видите контакт, нажимаете «принять» или «не подходит» и пишете причину.
            </p>
          </article>
        </div>
      </section>

      <section className="lp-partner lp-section" id="partners">
        <i className="lp-motion-orbit orbit-lime" aria-hidden="true" />
        <div className="lp-partner-copy">
          <span>ЧТО ВИДИТ ТОТ, КТО ВАС РЕКОМЕНДУЕТ</span>
          <h2>Люди охотнее рекомендуют вас, когда правила понятны.</h2>
          <p>
            Он видит, кого вы ищете, сколько платите и что стало с его заявкой.
            Кабинет открывается по ссылке в браузере.
          </p>
          <ul className="lp-agent-benefits">
            <li>Видит сумму до того, как начал искать</li>
            <li>Передаёт контакт голосом, текстом или файлами</li>
            <li>Видит ваше решение и причину отказа</li>
          </ul>
        </div>
        <figure className="lp-partner-card lp-live-screen lp-agent-live-screen">
          <div className="lp-live-screen-label">
            <span>КАБИНЕТ ПО ПРИГЛАШЕНИЮ</span>
            <b>Кого ищет компания и сколько платит</b>
          </div>
          <div className="lp-screen-wrap">
            <img
              src="/agent-cabinet.jpg?v=20260902"
              width="1138"
              height="904"
              loading="lazy"
              alt="Кабинет приглашённого участника RiseStaff с задачами и суммами вознаграждения"
            />
            <div className="lp-screen-callouts agent" aria-hidden="true">
              <span>Кого искать</span>
              <span>Сколько платят</span>
              <span>Что стало с заявкой</span>
            </div>
          </div>
        </figure>
      </section>

      <section className="lp-agent-sources lp-section">
        <div className="lp-section-intro">
          <span>«У МЕНЯ НЕТ НИКАКИХ АГЕНТОВ»</span>
          <h2>Есть. Просто вы их так не называли.</h2>
          <p>
            Начните с людей, которые уже знают вашу работу и встречают ваших будущих клиентов.
          </p>
        </div>
        <div className="lp-source-grid">
          <article>
            <b>01</b>
            <h3>Клиенты</h3>
            <p>Обычно дают 60–70% первых рекомендаций: уже знают продукт и доверяют вам.</p>
          </article>
          <article>
            <b>02</b>
            <h3>Партнёры</h3>
            <p>Бухгалтер, юрист, дизайнер или подрядчик работает с той же аудиторией.</p>
          </article>
          <article>
            <b>03</b>
            <h3>Консультанты</h3>
            <p>Им уже платят за совет. Рекомендация естественно входит в разговор.</p>
          </article>
          <article>
            <b>04</b>
            <h3>Команда и знакомые</h3>
            <p>Те, кому вы уже говорите: «если услышишь о такой задаче — скажи».</p>
          </article>
        </div>
        <p className="lp-marketplace-note">
          <strong>RiseStaff — не биржа людей.</strong> Вы приглашаете своих. Сервис даёт
          им понятные правила, ссылку для передачи контакта и статус каждой заявки.
        </p>
      </section>

      <section className="lp-offer lp-section" id="offer">
        <div className="lp-offer-copy">
          <span>ПИЛОТНЫЙ ЗАПУСК · ТОЛЬКО 20 КОМПАНИЙ</span>
          <h2>Запустите рекомендации без долгой настройки.</h2>
          <p>
            Разберём ваш продукт, напишем правила и подготовим ссылку. За настройку
            денег не берём — нам нужны ваши первые заявки и честная обратная связь.
          </p>
          <ul>
            <li>Напишем, кого вы ищете и за что платите</li>
            <li>Подготовим форму заявки для приглашённых людей</li>
            <li>Покажем, как принимать заявки и отмечать выплаты</li>
            <li>ИИ соберёт черновик, а вы проверите каждую строку</li>
          </ul>
          <div className="lp-offer-actions">
            <a
              className="lp-primary"
              href={dashboardHref}
              data-track="offer_primary"
            >
              {user ? "Перейти к программам" : "Запустить программу бесплатно"}
              <span>↗</span>
            </a>
            <a href="#company-application" data-track="application_offer">Обсудить запуск →</a>
          </div>
        </div>
        <ol className="lp-offer-steps">
          <li>
            <b>01</b>
            <span>
              <strong>Опишите покупателя</strong>Кто вам нужен и почему он подходит.
            </span>
          </li>
          <li>
            <b>02</b>
            <span>
              <strong>Назначьте сумму</strong>Фиксированная выплата или процент.
            </span>
          </li>
          <li>
            <b>03</b>
            <span>
              <strong>Проверьте правила</strong>ИИ подготовит текст, вы его подтвердите.
            </span>
          </li>
          <li>
            <b>04</b>
            <span>
              <strong>Отправьте ссылку</strong>Клиентам, партнёрам и знакомым.
            </span>
          </li>
        </ol>
      </section>

      <MarketingSpecialOffer />
      <section className="lp-payments lp-section" id="payments">
        <div className="lp-section-intro">
          <span>ДЕНЬГИ И ОФОРМЛЕНИЕ В КАЗАХСТАНЕ</span>
          <h2>Вы заранее знаете, кому, за что и сколько платить.</h2>
          <p>Сервис не берёт процент с вознаграждений и не выступает стороной вашей выплаты.</p>
        </div>
        <div className="lp-payment-grid">
          <article><b>01</b><h3>Физическому лицу</h3><p>Обычно компания проверяет договор ГПХ и обязательные платежи. Порядок зависит от вида работы и статуса получателя.</p></article>
          <article><b>02</b><h3>ИП или компании</h3><p>Используйте договор и документы, которые приняты у вас для работы с подрядчиками.</p></article>
          <article><b>03</b><h3>Что хранит RiseStaff</h3><p>Кто привёл клиента, за что начислена сумма, дата решения и отметка о выплате.</p></article>
        </div>
        <p className="lp-payment-note">RiseStaff не даёт налоговых консультаций. Перед запуском согласуйте схему выплат с бухгалтером.</p>
      </section>

      <CompanyApplicationForm />
      <section className="lp-faq lp-section" id="faq">
        <div className="lp-section-intro">
          <span>ВОПРОСЫ И ОТВЕТЫ</span>
          <h2>Что нужно знать перед запуском.</h2>
        </div>
        <div className="lp-faq-list">
          {faqs.map(([question, answer], index) => (
            <details key={question}>
              <summary>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{question}</strong>
                <i>+</i>
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="lp-final">
        <div className="lp-final-tiles" aria-hidden="true">
          {missionCards.map((card) => (
            <i className={`lp-${card.tone}`} key={card.index}>
              {card.icon}
            </i>
          ))}
        </div>
        <span>ПЕРВЫЕ РЕКОМЕНДАЦИИ МОГУТ ПРИЙТИ УЖЕ НА ЭТОЙ НЕДЕЛЕ</span>
        <h2>
          Подключите тех, кто уже готов рекомендовать вашу компанию.
        </h2>
        <p>
          Получайте новые контакты, принимайте подходящих и платите только за результат.
        </p>
        <div className="lp-final-actions">
          <a className="lp-primary" href={dashboardHref} data-track="final_primary">{user ? "Открыть кабинет" : "Запустить программу бесплатно"}<span>↗</span></a>
          <a className="lp-final-secondary" href="#company-application" data-track="final_application">Оставить заявку</a>
        </div>
      </section>
      <a
        className="lp-mobile-sticky-cta"
        href={dashboardHref}
        data-track="mobile_sticky"
      >
        {user ? "Открыть кабинет" : "Запустить бесплатно"}
        <span>↗</span>
      </a>
      <footer className="lp-footer">
        <div>
          <Link className="lp-brand" href="/">
            <MarketingLogo />
            <span>RiseStaff</span>
          </Link>
          <p>
            Новые клиенты через рекомендации тех, кто вам доверяет.
            <br />
            Казахстан ·{" "}
            <a href={whatsappHref} target="_blank" rel="noreferrer">
              WhatsApp +7 776 508 6000
            </a>
          </p>
        </div>
        <nav>
          <a href="#how">Как работает</a>
          <a href="#example">Пример</a>
          <a href="#payments">Выплаты</a>
          <Link href="/integrators">Интеграторам</Link>
          <a href="#faq">FAQ</a>
          <Link href="/legal/privacy">Конфиденциальность</Link>
          <Link href="/legal/license">Соглашение</Link>
        </nav>
        <span>© 2026 RiseStaff</span>
      </footer>
    </main>
  );
}

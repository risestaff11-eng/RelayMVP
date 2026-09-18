import type { Metadata } from "next";
import { SafeLink as Link } from "@/app/safe-link";
import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";
import { MarketingAnalytics } from "./marketing-analytics";
import { MarketingLogo } from "./marketing-logo";
import { PAID_PLANS } from "@/lib/subscription-plans";
import { countRu, formatInteger } from "@/lib/format-display";
import { CompanyApplicationForm } from "./company-application-form";
import { LandingExample } from "./landing-example";
import { agentUrl, companyUrl } from "../lib/public-origins";
import "./saas-landing.css";

export const metadata: Metadata = {
  title: { absolute: "RiseStaff: клиенты по рекомендациям, сделки и выплаты" },
  description: "Не теряйте рекомендованных клиентов в переписках. RiseStaff показывает, кто привёл клиента, что со сделкой и сколько нужно выплатить. 14 дней без карты.",
  alternates: { canonical: "https://risestaff.kz/" },
};
export const dynamic = "force-dynamic";

const faqs = [
  ["Где взять тех, кто будет нас рекомендовать?", "Начните с клиентов и партнёров, которые знают вашу работу. RiseStaff не ищет людей вместо вас и не продаёт базу агентов. Вы приглашаете своих и предлагаете понятные условия."],
  ["Что, если этот клиент уже есть у нас?", "Заранее укажите, каких клиентов вы принимаете. Например, только тех, кто ещё не оставлял заявку. В RiseStaff есть проверка дублей и история передачи. Решение о спорной заявке принимает компания."],
  ["Нужно переносить всю работу из нашей CRM?", "Нет. В RiseStaff можно вести только клиентов от рекомендателей. В тарифе «Масштаб» доступны API и вебхуки. Подключение к вашей CRM нужно настроить отдельно, готовую связь со всеми CRM мы не обещаем."],
  ["RiseStaff сам переводит вознаграждения?", "Нет. Вы переводите деньги своим способом и отмечаете перевод в системе. Рекомендатель отдельно подтверждает получение. Оформление выплат согласуйте со своим бухгалтером."],
  ["Что будет после 14 дней?", "Вы выбираете тариф и согласуете оплату. Активация выполняется вручную. Без вашего решения автоматического списания нет. Вознаграждения рекомендателям оплачиваются отдельно от подписки."],
  ["Что нужно подготовить для запуска?", "Решите, какой клиент вам подходит, за какое действие вы платите и сколько. Создайте программу, проверьте условия и отправьте ссылку первым рекомендателям."],
];
const planDescriptions = {
  STARTER: "Проверить одну программу рекомендаций.",
  GROWTH: "Вести несколько продуктов или направлений.",
  SCALE: "Связать программы с другими системами.",
};
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
      legalName: "ТОО «TR2»",
      telephone: "+77765086000",
      address: {
        "@type": "PostalAddress",
        streetAddress: "ул. Иманова 18/1",
        addressLocality: "Астана",
        addressCountry: "KZ",
      },
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
  const dashboardHref = companyUrl(user ? "/dashboard" : chatGPTSignInPath("/onboarding"));
  const loginHref = companyUrl(user ? "/dashboard" : chatGPTSignInPath("/dashboard"));
  const whatsappHref = "https://wa.me/77765086000?text=" + encodeURIComponent("Хочу обсудить программу рекомендаций в RiseStaff");
  const trialLabel = user ? "Открыть кабинет" : "Попробовать 14 дней";

  return <main className="rs-site">
    <MarketingAnalytics />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    <a className="skip-link" href="#main-content">К основному содержанию</a>
    <header className="rs-header rs-wrap">
      <Link className="rs-brand" href="/" aria-label="RiseStaff, главная"><MarketingLogo /><span>RiseStaff</span></Link>
      <nav aria-label="Основная навигация">
        <a href="#how">Как работает</a><a href="#payments">Выплаты</a><a href="#pricing">Тарифы</a>
      </nav>
      <div className="rs-header-actions">
        <a href={loginHref}>Войти</a>
        <a className="rs-button" href={dashboardHref} data-track="header_primary">{user ? "Кабинет" : "14 дней бесплатно"}</a>
      </div>
    </header>

    <section className="rs-hero rs-wrap" id="main-content">
      <div className="rs-hero-copy">
        <span className="rs-eyebrow">Для компаний, которых рекомендуют</span>
        <h1>Не теряйте клиентов <span>после рекомендации.</span></h1>
        <p>Контакт, сделка и вознаграждение в одном месте. Вы видите, кто привёл клиента, что с продажей и кому пора платить.</p>
        <div className="rs-actions">
          <a className="rs-button" href={dashboardHref} data-track="hero_primary">{trialLabel}<span aria-hidden="true">↗</span></a>
          <a className="rs-button rs-button-light" href="#company-application" data-track="application_header">Обсудить мою задачу</a>
        </div>
        <p className="rs-trial-note">Без карты и автоматического списания.</p>
      </div>
      <div id="example"><LandingExample /></div>
    </section>

    <div className="rs-fit rs-wrap" aria-label="Кому подходит">
      <span>Когда клиенты приходят через людей</span>
      <strong>Образование</strong><strong>Услуги</strong><strong>Недвижимость</strong><strong>Продажи компаниям</strong>
    </div>

    <section className="rs-section rs-wrap">
      <div className="rs-heading">
        <div><span className="rs-eyebrow">Знакомая ситуация?</span><h2>Контакт в одном чате. Обещание заплатить в другом.</h2></div>
        <p>Чтобы разобраться в одной рекомендации, приходится искать сообщения и спрашивать менеджера. А человек, который привёл клиента, ждёт ответа.</p>
      </div>
      <div className="rs-pains">
        <article><h3>«Вы связались с моим клиентом?»</h3><p>Контакт переслали менеджеру. Прошла неделя. Непонятно, звонили ли ему и что он ответил.</p></article>
        <article><h3>«Вообще-то его привёл я»</h3><p>На одного клиента претендуют двое. В переписке приходится искать, кто и когда его передал.</p></article>
        <article><h3>«Когда будет моя выплата?»</h3><p>Клиент уже оплатил. Кто-то должен вспомнить об обещанном вознаграждении и посчитать сумму.</p></article>
      </div>
    </section>

    <section className="rs-section rs-dark" id="how">
      <div className="rs-wrap">
        <div className="rs-heading">
          <div><span className="rs-eyebrow">Работа в RiseStaff</span><h2>Одна заявка. Вся история до выплаты.</h2></div>
          <p>Вместо отдельной таблицы и поисков по чатам вы работаете с карточкой клиента. Рекомендатель видит результат у себя.</p>
        </div>
        <div className="rs-workflow">
          <article><span>01 / ПРИЁМ</span><h3>Получите контакт, а не пересланное сообщение</h3><p>Клиент, партнёр или знакомый открывает вашу ссылку и передаёт заявку. RiseStaff сохраняет, кто её отправил.</p><strong>Имя, контакты, комментарий и дата</strong></article>
          <article><span>02 / ПРОДАЖА</span><h3>Увидьте, на ком остановилась сделка</h3><p>Назначьте ответственного и следующий шаг. Перемещайте клиента по этапам CRM, отмечайте оплату и причины отказа.</p><strong>Этап, сумма и история решений</strong></article>
          <article><span>03 / ВОЗНАГРАЖДЕНИЕ</span><h3>Знайте, сколько и кому должны</h3><p>Укажите фиксированную сумму или процент и условия начисления. Согласованные суммы попадут в реестр выплат.</p><strong>Начислено, переведено, получено</strong></article>
        </div>
        <div className="rs-agent-note">
          <p>Рекомендателю не нужно разбираться в вашей CRM. В его кабинете есть условия, переданные клиенты и вознаграждения. Всё открывается в браузере.</p>
          <a href={agentUrl("/p/risestaff-13c34fa")} data-track="agent_login">Посмотреть со стороны агента ↗</a>
        </div>
      </div>
    </section>

    <section className="rs-section rs-wrap rs-money" id="payments">
      <div><span className="rs-eyebrow">Правила до первой заявки</span><h2>Платите за то, о чём договорились.</h2><p>За подходящий контакт, встречу или оплаченную сделку. Вы задаёте условия и принимаете решение по каждой заявке.</p><p>RiseStaff учитывает обязательства. Деньги переводит ваша компания, получение подтверждает рекомендатель.</p><div className="rs-actions"><a href="#company-application" className="rs-button rs-button-light" data-track="application_offer">Обсудить условия программы</a></div></div>
      <dl className="rs-money-list">
        <div><dt>01</dt><dd><strong>Кого вы считаете новым клиентом</strong><span>Например, ученик, который ещё не оставлял заявку в вашем учебном центре.</span></dd></div>
        <div><dt>02</dt><dd><strong>За какое действие платите</strong><span>Например, 25 000 ₸ после оплаты годового курса. Переданный телефон сам по себе не означает выплату.</span></dd></div>
        <div><dt>03</dt><dd><strong>Когда проверите и выплатите</strong><span>Задайте сроки, чтобы команда видела просрочки, а рекомендатели знали, чего ждать.</span></dd></div>
      </dl>
    </section>

    <section className="rs-section rs-pricing" id="pricing">
      <div className="rs-wrap">
        <div className="rs-heading">
          <div><span className="rs-eyebrow">Стоимость</span><h2>Сначала проверьте на своей программе.</h2></div>
          <p>14 дней без карты. Пригласите своих рекомендателей и пройдите путь от контакта до выплаты. Затем выберите тариф.</p>
        </div>
        <div className="rs-plans">{PAID_PLANS.map((plan) => <article className="rs-plan" key={plan.code}>
          <h3>{plan.name}</h3><p>{planDescriptions[plan.code]}</p>
          <div className="rs-plan-price"><strong>{formatInteger(plan.price)} ₸</strong><span>за 30 дней</span></div>
          <ul><li>{countRu(plan.programs, "работающая программа", "работающие программы", "работающих программ")}</li><li>CRM, аналитика и выплаты</li><li>Экспорт данных</li>{plan.reports && <li>Отчёты агентов</li>}{plan.integrations && <li>API и вебхуки</li>}</ul>
          <a className="rs-button rs-button-light" href={dashboardHref} data-track="pricing_link">{trialLabel}</a>
          <details><summary>Лимит помощника</summary><p>{formatInteger(plan.credits)} AI-кредитов. Расход зависит от действия и объёма текста.</p></details>
        </article>)}</div>
        <p className="rs-pricing-note">Количество агентов и заявок не ограничено. Вознаграждения агентам оплачиваются отдельно. Тариф активируем после согласования и оплаты.</p>
      </div>
    </section>

    <section className="rs-section rs-wrap rs-faq" id="faq">
      <div><span className="rs-eyebrow">Перед запуском</span><h2>Что важно знать.</h2></div>
      <div className="rs-faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
    </section>

    <CompanyApplicationForm />

    <footer className="rs-footer rs-wrap">
      <div><Link className="rs-brand" href="/"><MarketingLogo /><span>RiseStaff</span></Link><p>ТОО «TR2» · Казахстан<br /><a href={whatsappHref} data-track="whatsapp_header">+7 776 508 60 00</a></p></div>
      <nav aria-label="Дополнительные ссылки"><a href={agentUrl("/p/risestaff-13c34fa")} data-track="agent_login">Заработать на рекомендациях</a><Link href="/integrators">Интеграторам</Link><a href="#pricing">Тарифы</a><Link href="/legal/privacy">Конфиденциальность</Link><Link href="/legal/license">Соглашение</Link></nav>
    </footer>
  </main>;
}

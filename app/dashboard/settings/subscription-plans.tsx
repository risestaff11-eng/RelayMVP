import { PAID_PLANS, subscriptionState, type SubscriptionFields } from "@/lib/subscription-plans";
import { formatInteger, formatDateTimeSeconds } from "@/lib/format-display";

export function SubscriptionPlans({ company }: { company: SubscriptionFields }) {
  const state = subscriptionState(company);
  return <section className="plan-section" id="subscription">
    <div className="subscription-current"><h2>{state.name}</h2><p>{state.legacy ? "Действующий доступ сохранён. Согласуйте тариф и срок с RiseStaff." : state.active ? <>Доступ до {formatDateTimeSeconds(state.endsAt!)}.</> : "Срок доступа завершён. Все данные доступны для просмотра и экспорта."}</p><p>После окончания периода можно завершить расчёты по ранее начисленным выплатам.</p></div>
    <div className="plan-section-heading"><h2>Тарифы RiseStaff</h2><span>14 дней без карты</span></div>
    <p>В пробный период: 5 работающих программ, отчёты, интеграции и 50 000 AI-кредитов. Автоматических списаний нет.</p>
    <div className="plan-grid">{PAID_PLANS.map((plan) => <article className={`plan-card ${state.active && company.planCode === plan.code ? "active" : ""}`} key={plan.code}>
      <span className="plan-name">{plan.name}</span><strong>{formatInteger(plan.price)} ₸</strong><p>за 30 дней</p>
      <ul><li>Работающих программ: {plan.programs}</li><li>CRM, агенты и заявки без ограничения количества</li><li>Выплаты, уведомления, аналитика и экспорт</li><li>{formatInteger(plan.credits)} AI-кредитов на оплаченный период</li><li>{plan.reports ? "Отчёты агентов и их AI-анализ" : "Отчёты агентов — на тарифе «Рост»"}</li><li>{plan.integrations ? "API и исходящие вебхуки" : "API и вебхуки — на тарифе «Масштаб»"}</li></ul>
      <a className="button button-primary" href={`https://wa.me/77765086000?text=${encodeURIComponent(`Хочу подключить RiseStaff: тариф ${plan.name}`)}`} target="_blank" rel="noreferrer">Обсудить подключение</a>
    </article>)}</div>
    <p className="billing-disclaimer">После согласования и оплаты RiseStaff активирует доступ вручную. Опубликованные программы и программы на паузе входят в лимит. Архив и черновики не входят. При переходе на меньший тариф данные сохраняются. Вознаграждения агентам оплачиваются отдельно.</p>
  </section>;
}

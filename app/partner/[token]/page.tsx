import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPartnerPortal } from "../../../db/partner";
import { SafeLink as Link } from "@/app/safe-link";
import { money, shortDate, statusNames, typeNames } from "../_lib";

export const metadata: Metadata = { title: "Кабинет агента" };

export default async function PartnerHome({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const portal = await getPartnerPortal(token);
  if (!portal) notFound();

  const available = portal.rewards.filter((item) => item.status === "APPROVED").reduce((sum, item) => sum + item.amount, 0);
  const expected = portal.rewards.filter((item) => item.status === "PENDING").reduce((sum, item) => sum + item.amount, 0);
  const earned = portal.rewards.filter((item) => item.status === "PAID").reduce((sum, item) => sum + item.amount, 0);
  const acceptedCount = portal.submissions.filter((item) => ["ACCEPTED", "IN_PROGRESS", "DEAL", "REWARDED"].includes(item.status)).length;
  const verifiedCount = Number(Boolean(portal.profile.emailVerifiedAt)) + Number(Boolean(portal.profile.whatsappVerifiedAt));
  const progress = Math.round(((verifiedCount + Number(acceptedCount > 0)) / 3) * 100);
  const recommended = portal.missions.find((mission) => mission.status === "ACTIVE") ?? portal.missions[0];
  const recentEvents = portal.submissions.flatMap((submission) => submission.events.map((event) => ({ ...event, submission }))).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);
  const deadline = portal.program.expiresAt ? `до ${new Date(portal.program.expiresAt).toLocaleDateString("ru-RU")}` : "без дедлайна";

  const activeAcceptance = portal.acceptances.find((item) => item.status === "ACTIVE");
  const acceptedMission = activeAcceptance ? portal.missions.find((mission) => mission.id === activeAcceptance.missionId) : null;
  const acceptedMissionResult = acceptedMission ? portal.submissions.find((submission) => submission.missionId === acceptedMission.id) : null;
  const contactsVerified = Boolean(portal.profile.emailVerifiedAt && portal.profile.whatsappVerifiedAt);
  const guide = !contactsVerified
    ? { step: 1, eyebrow: "ШАГ 1 ИЗ 4", title: "Подтвердите контакты", text: "Это нужно для защиты аккаунта и перехода на следующий уровень.", action: "Перейти в профиль", href: `/partner/${token}/profile` }
    : !acceptedMission && portal.submissions.length === 0
      ? { step: 2, eyebrow: "ШАГ 2 ИЗ 4", title: "Выберите первое задание", text: "Посмотрите условия, награду и возьмите одно понятное задание.", action: "Выбрать задание", href: `/partner/${token}/opportunities` }
      : acceptedMission && !acceptedMissionResult
        ? { step: 3, eyebrow: "ШАГ 3 ИЗ 4", title: "Передайте результат", text: `${acceptedMission.title}. Всё необходимое заполняется за два коротких шага.`, action: "Передать результат", href: `/p/${portal.program.slug}/missions/${acceptedMission.id}/submit?access=${token}` }
        : { step: 4, eyebrow: "ШАГ 4 ИЗ 4", title: "Следите за результатом", text: "Компания проверяет данные. Все изменения статуса и комментарии появятся в одном месте.", action: "Открыть результат", href: `/partner/${token}/submissions` };
  const journey = [
    { title: "Подтвердите контакты", text: "Защитите аккаунт и подготовьте профиль к следующему уровню.", href: `/partner/${token}/profile`, action: "Открыть профиль" },
    { title: "Выберите задание", text: "Сравните условия и возьмите одно понятное задание в работу.", href: `/partner/${token}/opportunities`, action: "Выбрать задание" },
    { title: "Передайте результат", text: acceptedMission ? acceptedMission.title : "Добавьте контакт и контекст, чтобы компания могла быстро всё проверить.", href: acceptedMission ? `/p/${portal.program.slug}/missions/${acceptedMission.id}/submit?access=${token}` : `/partner/${token}/missions`, action: "Передать результат" },
    { title: "Следите за статусом", text: "Решение компании, комментарии и начисление сохраняются в одной истории.", href: `/partner/${token}/submissions`, action: "Открыть результаты" },
  ];

  return (
    <div className="partner-portal-content partner-home-page">
      <div className="partner-welcome">
        <div><span>ДОБРО ПОЖАЛОВАТЬ</span><h1>{portal.profile.firstName || "Агент"}, ваш путь к первой выплате</h1><p>Здесь только действия, которые помогают заработать и сохранить прозрачность каждой рекомендации.</p></div>
        <Link className="button button-primary" href={`/p/${portal.program.slug}?access=${token}`}>Передать новый результат <span>↗</span></Link>
      </div>

      <section className="mobile-agent-roadmap" aria-label="Путь к первой выплате">
        <header><small>ВАШ МАРШРУТ</small><h2>Четыре шага к первой выплате</h2><p>Relay показывает только то, что нужно сделать дальше.</p></header>
        <div>{journey.map((item, index) => { const step = index + 1; const state = step < guide.step ? "done" : step === guide.step ? "current" : "ahead"; return <article className={state} key={item.title}><div className="mobile-roadmap-top"><span>{step < guide.step ? "✓" : `0${step}`}</span><small>{state === "done" ? "ВЫПОЛНЕНО" : state === "current" ? "СЛЕДУЮЩИЙ ШАГ" : "ДАЛЬШЕ"}</small></div><h3>{item.title}</h3><p>{item.text}</p>{step === 3 && acceptedMission && <strong className="mobile-roadmap-reward">Награда: {acceptedMission.rewardLabel}</strong>}{state !== "ahead" ? <Link href={item.href}>{state === "current" ? item.action : "Посмотреть"}<span>→</span></Link> : <span className="mobile-roadmap-locked">Откроется после предыдущего шага</span>}</article>; })}</div>
      </section>

      <section className="mobile-agent-balance">
        <div><small>ДОСТУПНО К ВЫПЛАТЕ</small><strong>{money(available, portal.program.currency)}</strong><span>Ожидается: {money(expected, portal.program.currency)}</span></div>
        <Link href={`/partner/${token}/payouts`}>Все выплаты →</Link>
      </section>

      <section className="partner-wallet-grid">
        <article className="wallet-card available"><small>ДОСТУПНО К ВЫПЛАТЕ</small><strong>{money(available, portal.program.currency)}</strong><span>Подтверждено компанией</span></article>
        <article className="wallet-card"><small>ОЖИДАЕТСЯ</small><strong>{money(expected, portal.program.currency)}</strong><span>Результаты на пути к начислению</span></article>
        <article className="wallet-card"><small>ЗАРАБОТАНО ЗА ВСЁ ВРЕМЯ</small><strong>{money(earned, portal.program.currency)}</strong><span>Отмечено выплаченным</span></article>
        <article className="wallet-card level"><small>ТЕКУЩИЙ УРОВЕНЬ</small><strong>{portal.profile.level === 1 ? "Навигатор" : "Проверенный"}</strong><span>Уровень {portal.profile.level}</span></article>
      </section>

      <section className="partner-home-grid">
        <div className="partner-home-primary">
          {recommended && <article className={`partner-featured-mission type-${recommended.type.toLowerCase()}`}>
            <div className="featured-mission-top"><span>РЕКОМЕНДУЕМОЕ ЗАДАНИЕ</span><b>{typeNames[recommended.type]}</b></div>
            <h2>{recommended.title}</h2><p>{recommended.description}</p>
            <div className="featured-reward"><small>НАГРАДА</small><strong>{recommended.rewardLabel}</strong></div>
            <Link href={`/p/${portal.program.slug}?access=${token}#missions`}>Открыть задание <span>→</span></Link>
          </article>}
          <section className="partner-feed-card">
            <div className="partner-section-title"><div><span>ЖИВАЯ ИСТОРИЯ</span><h2>Последние изменения</h2></div><Link href={`/partner/${token}/submissions`}>Вся воронка →</Link></div>
            {recentEvents.length ? <div className="partner-activity-feed">{recentEvents.map((event) => <div key={event.id}><i>●</i><div><strong>{event.submission.contactCompany} · {statusNames[event.toStatus] ?? event.toStatus}</strong><p>{event.comment || "Статус рекомендации изменён"}</p><small>{shortDate(event.createdAt)}</small></div></div>)}</div> : <div className="partner-empty-state"><span>↗</span><strong>История начнётся с первой рекомендации</strong><p>После отправки каждое изменение статуса появится здесь.</p></div>}
          </section>
        </div>
        <aside className="partner-home-side">
          <section className="level-progress-card"><span>СЛЕДУЮЩИЙ УРОВЕНЬ</span><h2>Проверенный агент</h2><p>Подтвердите email и WhatsApp, затем получите первый принятый лид.</p><div><i style={{ width: `${progress}%` }} /></div><small>{verifiedCount + Number(acceptedCount > 0)}/3 условий выполнено</small><ul><li>{portal.profile.emailVerifiedAt ? "✓" : "○"} Email подтверждён</li><li>{portal.profile.whatsappVerifiedAt ? "✓" : "○"} WhatsApp подтверждён</li><li>{acceptedCount ? "✓" : "○"} Первый принятый лид</li></ul><Link className="level-profile-link" href={`/partner/${token}/profile`}>Подтвердить контакты →</Link></section>
          <section className="next-reward-card"><span>БЛИЖАЙШАЯ НАГРАДА</span>{portal.submissions[0] ? <><strong>{portal.submissions[0].mission?.rewardLabel || "После принятия"}</strong><p>{portal.submissions[0].contactCompany} · {statusNames[portal.submissions[0].status]}</p></> : <><strong>Первая выплата</strong><p>Выберите задание и передайте подходящий контакт.</p></>}<Link href={`/partner/${token}/payouts`}>Открыть выплаты →</Link></section>
          <section className="new-offers-card"><div><span>НОВЫЕ ПРЕДЛОЖЕНИЯ</span><b>{portal.missions.length}</b></div>{portal.missions.slice(0, 3).map((mission) => <Link href={`/p/${portal.program.slug}?access=${token}#missions`} key={mission.id}><i className={`type-dot-${mission.type.toLowerCase()}`} /><span className="offer-title"><strong>{mission.title}</strong><small>Дедлайн: {deadline}</small></span><span>→</span></Link>)}</section>
        </aside>
      </section>
    </div>
  );
}

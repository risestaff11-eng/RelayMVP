import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPartnerPortal } from "../../../db/partner";
import { SafeLink as Link } from "@/app/safe-link";
import { shortDate, statusNames, typeNames } from "../_lib";
import { countRu, formatMoneyGroups } from "@/lib/format-display";

export const metadata: Metadata = { title: "Кабинет агента" };

export default async function PartnerHome({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const portal = await getPartnerPortal(token);
  if (!portal) notFound();

  const available = portal.rewards.filter((item) => item.status === "APPROVED");
  const expected = portal.rewards.filter((item) => item.status === "PENDING");
  const earned = portal.rewards.filter((item) => item.status === "PAID" && item.partnerConfirmedAt);
  if (portal.historyOnly) return <div className="partner-portal-content">
    <div className="partner-page-heading"><div><h1>История заявок и выплат</h1><p>Новые задания пока недоступны. Все ваши заявки и вознаграждения сохранены.</p></div></div>
    <section className="partner-wallet-grid">
      <article className="wallet-card available"><small>ДОСТУПНО К ВЫПЛАТЕ</small><strong>{formatMoneyGroups(available)}</strong><Link href={`/partner/${token}/payouts`}>Все выплаты →</Link></article>
      <article className="wallet-card"><small>ПОЛУЧЕНИЕ ПОДТВЕРЖДЕНО</small><strong>{formatMoneyGroups(earned)}</strong><Link href={`/partner/${token}/submissions`}>Мои заявки →</Link></article>
    </section>
  </div>;
  const activeMissionCount = portal.missions.filter((mission) => mission.status === "ACTIVE").length;
  const activeWorkCount = portal.acceptances.filter((item) => item.status === "ACTIVE").length;
  const bestReward = [...portal.missions].sort((left, right) => right.rewardValue - left.rewardValue)[0];
  const recommended = portal.missions.find((mission) => mission.status === "ACTIVE") ?? portal.missions[0];
  const recentEvents = portal.submissions.flatMap((submission) => submission.events.map((event) => ({ ...event, submission }))).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);

  const activeAcceptance = portal.acceptances.find((item) => item.status === "ACTIVE");
  const acceptedMission = activeAcceptance ? portal.missions.find((mission) => mission.id === activeAcceptance.missionId) : null;
  const acceptedMissionResult = acceptedMission ? portal.submissions.find((submission) => submission.missionId === acceptedMission.id) : null;
  const basicProfileReady = portal.profile.firstName.trim().length >= 2 && portal.partner.phone.trim().length >= 7;
  const guide = !basicProfileReady
    ? { step: 1, eyebrow: "ШАГ 1 ИЗ 4", title: "Добавьте имя и WhatsApp", text: "Этого достаточно, чтобы начать. Остальные поля можно заполнить позже.", action: "Перейти в профиль", href: `/partner/${token}/profile` }
    : !acceptedMission && portal.submissions.length === 0
      ? { step: 2, eyebrow: "ШАГ 2 ИЗ 4", title: "Выберите первое задание", text: "Посмотрите условия, награду и возьмите одно понятное задание.", action: "Выбрать задание", href: `/partner/${token}/opportunities` }
      : acceptedMission && !acceptedMissionResult
        ? { step: 3, eyebrow: "ШАГ 3 ИЗ 4", title: "Передайте результат", text: `${acceptedMission.title}. Всё необходимое заполняется за два коротких шага.`, action: "Передать результат", href: `/partner/${token}/submit/${acceptedMission.id}` }
        : { step: 4, eyebrow: "ШАГ 4 ИЗ 4", title: "Следите за результатом", text: "Компания проверяет данные. Все изменения статуса и комментарии появятся в одном месте.", action: "Открыть результат", href: `/partner/${token}/submissions` };
  const journey = [
    { title: "Добавьте имя и WhatsApp", text: "Два обязательных поля — и можно сразу переходить к заработку.", href: `/partner/${token}/profile`, action: "Открыть профиль" },
    { title: "Выберите задание", text: "Сравните условия и возьмите одно понятное задание в работу.", href: `/partner/${token}/opportunities`, action: "Выбрать задание" },
    { title: "Передайте результат", text: acceptedMission ? acceptedMission.title : "Добавьте контакт и контекст, чтобы компания могла быстро всё проверить.", href: acceptedMission ? `/partner/${token}/submit/${acceptedMission.id}` : `/partner/${token}/missions`, action: "Передать результат" },
    { title: "Следите за статусом", text: "Решение компании, комментарии и начисление сохраняются в одной истории.", href: `/partner/${token}/submissions`, action: "Открыть результаты" },
  ];
  const onboardingComplete = basicProfileReady && portal.submissions.length > 0;

  return (
    <div className="partner-portal-content partner-home-page">
      <div className="partner-welcome">
        <div><span>ЗАРАБАТЫВАЙТЕ НА РЕКОМЕНДАЦИЯХ</span><h1>{portal.profile.firstName || "Агент"}, знакомьте {<bdi data-no-translate>{portal.company.name}</bdi>} с нужными людьми и получайте вознаграждения</h1><p>Выберите понятное задание, порекомендуйте подходящего клиента и отслеживайте заработок до фактического получения денег.</p></div>
        <Link className="button button-primary" href={`/partner/${token}/opportunities`}>Передать лид или результат <span>↗</span></Link>
      </div>

      {onboardingComplete ? <section className="mobile-agent-progress-compact" aria-label="Онбординг завершён"><span>✓</span><div><small>БАЗОВАЯ НАСТРОЙКА ГОТОВА</small><strong>Передавайте новые результаты и следите за выплатами</strong></div><Link href={`/partner/${token}/submissions`}>Мои заявки →</Link></section> : <section className="mobile-agent-roadmap" aria-label="Путь к первой выплате">
        <header><small>ВАШ МАРШРУТ</small><h2>Четыре шага к первой выплате</h2><p>Все шаги доступны сразу. Начните с подсвеченного, либо откройте любой другой.</p></header>
        <div>{journey.map((item, index) => { const step = index + 1; const state = step < guide.step ? "done" : step === guide.step ? "current" : "ahead"; return <article className={state} key={item.title}><div className="mobile-roadmap-top"><span>{step < guide.step ? "✓" : `0${step}`}</span><small>{state === "done" ? "ВЫПОЛНЕНО" : state === "current" ? "СЛЕДУЮЩИЙ ШАГ" : "МОЖНО ОТКРЫТЬ"}</small></div><h3>{item.title}</h3><p>{item.text}</p>{step === 3 && acceptedMission && <strong className="mobile-roadmap-reward">Ваш заработок: {acceptedMission.rewardLabel}</strong>}<Link href={item.href}>{state === "current" ? item.action : state === "done" ? "Посмотреть" : "Перейти к шагу"}<span>→</span></Link></article>; })}</div>
      </section>}

      <section className="mobile-agent-balance">
        <div><small>ДОСТУПНО К ВЫПЛАТЕ</small><strong>{formatMoneyGroups(available)}</strong><span>Ожидается: {formatMoneyGroups(expected)}</span></div>
        <Link href={`/partner/${token}/payouts`}>Все выплаты →</Link>
      </section>

      <section className="partner-wallet-grid">
        <article className="wallet-card available"><small>ДОСТУПНО К ВЫПЛАТЕ</small><strong>{formatMoneyGroups(available)}</strong><span>Подтверждено компанией</span></article>
        <article className="wallet-card"><small>ОЖИДАЕТСЯ</small><strong>{formatMoneyGroups(expected)}</strong><span>Результаты на пути к начислению</span></article>
        <article className="wallet-card"><small>ЗАРАБОТАНО ЗА ВСЁ ВРЕМЯ</small><strong>{formatMoneyGroups(earned)}</strong><span>Получение подтверждено</span></article>
        <article className="wallet-card earning-potential"><small>ЛУЧШАЯ ВОЗМОЖНОСТЬ</small><strong>{bestReward?.rewardLabel || "Новые задания скоро"}</strong><span>{countRu(activeMissionCount, "задание доступно", "задания доступны", "заданий доступно")} сейчас</span></article>
      </section>

      <section className="partner-home-grid">
        <div className="partner-home-primary">
          {recommended && <article className={`partner-featured-mission type-${recommended.type.toLowerCase()}`}>
            <div className="featured-mission-top"><span>РЕКОМЕНДУЕМОЕ ЗАДАНИЕ</span><b>{typeNames[recommended.type]}</b></div>
            <h2>{recommended.title}</h2><p>{recommended.description}</p>
            <div className="featured-reward"><small>НАГРАДА</small><strong>{recommended.rewardLabel}</strong></div>
            <Link href={`/p/${recommended.programSlug}?access=${token}#missions`}>Открыть задание <span>→</span></Link>
          </article>}
          <section className="partner-feed-card">
            <div className="partner-section-title"><div><span>ЖИВАЯ ИСТОРИЯ</span><h2>Последние изменения</h2></div><Link href={`/partner/${token}/submissions`}>Вся воронка →</Link></div>
            {recentEvents.length ? <div className="partner-activity-feed">{recentEvents.map((event) => <div key={event.id}><i>●</i><div><strong>{<bdi data-no-translate>{event.submission.contactCompany}</bdi>} · {statusNames[event.toStatus] ?? event.toStatus}</strong><p>{event.comment || "Статус рекомендации изменён"}</p><small>{shortDate(event.createdAt)}</small></div></div>)}</div> : <div className="partner-empty-state"><span>↗</span><strong>История начнётся с первой рекомендации</strong><p>После отправки каждое изменение статуса появится здесь.</p></div>}
          </section>
        </div>
        <aside className="partner-home-side">
          <section className="earning-opportunity-card"><span>ПОТЕНЦИАЛ ЗАРАБОТКА</span><h2>{bestReward ? `До ${bestReward.rewardLabel} за одно задание` : "Ожидаем новые задания"}</h2><p>{activeMissionCount ? `Сейчас доступно ${countRu(activeMissionCount, "задание", "задания", "заданий")}. В работе: ${activeWorkCount}.` : "Компания пока не опубликовала активные задания."}</p><dl><div><dt>К выплате</dt><dd>{formatMoneyGroups(available)}</dd></div><div><dt>Получено</dt><dd>{formatMoneyGroups(earned)}</dd></div></dl><Link href={`/partner/${token}/opportunities`}>Открыть доступные задания →</Link></section>
          <section className="next-reward-card"><span>БЛИЖАЙШАЯ НАГРАДА</span>{portal.submissions[0] ? <><strong>{portal.submissions[0].mission?.rewardLabel || "После принятия"}</strong><p>{<bdi data-no-translate>{portal.submissions[0].contactCompany}</bdi>} · {statusNames[portal.submissions[0].status]}</p></> : <><strong>Первая выплата</strong><p>Выберите задание и передайте подходящий контакт.</p></>}<Link href={`/partner/${token}/payouts`}>Открыть выплаты →</Link></section>
          <section className="new-offers-card"><div><span>НОВЫЕ ПРЕДЛОЖЕНИЯ</span><b>{portal.missions.length}</b></div>{portal.missions.slice(0, 3).map((mission) => <Link href={`/p/${mission.programSlug}?access=${token}#missions`} key={mission.id}><i className={`type-dot-${mission.type.toLowerCase()}`} /><span className="offer-title"><strong>{<bdi data-no-translate>{mission.title}</bdi>}</strong><small>{<bdi data-no-translate>{mission.programName}</bdi>} · дедлайн: {mission.programExpiresAt ? new Date(mission.programExpiresAt).toLocaleDateString("ru-RU") : "без ограничения"}</small></span><span>→</span></Link>)}</section>
        </aside>
      </section>
    </div>
  );
}

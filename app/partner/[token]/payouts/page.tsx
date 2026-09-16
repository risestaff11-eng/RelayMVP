import { notFound } from "next/navigation";
import { getPartnerPortal } from "../../../../db/partner";
import { formatMoneyGroups } from "@/lib/format-display";
import { agentReward } from "@/lib/agent-workspace";
import { money, shortDate } from "../../_lib";
import { RewardReceiptConfirmation } from "../../_components/partner-actions";
import { EarningsGoalCalculator } from "../../_components/earnings-goal-calculator";
import { payoutDueAt, slaState } from "@/lib/workflow";

export default async function PartnerPayoutsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const portal = await getPartnerPortal(token);
  if (!portal) notFound();

  const approved = portal.rewards.filter((item) => item.status === "APPROVED");
  const received = portal.rewards.filter((item) => item.status === "PAID" && item.partnerConfirmedAt);
  const markedByCompany = portal.rewards.filter((item) => item.status === "PAID" && !item.partnerConfirmedAt);
  const agentName = [portal.profile.firstName, portal.profile.lastName].filter(Boolean).join(" ") || portal.partner.name || portal.partner.email;
  const supportText = `Здравствуйте! Помогите получить вознаграждение от компании «${portal.company.name}». Компания отметила выплату в RiseStaff, но деньги пока не получены. Агент: ${agentName}.`;
  const supportHref = `https://wa.me/77765086000?text=${encodeURIComponent(supportText)}`;

  return (
    <div className="partner-portal-content">
      <div className="partner-page-heading"><div><span>ВАШ ЗАРАБОТОК</span><h1>Выплаты</h1><p>Начисления, сроки и подтверждение получения.</p></div></div>

      <section className="payout-hero">
        <small>КОМПАНИЯ ДОЛЖНА ВЫПЛАТИТЬ</small>
        <strong>{formatMoneyGroups(approved,portal.program.currency)}</strong>
        <span>Компания переводит деньги самостоятельно</span>
        <div className="payout-hero-summary"><b>Получено: {formatMoneyGroups(received,portal.program.currency)}</b>{markedByCompany.length > 0 && <b>Компания отметила оплату: {formatMoneyGroups(markedByCompany,portal.program.currency)}</b>}</div>
      </section>

      {portal.rewards.length ? (
        <section className="partner-payout-table">
          <div><span>ОСНОВАНИЕ</span><span>КОМПАНИЯ</span><span>СУММА</span><span>ПЛАНОВАЯ ДАТА</span><span>СТАТУС</span></div>
          {portal.rewards.map((reward) => {
            const submission = portal.submissions.find((item) => item.id === reward.submissionId);
            const complete = reward.status === "PAID" && Boolean(reward.partnerConfirmedAt);
            const status = agentReward(reward).label;
            const sla = slaState(payoutDueAt(reward.approvedAt, reward.plannedAt, portal.company.payoutSlaDays), ["PAID","CANCELLED"].includes(reward.status),portal.accessCheckedAt);
            return (
              <article key={reward.id}>
                <div><a href={`/partner/${token}/submissions/${reward.submissionId}`}><strong data-no-translate>{submission?.contactName || submission?.contactCompany || "Вознаграждение"}</strong></a><small data-no-translate>{submission?.mission?.title}</small></div>
                <span>{<bdi data-no-translate>{portal.company.name}</bdi>}</span>
                <b>{money(reward.amount, reward.currency)}</b>
                <span className={sla.overdue ? "sla-label overdue" : "sla-label"}>{reward.plannedAt ? shortDate(reward.plannedAt) : sla.label}</span>
                <div><em className={`reward-status-${complete ? "received" : reward.status.toLowerCase()}`}>{status}</em>{reward.status === "PAID" && <RewardReceiptConfirmation token={token} rewardId={reward.id} confirmed={Boolean(reward.partnerConfirmedAt)} amount={money(reward.amount,reward.currency)} companyName={portal.company.name} supportHref={supportHref} />}</div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="partner-large-empty"><span>₸</span><h2>Начислений пока нет</h2><p>Выберите задание, передайте подходящую рекомендацию и выполните условие — здесь появится ваш заработок.</p></section>
      )}

      <details className="agent-help"><summary>Спланировать заработок</summary><EarningsGoalCalculator currency={portal.program.currency} /></details>
    </div>
  );
}

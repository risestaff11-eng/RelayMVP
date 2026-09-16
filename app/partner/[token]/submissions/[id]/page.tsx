import { notFound } from "next/navigation";
import { SafeLink as Link } from "@/app/safe-link";
import { getPartnerPortal } from "@/db/partner";
import { formatDateTime, formatDate, formatPhone } from "@/lib/format-display";
import { agentReward, clientAttention } from "@/lib/agent-workspace";
import { reviewStatusNames, salesStatusNames, slaState, payoutDueAt, type ReviewStatus, type SalesStatus } from "@/lib/workflow";
import { Clarification } from "../../../_components/clarification";
import { DisputeButton, RewardReceiptConfirmation } from "../../../_components/partner-actions";
export default async function Page({ params, searchParams }: {
    params: Promise<{
        token: string;
        id: string;
    }>;
    searchParams: Promise<{
        sent?: string;
    }>;
}) {
    const { token, id } = await params;
    const p = await getPartnerPortal(token);
    if (!p)
        notFound();
    const s = p.submissions.find(c => c.id === id);
    if (!s)
        notFound();
    const reward = agentReward(s.reward, s.mission?.rewardLabel);
    const attention = clientAttention(s, p.company.payoutSlaDays, p.accessCheckedAt);
    const review = slaState(s.reviewDueAt, !["PENDING", "REVIEWING"].includes(s.reviewStatus), p.accessCheckedAt);
    const due = s.reward ? payoutDueAt(s.reward.approvedAt, s.reward.plannedAt, p.company.payoutSlaDays) : null;
    const sent = (await searchParams).sent === "1";
    return <div className="partner-portal-content agent-workspace">{sent && <section className="agent-success" role="status"><h2>{["LEAD", "DEAL"].includes(s.mission?.type || "") ? "Клиент передан" : "Результат передан"}</h2><p>Компания получила заявку. Следите за решением на этой странице.</p><strong data-no-translate>{p.company.name}</strong>{s.reviewDueAt && <p>Проверка до: {formatDateTime(s.reviewDueAt)}</p>}</section>}<div className="partner-page-heading"><div><small data-no-translate>{s.mission?.programName}</small><h1 data-no-translate>{s.contactName || s.contactCompany}</h1>{s.contactPhone && <a href={`https://wa.me/${s.contactPhone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">{formatPhone(s.contactPhone)}</a>}</div><Link href={`/partner/${token}/submissions`}>← Мои клиенты</Link></div>
 <div className="agent-detail-grid"><div className="agent-detail-main"><section className="panel agent-detail-data"><h2>Переданные данные</h2><p>Исходные данные сохранены. Уточнения добавляются отдельно в историю.</p><dl><dt>Компания клиента</dt><dd data-no-translate>{s.contactCompany || "—"}</dd><dt>Email</dt><dd data-no-translate>{s.contactEmail || "—"}</dd><dt>Задание</dt><dd data-no-translate>{s.mission?.title}</dd><dt>Передано</dt><dd>{formatDateTime(s.createdAt)}</dd><dt>Ваш комментарий</dt><dd data-no-translate>{s.partnerComment || "—"}</dd></dl>{s.customAnswers.map((value: unknown, index: number) => { const v = value as {
        label?: string;
        value?: unknown;
    }; return v?.label ? <p key={index} data-no-translate><strong>{v.label}: </strong>{Array.isArray(v.value) ? v.value.join(", ") : String(v.value ?? "")}</p> : null; })}{s.audioTranscript && <details><summary>Расшифровка записи</summary><p data-no-translate>{s.audioTranscript}</p></details>}{s.attachments.map(a => <div key={a.id}>{a.mimeType.startsWith("audio/") && <audio controls aria-label="Голосовое дополнение" src={`/api/partner/files/${a.id}?token=${token}&inline=1`}><track kind="captions" srcLang="ru" label="Расшифровка" src={`data:text/vtt;charset=utf-8,${encodeURIComponent(`WEBVTT\n\n00:00.000 --> 01:00.000\n${s.audioTranscript || ""}\n`)}`}/></audio>}<a href={a.externalUrl || `/api/partner/files/${a.id}?token=${token}`} target="_blank" rel="noreferrer" data-no-translate>{a.fileName}</a></div>)}</section>
 <section className="panel agent-history"><h2>История заявки</h2>{s.events.map(e => <article key={e.id}><time>{formatDateTime(e.createdAt)}</time><strong>{e.actorType === "COMPANY_REQUEST" ? "Компания просит уточнение" : e.actorType === "PARTNER_NOTE" ? "Ваше дополнение" : e.actorType === "PARTNER_REMINDER" ? "Напоминание компании" : "Изменение заявки"}</strong><p data-no-translate>{e.comment || "Статус заявки обновлён"}</p></article>)}</section></div>
 <aside><section className="panel agent-detail-data agent-decision"><h2>Решение компании</h2><dl><dt>Проверка</dt><dd>{reviewStatusNames[s.reviewStatus as ReviewStatus]}</dd><dt>Продажа</dt><dd>{salesStatusNames[s.salesStatus as SalesStatus]}</dd><dt>Срок проверки</dt><dd>{review.label}{s.reviewDueAt && ["PENDING", "REVIEWING"].includes(s.reviewStatus) && <> · {formatDateTime(s.reviewDueAt)}</>}</dd></dl>{s.companyComment && <p data-no-translate>{s.companyComment}</p>}{attention && <p className="agent-attention">{attention}</p>}<Clarification token={token} submissionId={id}/>{attention.startsWith("Срок") && <Clarification token={token} submissionId={id} reminder/>}</section>
 <section className="panel agent-detail-data agent-reward"><h2>Вознаграждение</h2><strong className="agent-task-amount" data-no-translate>{reward.amount}</strong><p>{reward.label}</p>{due && <p>Плановая дата: {formatDate(due)}</p>}<p>Компания переводит деньги самостоятельно.</p>{s.reward?.status === "PAID" && <RewardReceiptConfirmation token={token} rewardId={s.reward.id} confirmed={Boolean(s.reward.partnerConfirmedAt)} amount={reward.amount} companyName={p.company.name} supportHref="https://wa.me/77765086000"/>}<Link href={`/partner/${token}/payouts`}>Все выплаты →</Link></section><details className="agent-help"><summary>Проблема с заявкой</summary><DisputeButton token={token} submissionId={id} opened={Boolean(s.dispute)}/></details></aside></div></div>;
}

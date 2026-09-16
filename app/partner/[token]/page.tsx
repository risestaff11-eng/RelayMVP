import { notFound } from "next/navigation";
import { getPartnerPortal } from "@/db/partner";
import { SafeLink as Link } from "@/app/safe-link";
import { formatMoneyGroups } from "@/lib/format-display";
import { clientAttention, clientStage } from "@/lib/agent-workspace";
import { QuickResultLauncher } from "../_components/partner-actions";
export default async function Page({ params }: {
    params: Promise<{
        token: string;
    }>;
}) {
    const { token } = await params;
    const p = await getPartnerPortal(token);
    if (!p)
        notFound();
    const attention = p.submissions.map(c => ({ client: c, label: clientAttention(c, p.company.payoutSlaDays, p.accessCheckedAt) })).filter(x => x.label);
    const due = p.rewards.filter(r => r.status === "APPROVED");
    const waiting = p.rewards.filter(r => r.status === "PENDING");
    const received = p.rewards.filter(r => r.status === "PAID" && r.partnerConfirmedAt);
    return <div className="partner-portal-content agent-workspace"><div className="partner-page-heading"><div><small data-no-translate>{p.company.name}</small><h1>Моя работа</h1></div><QuickResultLauncher token={token} missions={p.missions} acceptedMissionIds={p.acceptances.filter(a => a.status === "ACTIVE").map(a => a.missionId)}/></div>
 <section className="agent-money-strip"><Link href={`/partner/${token}/payouts`}><span>Компания должна выплатить</span><strong>{formatMoneyGroups(due, p.program.currency)}</strong></Link><Link href={`/partner/${token}/payouts`}><span>Ожидает выполнения условий</span><strong>{formatMoneyGroups(waiting, p.program.currency)}</strong></Link><Link href={`/partner/${token}/payouts`}><span>Деньги получены</span><strong>{formatMoneyGroups(received, p.program.currency)}</strong></Link></section>
 <section className="panel agent-next-actions"><h2>Требует внимания</h2>{attention.length ? attention.slice(0, 8).map(({ client, label }) => <Link key={client.id} href={`/partner/${token}/submissions/${client.id}`}><strong data-no-translate>{client.contactName || client.contactCompany}</strong><span>{label}</span><b>→</b></Link>) : <p>{p.submissions.length ? "Все заявки переданы. Новых действий пока нет." : "Начните с первого клиента: выберите задание и передайте контакт или отправьте клиенту ссылку."}</p>}{!p.submissions.length && <Link href={`/partner/${token}/opportunities`}>Выбрать задание →</Link>}</section>
 <section className="panel agent-next-actions"><h2>Последние клиенты</h2>{p.submissions.slice(0, 5).map(c => <Link key={c.id} href={`/partner/${token}/submissions/${c.id}`}><strong data-no-translate>{c.contactName || c.contactCompany}</strong><span>{clientStage(c)}</span><b>→</b></Link>)}<Link href={`/partner/${token}/submissions`}>Все клиенты →</Link></section>
 <details className="agent-help"><summary>Как начать работу</summary><ol><li>Выберите задание и прочитайте условия вознаграждения.</li><li>Передайте контакт или отправьте клиенту свою ссылку.</li><li>Следите за решением компании в разделе «Мои клиенты».</li><li>Подтвердите получение денег после перевода.</li></ol><Link href={`/partner/${token}/profile`}>Мой профиль →</Link></details></div>;
}

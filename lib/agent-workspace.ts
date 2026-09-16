import { formatMoney } from "./format-display";
import { payoutDueAt, reviewStatusNames, salesStatusNames, slaState, type ReviewStatus, type SalesStatus } from "./workflow";
type Reward = {
    amount: number;
    currency: string;
    status: string;
    partnerConfirmedAt: string | null;
    plannedAt: string | null;
    approvedAt: string | null;
};
export type AgentClient = {
    id: string;
    contactName: string;
    contactCompany: string;
    contactPhone: string;
    programId: string;
    reviewStatus: string;
    salesStatus: string;
    reviewDueAt: string | null;
    createdAt: string;
    updatedAt: string;
    companyComment: string;
    mission: {
        title: string;
        programName: string;
        rewardLabel: string;
    } | null;
    reward: Reward | null;
    events: Array<{
        id: string;
        actorType: string;
        comment: string;
        createdAt: string;
        toStatus: string;
    }>;
};
export function agentReward(reward: Reward | null, fallback = "Сумма пока не определена") {
    const label = !reward ? "После выполнения условий" : reward.status === "CANCELLED" ? "Начисление отменено" : reward.status === "PAID" ? reward.partnerConfirmedAt ? "Деньги получены" : "Компания отметила перевод" : reward.status === "APPROVED" ? "Компания должна выплатить" : "Ожидает выполнения условий";
    return { label, amount: reward ? formatMoney(reward.amount, reward.currency) : fallback };
}
export function clientStage(client: Pick<AgentClient, "reviewStatus" | "salesStatus">) {
    return client.reviewStatus === "ACCEPTED" && client.salesStatus !== "NONE" ? salesStatusNames[client.salesStatus as SalesStatus] || "Статус обновлён" : reviewStatusNames[client.reviewStatus as ReviewStatus] || "Статус обновлён";
}
export function clientAttention(client: AgentClient, payoutDays: number, now: number) {
    const request = client.events.find(e => e.actorType === "COMPANY_REQUEST");
    const reply = client.events.find(e => e.actorType === "PARTNER_NOTE");
    if (request && (!reply || request.createdAt > reply.createdAt))
        return "Компания просит уточнение";
    if (client.reward?.status === "PAID" && !client.reward.partnerConfirmedAt)
        return "Подтвердите получение денег";
    if (["PENDING", "REVIEWING"].includes(client.reviewStatus) && slaState(client.reviewDueAt, false, now).overdue)
        return "Срок проверки истёк";
    if (client.reward?.status === "APPROVED" && slaState(payoutDueAt(client.reward.approvedAt, client.reward.plannedAt, payoutDays), false, now).overdue)
        return "Срок выплаты истёк";
    return "";
}

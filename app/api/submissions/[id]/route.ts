import { eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb, getD1 } from "../../../../db";
import { getCompanyForUser } from "../../../../db/company";
import { missions, programs, rewards, submissions } from "../../../../db/schema";
import { legacyStatus, type ReviewStatus, type SalesStatus } from "../../../../lib/workflow";
import { cleanString, sameOrigin } from "../../company/_utils";
import { notifyAgentWorkChanges } from "../../../../lib/agent-work-notifications";
import { deferIntegrationEvent, recordIntegrationEvent } from "../../../../lib/integrations/service";

const reviewStatuses = new Set<ReviewStatus>(["PENDING", "REVIEWING", "ACCEPTED", "REJECTED"]);
const salesStatuses = new Set<SalesStatus>(["NONE", "IN_PROGRESS", "AGREEMENT", "WON", "LOST"]);

function legacyReview(status: string): ReviewStatus {
  if (status === "REVIEWING") return "REVIEWING";
  if (status === "REJECTED") return "REJECTED";
  if (["ACCEPTED", "IN_PROGRESS", "DEAL", "REWARDED"].includes(status)) return "ACCEPTED";
  return "PENDING";
}

function legacySales(status: string): SalesStatus {
  if (status === "IN_PROGRESS") return "IN_PROGRESS";
  if (["DEAL", "REWARDED"].includes(status)) return "WON";
  return "NONE";
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Сначала войдите" }, { status: 401 });
  const company = await getCompanyForUser(user.userId);
  if (!company) return Response.json({ error: "Компания не найдена" }, { status: 404 });
  try {
    const { id } = await params;
    const payload = await request.json() as Record<string, unknown>;
    const requestedAmount = payload.amount === undefined ? undefined : Number(payload.amount);
    if (requestedAmount !== undefined && (!Number.isSafeInteger(requestedAmount) || requestedAmount < 0)) throw new Error("Укажите корректную сумму вознаграждения");
    const requestedPlannedAt = cleanString(payload.plannedAt, 30) || null;
    const db = getDb();
    const submission = (await db.select().from(submissions).where(eq(submissions.id, id)).limit(1))[0];
    if (!submission || submission.companyId !== company.id) return Response.json({ error: "Результат не найден" }, { status: 404 });
    const comment = payload.comment === undefined ? submission.companyComment : cleanString(payload.comment, 1200);
    for (const key of ["dealAmount", "estimatedDealAmount"]) {
      if (payload[key] !== undefined && payload[key] !== "" && (!Number.isSafeInteger(Number(payload[key])) || Number(payload[key]) < 0)) throw new Error("Укажите корректную сумму сделки");
    }
    const dealAmount = payload.dealAmount === undefined || payload.dealAmount === "" ? submission.dealAmount : Math.max(0, Math.round(Number(payload.dealAmount) || 0));
    const estimatedDealAmount = payload.estimatedDealAmount === undefined || payload.estimatedDealAmount === "" ? submission.estimatedDealAmount : Math.max(0, Math.round(Number(payload.estimatedDealAmount) || 0));

    const currentReview = (submission.reviewStatus || legacyReview(submission.status)) as ReviewStatus;
    const currentSales = (submission.salesStatus || legacySales(submission.status)) as SalesStatus;
    let reviewStatus = cleanString(payload.reviewStatus, 20).toUpperCase() as ReviewStatus || currentReview;
    let salesStatus = cleanString(payload.salesStatus, 20).toUpperCase() as SalesStatus || currentSales;
    const legacyRequested = cleanString(payload.status, 30).toUpperCase();
    if (legacyRequested) {
      reviewStatus = legacyReview(legacyRequested);
      salesStatus = legacySales(legacyRequested);
    }
    if (!reviewStatuses.has(reviewStatus)) throw new Error("Некорректный статус проверки");
    if (!salesStatuses.has(salesStatus)) throw new Error("Некорректный статус продажи");
    if (reviewStatus === "REJECTED" && comment.length < 5) throw new Error("При отказе обязательно объясните причину партнёру");
    if (reviewStatus !== "ACCEPTED") salesStatus = reviewStatus === "REJECTED" ? "LOST" : "NONE";

    const mission = (await db.select({ rewardMode: missions.rewardMode, rewardValue: missions.rewardValue }).from(missions).where(eq(missions.id, submission.missionId)).limit(1))[0];
    const program = (await db.select({ currency: programs.currency }).from(programs).where(eq(programs.id, submission.programId)).limit(1))[0];
    if (salesStatus === "WON" && currentSales !== "WON" && dealAmount <= 0 && (["LEAD", "DEAL"].includes(submission.type) || mission?.rewardMode === "PERCENT")) throw new Error("Укажите сумму сделки — RiseStaff рассчитает вознаграждение автоматически");
    const existingReward = (await db.select().from(rewards).where(eq(rewards.submissionId, id)).limit(1))[0];
    const now = new Date().toISOString();
    const plannedAt = payload.plannedAt === undefined ? existingReward?.plannedAt ?? null : requestedPlannedAt;
    const settled = !!existingReward && (existingReward.status === "PAID" || !!existingReward.paidAt || !!existingReward.partnerConfirmedAt);
    const amount = settled ? existingReward.amount : mission?.rewardMode === "PERCENT"
      ? (dealAmount === submission.dealAmount && existingReward ? existingReward.amount : Math.round(dealAmount * mission.rewardValue / 100))
      : requestedAmount ?? existingReward?.amount ?? mission?.rewardValue ?? 0;
    if (settled && ((requestedAmount !== undefined && requestedAmount !== existingReward.amount) || dealAmount !== submission.dealAmount || currentSales !== salesStatus || currentReview !== reviewStatus)) {
      return Response.json({ error: "Перевод уже отмечен. Сумму и этап нельзя менять обычным редактированием; обратитесь в поддержку для корректировки." }, { status: 409 });
    }
    const nextRewardStatus = settled ? "PAID" : salesStatus === "WON" ? "APPROVED" : salesStatus === "LOST" ? "CANCELLED" : "PENDING";
    const nextApprovedAt = salesStatus === "WON" ? existingReward?.approvedAt || now : existingReward?.status === "PAID" ? existingReward.approvedAt : null;
    const nextLegacyStatus = legacyStatus(reviewStatus, salesStatus, nextRewardStatus);
    const transitionComment = [
      currentReview !== reviewStatus ? `Проверка: ${currentReview} → ${reviewStatus}` : "",
      currentSales !== salesStatus ? `Продажа: ${currentSales} → ${salesStatus}` : "",
      dealAmount !== submission.dealAmount ? `Сумма сделки: ${dealAmount} ${program?.currency || "KZT"}` : "",
      existingReward && amount !== existingReward.amount ? `Вознаграждение: ${amount} ${existingReward.currency}` : "",
      comment,
    ].filter(Boolean).join(" · ");
    // The event is a compare-and-swap gate. D1 executes the whole batch atomically:
    // a concurrent transfer/edit makes every statement in this stale command a no-op.
    const d1 = getD1();
    const eventId = crypto.randomUUID();
    const rewardGuard = existingReward
      ? "EXISTS (SELECT 1 FROM rewards WHERE id = ? AND updated_at = ? AND status = ? AND amount = ? AND paid_at IS ? AND partner_confirmed_at IS ?)"
      : "NOT EXISTS (SELECT 1 FROM rewards WHERE submission_id = ?)";
    const rewardArgs = existingReward ? [existingReward.id, existingReward.updatedAt, existingReward.status, existingReward.amount, existingReward.paidAt, existingReward.partnerConfirmedAt] : [id];
    const gate = "EXISTS (SELECT 1 FROM submission_status_events WHERE id = ?)";
    const statements = [
      d1.prepare(`INSERT INTO submission_status_events (id, submission_id, from_status, to_status, actor_type, comment, created_at)
        SELECT ?, id, status, ?, 'COMPANY', ?, ? FROM submissions WHERE id = ? AND company_id = ? AND updated_at = ? AND status = ? AND company_comment = ? AND deal_amount = ? AND ${rewardGuard} RETURNING id`)
        .bind(eventId, nextLegacyStatus, transitionComment || "Карточка заявки обновлена", now, id, company.id, submission.updatedAt, submission.status, submission.companyComment, submission.dealAmount, ...rewardArgs),
      d1.prepare(`UPDATE submissions SET status = ?, review_status = ?, sales_status = ?, company_comment = ?, estimated_deal_amount = ?, deal_amount = ?, updated_at = ? WHERE id = ? AND ${gate}`)
        .bind(nextLegacyStatus, reviewStatus, salesStatus, comment, estimatedDealAmount, dealAmount, now, id, eventId),
    ];
    if (existingReward) {
      statements.push(d1.prepare(`UPDATE rewards SET amount = ?, planned_at = ?, status = ?, approved_at = ?, updated_at = ? WHERE id = ? AND ${gate}`)
        .bind(amount, plannedAt, nextRewardStatus, nextApprovedAt, now, existingReward.id, eventId));
    } else if (reviewStatus === "ACCEPTED" && amount > 0) {
      statements.push(d1.prepare(`INSERT INTO rewards (id, company_id, submission_id, partner_id, amount, currency, status, approved_at, planned_at, created_at, updated_at)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${gate}`)
        .bind(crypto.randomUUID(), company.id, id, submission.partnerId, amount, program?.currency || "KZT", nextRewardStatus, nextApprovedAt, plannedAt, now, now, eventId));
    }
    const saved = await d1.batch(statements);
    if (!saved[0].results.length) return Response.json({ error: "Карточка уже изменена. Обновите страницу и повторите действие." }, { status: 409 });
    if (currentReview !== reviewStatus || currentSales !== salesStatus || (nextRewardStatus === "APPROVED" && existingReward?.status !== "APPROVED")) {
      await notifyAgentWorkChanges(company.id, [id]);
    }
    deferIntegrationEvent(recordIntegrationEvent({
      companyId: company.id,
      eventType: "submission.updated",
      aggregateType: "submission",
      aggregateId: id,
      idempotencyKey: `submission.updated:${eventId}`,
      payload: { submissionId: id, programId: submission.programId, missionId: submission.missionId, partnerId: submission.partnerId, reviewStatus, salesStatus, rewardStatus: nextRewardStatus, estimatedDealAmount, dealAmount, rewardAmount: amount, updatedAt: now },
    }));
    return Response.json({ ok: true, status: nextLegacyStatus, reviewStatus, salesStatus, rewardStatus: nextRewardStatus, estimatedDealAmount, dealAmount, rewardAmount: amount,
      event: { id: eventId, fromStatus: submission.status, toStatus: nextLegacyStatus, actorType: "COMPANY", comment: transitionComment || "Карточка заявки обновлена", createdAt: now } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось обновить результат" }, { status: 400 });
  }
}

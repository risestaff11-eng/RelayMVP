import { eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { getCompanyForUser } from "../../../../db/company";
import { missions, programs, rewards, submissionStatusEvents, submissions } from "../../../../db/schema";
import { legacyStatus, type ReviewStatus, type SalesStatus } from "../../../../lib/workflow";
import { cleanString, sameOrigin } from "../../company/_utils";

const reviewStatuses = new Set<ReviewStatus>(["PENDING", "REVIEWING", "ACCEPTED", "REJECTED"]);
const salesStatuses = new Set<SalesStatus>(["NONE", "IN_PROGRESS", "WON", "LOST"]);

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
    const comment = cleanString(payload.comment, 1200);
    const requestedAmount = Math.max(0, Math.round(Number(payload.amount) || 0));
    const dealAmount = Math.max(0, Number(payload.dealAmount) || 0);
    const plannedAt = cleanString(payload.plannedAt, 30) || null;
    const db = getDb();
    const submission = (await db.select().from(submissions).where(eq(submissions.id, id)).limit(1))[0];
    if (!submission || submission.companyId !== company.id) return Response.json({ error: "Результат не найден" }, { status: 404 });

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
    if (salesStatus === "WON" && mission?.rewardMode === "PERCENT" && dealAmount <= 0) throw new Error("Укажите сумму сделки — RiseStaff рассчитает вознаграждение автоматически");
    const amount = mission?.rewardMode === "PERCENT" ? Math.round(dealAmount * mission.rewardValue / 100) : requestedAmount;
    const existingReward = (await db.select().from(rewards).where(eq(rewards.submissionId, id)).limit(1))[0];
    const nextRewardStatus = salesStatus === "WON" ? "APPROVED" : salesStatus === "LOST" && existingReward ? "CANCELLED" : existingReward?.status ?? "PENDING";
    const nextLegacyStatus = legacyStatus(reviewStatus, salesStatus, nextRewardStatus);
    const now = new Date().toISOString();
    const transitionComment = [
      currentReview !== reviewStatus ? `Проверка: ${currentReview} → ${reviewStatus}` : "",
      currentSales !== salesStatus ? `Продажа: ${currentSales} → ${salesStatus}` : "",
      comment,
    ].filter(Boolean).join(" · ");
    const baseStatements = [
      db.update(submissions).set({ status: nextLegacyStatus, reviewStatus, salesStatus, companyComment: comment, updatedAt: now }).where(eq(submissions.id, id)),
      db.insert(submissionStatusEvents).values({ id: crypto.randomUUID(), submissionId: id, fromStatus: submission.status, toStatus: nextLegacyStatus, actorType: "COMPANY", comment: transitionComment || "Карточка заявки обновлена", createdAt: now }),
    ] as const;

    if (reviewStatus === "ACCEPTED" && amount > 0) {
      const rewardStatement = existingReward
        ? db.update(rewards).set({ amount, currency: program?.currency || existingReward.currency, plannedAt, status: nextRewardStatus, approvedAt: salesStatus === "WON" ? existingReward.approvedAt || now : existingReward.approvedAt, updatedAt: now }).where(eq(rewards.id, existingReward.id))
        : db.insert(rewards).values({ id: crypto.randomUUID(), companyId: company.id, submissionId: id, partnerId: submission.partnerId, amount, currency: program?.currency || "KZT", status: nextRewardStatus, approvedAt: salesStatus === "WON" ? now : null, plannedAt, createdAt: now, updatedAt: now });
      await db.batch([...baseStatements, rewardStatement]);
    } else if (existingReward && salesStatus === "LOST") {
      await db.batch([...baseStatements, db.update(rewards).set({ status: "CANCELLED", updatedAt: now }).where(eq(rewards.id, existingReward.id))]);
    } else await db.batch(baseStatements);
    return Response.json({ ok: true, status: nextLegacyStatus, reviewStatus, salesStatus, rewardStatus: nextRewardStatus });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось обновить результат" }, { status: 400 });
  }
}

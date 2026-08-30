import { eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { getCompanyForUser } from "../../../../db/company";
import { missions, rewards, submissionStatusEvents, submissions } from "../../../../db/schema";
import { cleanString, sameOrigin } from "../../company/_utils";

const statuses = new Set(["SUBMITTED", "REVIEWING", "ACCEPTED", "IN_PROGRESS", "DEAL", "REWARDED", "REJECTED"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Сначала войдите" }, { status: 401 });
  const company = await getCompanyForUser(user.userId);
  if (!company) return Response.json({ error: "Компания не найдена" }, { status: 404 });
  try {
    const { id } = await params;
    const payload = await request.json() as Record<string, unknown>;
    const status = cleanString(payload.status, 30);
    const comment = cleanString(payload.comment, 1200);
    const requestedAmount = Math.max(0, Math.round(Number(payload.amount) || 0));
    const dealAmount = Math.max(0, Number(payload.dealAmount) || 0);
    const plannedAt = cleanString(payload.plannedAt, 30) || null;
    if (!statuses.has(status)) throw new Error("Некорректный статус");
    if (status === "REJECTED" && comment.length < 5) throw new Error("При отказе обязательно объясните причину партнёру");
    const db = getDb();
    const rows = await db.select().from(submissions).where(eq(submissions.id, id)).limit(1);
    const submission = rows[0];
    if (!submission || submission.companyId !== company.id) return Response.json({ error: "Результат не найден" }, { status: 404 });
    const missionRows = await db.select({ rewardMode: missions.rewardMode, rewardValue: missions.rewardValue }).from(missions).where(eq(missions.id, submission.missionId)).limit(1);
    const mission = missionRows[0];
    const amount = mission?.rewardMode === "PERCENT" ? Math.round(dealAmount * mission.rewardValue / 100) : requestedAmount;
    if (["DEAL", "REWARDED"].includes(status) && mission?.rewardMode === "PERCENT" && dealAmount <= 0) throw new Error("Укажите сумму сделки — Yaler рассчитает вознаграждение автоматически");
    const now = new Date().toISOString();
    const submissionStatement = db.update(submissions).set({ status, companyComment: comment, updatedAt: now }).where(eq(submissions.id, id));
    const eventStatement = db.insert(submissionStatusEvents).values({ id: crypto.randomUUID(), submissionId: id, fromStatus: submission.status, toStatus: status, actorType: "COMPANY", comment, createdAt: now });
    if (["ACCEPTED", "IN_PROGRESS", "DEAL", "REWARDED"].includes(status) && amount > 0) {
      const existing = await db.select().from(rewards).where(eq(rewards.submissionId, id)).limit(1);
      const rewardStatement = existing[0]
        ? db.update(rewards).set({ amount, currency: cleanString(payload.currency, 5) || "KZT", plannedAt, status: status === "REWARDED" ? "APPROVED" : existing[0].status, approvedAt: status === "REWARDED" ? now : existing[0].approvedAt, updatedAt: now }).where(eq(rewards.id, existing[0].id))
        : db.insert(rewards).values({ id: crypto.randomUUID(), companyId: company.id, submissionId: id, partnerId: submission.partnerId, amount, currency: cleanString(payload.currency, 5) || "KZT", status: status === "REWARDED" ? "APPROVED" : "PENDING", approvedAt: status === "REWARDED" ? now : null, plannedAt, createdAt: now, updatedAt: now });
      await db.batch([submissionStatement, eventStatement, rewardStatement]);
    } else {
      await db.batch([submissionStatement, eventStatement]);
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось обновить результат" }, { status: 400 });
  }
}

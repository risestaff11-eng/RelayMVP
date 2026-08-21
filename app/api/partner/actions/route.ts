import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { getPartnerPortal } from "../../../../db/partner";
import { partnerMissionAcceptances, partnerProfiles, rewards, submissionDisputes } from "../../../../db/schema";
import { cleanList, cleanString, sameOrigin } from "../../company/_utils";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const token = cleanString(payload.token, 80);
    const action = cleanString(payload.action, 30);
    const portal = await getPartnerPortal(token);
    if (!portal) return Response.json({ error: "Ссылка недействительна или устарела" }, { status: 401 });
    const db = getDb();
    const now = new Date().toISOString();

    if (action === "ACCEPT_MISSION") {
      const missionId = cleanString(payload.missionId, 80);
      const mission = portal.missions.find((item) => item.id === missionId);
      if (!mission) throw new Error("Задание не найдено");
      const missionPartner = portal.partners.find((item) => item.programId === mission.programId);
      if (!missionPartner) throw new Error("Сначала откройте программу по приглашению компании");
      const existing = await db.select().from(partnerMissionAcceptances).where(and(eq(partnerMissionAcceptances.partnerId, missionPartner.id), eq(partnerMissionAcceptances.missionId, missionId))).limit(1);
      if (existing[0]) await db.update(partnerMissionAcceptances).set({ status: "ACTIVE", completedAt: null }).where(eq(partnerMissionAcceptances.id, existing[0].id));
      else await db.insert(partnerMissionAcceptances).values({ id: crypto.randomUUID(), partnerId: missionPartner.id, missionId, status: "ACTIVE", acceptedAt: now });
      return Response.json({ ok: true });
    }

    if (action === "OPEN_DISPUTE") {
      const submissionId = cleanString(payload.submissionId, 80);
      const reason = cleanString(payload.reason, 1200);
      if (reason.length < 10) throw new Error("Опишите причину спора подробнее");
      if (!portal.submissions.some((submission) => submission.id === submissionId)) throw new Error("Рекомендация не найдена");
      const existing = await db.select().from(submissionDisputes).where(and(eq(submissionDisputes.submissionId, submissionId), eq(submissionDisputes.status, "OPEN"))).limit(1);
      if (existing.length) throw new Error("По этой рекомендации уже открыт спор");
      const submission = portal.submissions.find((item) => item.id === submissionId)!;
      await db.insert(submissionDisputes).values({ id: crypto.randomUUID(), submissionId, partnerId: submission.partnerId, reason, status: "OPEN", createdAt: now });
      return Response.json({ ok: true });
    }

    if (action === "CONFIRM_REWARD") {
      const rewardId = cleanString(payload.rewardId, 80);
      const confirmed = payload.confirmed === true;
      const reward = portal.rewards.find((item) => item.id === rewardId);
      if (!reward) throw new Error("Начисление не найдено");
      if (reward.status !== "PAID") throw new Error("Компания ещё не отметила выплату");
      await db.update(rewards).set({ partnerConfirmedAt: confirmed ? now : null, updatedAt: now }).where(eq(rewards.id, rewardId));
      return Response.json({ ok: true, partnerConfirmedAt: confirmed ? now : null });
    }

    if (action === "UPDATE_PROFILE") {
      const values = {
        skillsJson: JSON.stringify(cleanList(payload.skills, 12, 80)),
        industriesJson: JSON.stringify(cleanList(payload.industries, 12, 80)),
        geographiesJson: JSON.stringify(cleanList(payload.geographies, 12, 80)),
        preferredTypesJson: JSON.stringify(cleanList(payload.preferredTypes, 4, 30)),
        updatedAt: now,
      };
      const existing = await db.select().from(partnerProfiles).where(eq(partnerProfiles.partnerId, portal.partner.id)).limit(1);
      if (existing[0]) await db.update(partnerProfiles).set(values).where(eq(partnerProfiles.partnerId, portal.partner.id));
      else await db.insert(partnerProfiles).values({ partnerId: portal.partner.id, ...values });
      return Response.json({ ok: true });
    }

    throw new Error("Неизвестное действие");
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось выполнить действие" }, { status: 400 });
  }
}

import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { getPartnerPortal } from "../../../../db/partner";
import { partnerMissionAcceptances, partnerReferralLinks } from "../../../../db/schema";
import { createPartnerToken, hashPartnerToken } from "../../../../lib/partner-token";
import { agentUrl } from "../../../../lib/public-origins";
import { cleanString, sameOrigin } from "../../company/_utils";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  try {
    const body = await request.json() as { token?: unknown; missionId?: unknown };
    const token = cleanString(body.token, 80);
    const missionId = cleanString(body.missionId, 80);
    const portal = await getPartnerPortal(token);
    if (!portal) return Response.json({ error: "Ссылка агента недействительна" }, { status: 401 });
    const mission = portal.missions.find((item) => item.id === missionId && item.status === "ACTIVE" && ["LEAD", "DEAL"].includes(item.type));
    if (!mission) return Response.json({ error: "Для этого задания нельзя создать реферальную ссылку" }, { status: 404 });
    const partner = portal.partners.find((item) => item.programId === mission.programId);
    if (!partner) return Response.json({ error: "Откройте программу по приглашению компании" }, { status: 409 });
    const accepted = await getDb().select({ id: partnerMissionAcceptances.id }).from(partnerMissionAcceptances)
      .where(and(eq(partnerMissionAcceptances.partnerId, partner.id), eq(partnerMissionAcceptances.missionId, missionId), eq(partnerMissionAcceptances.status, "ACTIVE"))).limit(1);
    if (!accepted.length) return Response.json({ error: "Сначала возьмите это задание в работу" }, { status: 409 });

    const referralToken = createPartnerToken();
    const now = new Date();
    await getDb().insert(partnerReferralLinks).values({
      id: crypto.randomUUID(),
      partnerId: partner.id,
      missionId,
      tokenHash: await hashPartnerToken(referralToken),
      status: "ACTIVE",
      expiresAt: new Date(now.getTime() + 180 * 86400000).toISOString(),
      createdAt: now.toISOString(),
    });
    return Response.json({ url: agentUrl(`/ref/${referralToken}`), expiresAt: new Date(now.getTime() + 180 * 86400000).toISOString() }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось создать ссылку" }, { status: 400 });
  }
}

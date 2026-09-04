import { and, eq, gte, notInArray, or } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { getPublicReferral } from "../../../../../db/referrals";
import { submissionStatusEvents, submissions } from "../../../../../db/schema";
import { cleanString, sameOrigin } from "../../../company/_utils";
import { notifyCompanyNewSubmission } from "../../../../../lib/company-submission-notifications";
import { duplicateCutoff, normalizeContactEmail, normalizeContactPhone, isSelfReferral, SELF_REFERRAL_MESSAGE, hasHoneypotValue } from "../../../../../lib/submission-antifraud";
import { reviewDueAt } from "../../../../../lib/workflow";
import { limitPublicSubmission, requestLimitResponse } from "../../../../../lib/request-rate-limit";
import { deferIntegrationEvent, recordIntegrationEvent } from "../../../../../lib/integrations/service";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  try {
    await limitPublicSubmission(request);
    const body = await request.json() as { referralToken?: unknown; name?: unknown; contact?: unknown; comment?: unknown; website_url?: unknown };
    if (hasHoneypotValue(body.website_url)) return Response.json({ error: "Не удалось отправить форму" }, { status: 400 });
    const referralToken = cleanString(body.referralToken, 80);
    const name = cleanString(body.name, 120);
    const contact = cleanString(body.contact, 160);
    const comment = cleanString(body.comment, 1200);
    if (!name) throw new Error("Укажите имя");
    if (!contact) throw new Error("Укажите телефон или email");
    const isEmail = contact.includes("@");
    if (isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) throw new Error("Проверьте email");
    if (!isEmail && contact.replace(/\D/g, "").length < 7) throw new Error("Проверьте номер телефона");
    const referral = await getPublicReferral(referralToken);
    if (!referral) return Response.json({ error: "Реферальная ссылка недействительна или устарела" }, { status: 404 });
    const contactEmail = isEmail ? normalizeContactEmail(contact) : "";
    const contactPhone = isEmail ? "" : normalizeContactPhone(contact);
    if (isSelfReferral({ email: contactEmail, phone: contactPhone }, [referral.partner])) return Response.json({ error: SELF_REFERRAL_MESSAGE, code: "SELF_REFERRAL" }, { status: 422 });
    const duplicateConditions = [contactEmail ? eq(submissions.contactEmail, contactEmail) : null, contactPhone ? eq(submissions.contactPhone, contactPhone) : null].filter(Boolean);
    const duplicate = duplicateConditions.length ? await getDb().select({ id: submissions.id }).from(submissions).where(and(eq(submissions.companyId, referral.company.id), gte(submissions.createdAt, duplicateCutoff()), notInArray(submissions.reviewStatus, ["REJECTED"]), duplicateConditions.length === 2 ? or(duplicateConditions[0]!, duplicateConditions[1]!) : duplicateConditions[0]!)).limit(1) : [];
    if (duplicate.length) return Response.json({ error: "Этот контакт уже закреплён за первой рекомендацией компании. Повторно отправлять его не нужно." }, { status: 409 });
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await getDb().batch([
      getDb().insert(submissions).values({ id, companyId: referral.company.id, programId: referral.program.id, missionId: referral.mission.id, partnerId: referral.partner.id, type: referral.mission.type, contactName: name, contactCompany: "", contactEmail, contactPhone, payloadJson: JSON.stringify({ partnerComment: comment, externalLinks: [], customAnswers: [], submittedByClient: true, referralSource: "CLIENT_SELF_SERVICE", clientConsentAcceptedAt: now }), status: "SUBMITTED", reviewStatus: "PENDING", salesStatus: "NONE", ownershipStatus: "CLEAR", reviewDueAt: reviewDueAt(now), createdAt: now, updatedAt: now }),
      getDb().insert(submissionStatusEvents).values({ id: crypto.randomUUID(), submissionId: id, fromStatus: null, toStatus: "SUBMITTED", actorType: "CLIENT", comment: "Клиент самостоятельно заполнил реферальную форму агента", createdAt: now }),
    ]);
    await notifyCompanyNewSubmission(referral.company.id, id);
    deferIntegrationEvent(recordIntegrationEvent({
      companyId: referral.company.id,
      eventType: "submission.created",
      aggregateType: "submission",
      aggregateId: id,
      idempotencyKey: `submission.created:${id}`,
      payload: { submissionId: id, programId: referral.program.id, missionId: referral.mission.id, partnerId: referral.partner.id, contactName: name, contactEmail, contactPhone, source: "REFERRAL_LINK", createdAt: now },
    }));
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    const limited = requestLimitResponse(error);
    if (limited) return limited;
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось передать контакт" }, { status: 400 });
  }
}

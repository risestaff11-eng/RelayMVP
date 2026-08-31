import { and, eq, or } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { getPublicReferral } from "../../../../../db/referrals";
import { submissionStatusEvents, submissions, users } from "../../../../../db/schema";
import { cleanString, sameOrigin } from "../../../company/_utils";
import { sendCompanyNewSubmissionNotification } from "../../../../../lib/agent-email";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  try {
    const body = await request.json() as { referralToken?: unknown; name?: unknown; contact?: unknown; comment?: unknown };
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
    const contactEmail = isEmail ? contact.toLowerCase() : "";
    const contactPhone = isEmail ? "" : contact;
    const duplicateConditions = [contactEmail ? eq(submissions.contactEmail, contactEmail) : null, contactPhone ? eq(submissions.contactPhone, contactPhone) : null].filter(Boolean);
    const duplicate = duplicateConditions.length ? await getDb().select({ id: submissions.id }).from(submissions).where(and(eq(submissions.programId, referral.program.id), duplicateConditions.length === 2 ? or(duplicateConditions[0]!, duplicateConditions[1]!) : duplicateConditions[0]!)).limit(1) : [];
    if (duplicate.length) return Response.json({ error: "Этот контакт уже передан компании. Повторно отправлять его не нужно." }, { status: 409 });
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await getDb().batch([
      getDb().insert(submissions).values({ id, companyId: referral.company.id, programId: referral.program.id, missionId: referral.mission.id, partnerId: referral.partner.id, type: referral.mission.type, contactName: name, contactCompany: "", contactEmail, contactPhone, payloadJson: JSON.stringify({ partnerComment: comment, externalLinks: [], customAnswers: [], submittedByClient: true, referralSource: "CLIENT_SELF_SERVICE", clientConsentAcceptedAt: now }), status: "SUBMITTED", createdAt: now, updatedAt: now }),
      getDb().insert(submissionStatusEvents).values({ id: crypto.randomUUID(), submissionId: id, fromStatus: null, toStatus: "SUBMITTED", actorType: "CLIENT", comment: "Клиент самостоятельно заполнил реферальную форму агента", createdAt: now }),
    ]);
    const owner = (await getDb().select({ email: users.email }).from(users).where(eq(users.id, referral.company.ownerUserId)).limit(1))[0];
    if (owner?.email) {
      await sendCompanyNewSubmissionNotification({ destination: owner.email, companyName: referral.company.name, agentName: referral.partner.name, missionTitle: referral.mission.title, programName: referral.program.name, contactName: name, contactCompany: "", submissionId: id }).catch((error) => console.error("referral notification email failed", error));
    }
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось передать контакт" }, { status: 400 });
  }
}

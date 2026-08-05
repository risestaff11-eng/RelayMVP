import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from ".";
import { hashPartnerToken } from "../lib/partner-token";
import {
  companies,
  missions,
  partnerAccessLinks,
  partnerMissionAcceptances,
  partnerProfiles,
  partners,
  programs,
  rewards,
  submissionAttachments,
  submissionDisputes,
  submissionStatusEvents,
  submissions,
} from "./schema";

function parseList(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parsePayload(value: string) {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return {
      partnerComment: typeof parsed.partnerComment === "string" ? parsed.partnerComment : "",
      externalLinks: Array.isArray(parsed.externalLinks) ? parsed.externalLinks.filter((item): item is string => typeof item === "string") : [],
    };
  } catch {
    return { partnerComment: "", externalLinks: [] as string[] };
  }
}

export async function getPartnerPortal(token: string) {
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;
  const tokenHash = await hashPartnerToken(token);
  const db = getDb();
  const accessRows = await db.select().from(partnerAccessLinks).where(eq(partnerAccessLinks.tokenHash, tokenHash)).limit(1);
  const access = accessRows[0];
  if (!access || new Date(access.expiresAt).getTime() < Date.now()) return null;

  const partnerRows = await db.select().from(partners).where(eq(partners.id, access.partnerId)).limit(1);
  const partner = partnerRows[0];
  if (!partner) return null;

  const [programRows, companyRows, missionRows, submissionRows, rewardRows, profileRows, acceptanceRows, disputeRows] = await Promise.all([
    db.select().from(programs).where(eq(programs.id, partner.programId)).limit(1),
    db.select().from(companies).where(eq(companies.id, partner.companyId)).limit(1),
    db.select().from(missions).where(eq(missions.programId, partner.programId)).orderBy(asc(missions.sortOrder)),
    db.select().from(submissions).where(eq(submissions.partnerId, partner.id)).orderBy(desc(submissions.createdAt)),
    db.select().from(rewards).where(eq(rewards.partnerId, partner.id)).orderBy(desc(rewards.createdAt)),
    db.select().from(partnerProfiles).where(eq(partnerProfiles.partnerId, partner.id)).limit(1),
    db.select().from(partnerMissionAcceptances).where(eq(partnerMissionAcceptances.partnerId, partner.id)).orderBy(desc(partnerMissionAcceptances.acceptedAt)),
    db.select().from(submissionDisputes).where(eq(submissionDisputes.partnerId, partner.id)).orderBy(desc(submissionDisputes.createdAt)),
  ]);
  const program = programRows[0];
  const company = companyRows[0];
  if (!program || !company) return null;
  const submissionIds = submissionRows.map((item) => item.id);
  const [eventRows, attachmentRows] = submissionIds.length ? await Promise.all([
    db.select().from(submissionStatusEvents).where(inArray(submissionStatusEvents.submissionId, submissionIds)).orderBy(desc(submissionStatusEvents.createdAt)),
    db.select().from(submissionAttachments).where(inArray(submissionAttachments.submissionId, submissionIds)).orderBy(asc(submissionAttachments.createdAt)),
  ]) : [[], []];

  const serializedMissions = missionRows.map((mission) => ({
    ...mission,
    instructions: parseList(mission.instructionsJson),
    proofRequirements: parseList(mission.proofRequirementsJson),
  }));
  const serializedSubmissions = submissionRows.map((submission) => ({
    ...submission,
    ...parsePayload(submission.payloadJson),
    mission: serializedMissions.find((mission) => mission.id === submission.missionId) ?? null,
    events: eventRows.filter((event) => event.submissionId === submission.id),
    attachments: attachmentRows.filter((attachment) => attachment.submissionId === submission.id),
    reward: rewardRows.find((reward) => reward.submissionId === submission.id) ?? null,
    dispute: disputeRows.find((dispute) => dispute.submissionId === submission.id && dispute.status === "OPEN") ?? null,
  }));
  const profile = profileRows[0];

  return {
    token,
    partner,
    company,
    program,
    missions: serializedMissions,
    submissions: serializedSubmissions,
    rewards: rewardRows,
    acceptances: acceptanceRows,
    profile: {
      skills: parseList(profile?.skillsJson),
      industries: parseList(profile?.industriesJson),
      geographies: parseList(profile?.geographiesJson),
      preferredTypes: parseList(profile?.preferredTypesJson),
      level: profile?.level ?? 1,
      usefulActionStreak: profile?.usefulActionStreak ?? 0,
    },
  };
}

export async function getPartnerAttachment(token: string, attachmentId: string) {
  const portal = await getPartnerPortal(token);
  if (!portal) return null;
  const rows = await getDb().select().from(submissionAttachments).where(eq(submissionAttachments.id, attachmentId)).limit(1);
  const attachment = rows[0];
  if (!attachment || !portal.submissions.some((submission) => submission.id === attachment.submissionId)) return null;
  return attachment;
}

export async function getMissionForPublicSubmission(programSlug: string, missionId: string) {
  const db = getDb();
  const rows = await db.select({ program: programs, mission: missions, company: companies })
    .from(missions)
    .innerJoin(programs, eq(missions.programId, programs.id))
    .innerJoin(companies, eq(programs.companyId, companies.id))
    .where(and(eq(programs.slug, programSlug), eq(programs.status, "ACTIVE"), eq(missions.id, missionId), eq(missions.status, "ACTIVE")))
    .limit(1);
  return rows[0] ?? null;
}

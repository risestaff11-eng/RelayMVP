import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { getDb } from ".";
import { hashPartnerToken } from "../lib/partner-token";
import {
  companies,
  companyKnowledgeItems,
  companyProfileVersions,
  missionResources,
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
  } catch { return []; }
}

function parsePayload(value: string) {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return {
      partnerComment: typeof parsed.partnerComment === "string" ? parsed.partnerComment : "",
      externalLinks: Array.isArray(parsed.externalLinks) ? parsed.externalLinks.filter((item): item is string => typeof item === "string") : [],
    };
  } catch { return { partnerComment: "", externalLinks: [] as string[] }; }
}

export async function getPartnerPortal(token: string) {
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;
  const tokenHash = await hashPartnerToken(token);
  const db = getDb();
  const access = (await db.select().from(partnerAccessLinks).where(eq(partnerAccessLinks.tokenHash, tokenHash)).limit(1))[0];
  if (!access || new Date(access.expiresAt).getTime() < Date.now()) return null;
  const partner = (await db.select().from(partners).where(eq(partners.id, access.partnerId)).limit(1))[0];
  if (!partner || partner.status === "BLOCKED") return null;

  const identityCondition = partner.userId
    ? or(eq(partners.userId, partner.userId), eq(partners.email, partner.email))
    : eq(partners.email, partner.email);
  const identityRows = (await db.select().from(partners).where(and(eq(partners.companyId, partner.companyId), identityCondition))).filter((item) => item.status !== "BLOCKED");
  const partnerIds = identityRows.map((item) => item.id);
  const programIds = [...new Set(identityRows.map((item) => item.programId))];

  const [programRows, companyRows, missionRows, resourceRows, submissionRows, rewardRows, profileRows, acceptanceRows, disputeRows, companyProfileRows, knowledgeRows] = await Promise.all([
    db.select().from(programs).where(inArray(programs.id, programIds)).orderBy(desc(programs.updatedAt)),
    db.select().from(companies).where(eq(companies.id, partner.companyId)).limit(1),
    db.select().from(missions).where(inArray(missions.programId, programIds)).orderBy(asc(missions.sortOrder)),
    db.select().from(missionResources).where(eq(missionResources.companyId, partner.companyId)).orderBy(asc(missionResources.createdAt)),
    db.select().from(submissions).where(inArray(submissions.partnerId, partnerIds)).orderBy(desc(submissions.createdAt)),
    db.select().from(rewards).where(inArray(rewards.partnerId, partnerIds)).orderBy(desc(rewards.createdAt)),
    db.select().from(partnerProfiles).where(inArray(partnerProfiles.partnerId, partnerIds)),
    db.select().from(partnerMissionAcceptances).where(inArray(partnerMissionAcceptances.partnerId, partnerIds)).orderBy(desc(partnerMissionAcceptances.acceptedAt)),
    db.select().from(submissionDisputes).where(inArray(submissionDisputes.partnerId, partnerIds)).orderBy(desc(submissionDisputes.createdAt)),
    db.select().from(companyProfileVersions).where(and(eq(companyProfileVersions.companyId, partner.companyId), eq(companyProfileVersions.status, "CONFIRMED"))).orderBy(desc(companyProfileVersions.versionNumber)).limit(1),
    db.select().from(companyKnowledgeItems).where(and(eq(companyKnowledgeItems.companyId, partner.companyId), eq(companyKnowledgeItems.status, "PUBLISHED"))).orderBy(asc(companyKnowledgeItems.sortOrder), desc(companyKnowledgeItems.updatedAt)),
  ]);
  const company = companyRows[0];
  const currentProgram = programRows.find((item) => item.id === partner.programId);
  if (!currentProgram || !company) return null;
  const submissionIds = submissionRows.map((item) => item.id);
  const [eventRows, attachmentRows] = submissionIds.length ? await Promise.all([
    db.select().from(submissionStatusEvents).where(inArray(submissionStatusEvents.submissionId, submissionIds)).orderBy(desc(submissionStatusEvents.createdAt)),
    db.select().from(submissionAttachments).where(inArray(submissionAttachments.submissionId, submissionIds)).orderBy(asc(submissionAttachments.createdAt)),
  ]) : [[], []];

  const serializedMissions = missionRows.map((mission) => {
    const missionProgram = programRows.find((item) => item.id === mission.programId)!;
    return {
      ...mission,
      instructions: parseList(mission.instructionsJson),
      proofRequirements: parseList(mission.proofRequirementsJson),
      programName: missionProgram.name,
      programSlug: missionProgram.slug,
      programExpiresAt: missionProgram.expiresAt,
      currency: missionProgram.currency,
      resources: resourceRows.filter((resource) => resource.missionId === mission.id).map(({ id, fileName, mimeType, size }) => ({ id, fileName, mimeType, size })),
    };
  });
  const serializedSubmissions = submissionRows.map((submission) => ({
    ...submission,
    ...parsePayload(submission.payloadJson),
    mission: serializedMissions.find((mission) => mission.id === submission.missionId) ?? null,
    events: eventRows.filter((event) => event.submissionId === submission.id),
    attachments: attachmentRows.filter((attachment) => attachment.submissionId === submission.id),
    reward: rewardRows.find((reward) => reward.submissionId === submission.id) ?? null,
    dispute: disputeRows.find((dispute) => dispute.submissionId === submission.id && dispute.status === "OPEN") ?? null,
  }));
  const profile = profileRows.find((item) => item.firstName || item.avatarObjectKey) ?? profileRows.find((item) => item.partnerId === partner.id);

  return {
    token,
    partner,
    partners: identityRows,
    company,
    program: currentProgram,
    programs: programRows,
    missions: serializedMissions,
    submissions: serializedSubmissions,
    rewards: rewardRows,
    acceptances: acceptanceRows,
    knowledgeItems: knowledgeRows,
    profile: {
      firstName: profile?.firstName || partner.name.split(/\s+/)[0] || "",
      lastName: profile?.lastName || partner.name.split(/\s+/).slice(1).join(" "),
      middleName: profile?.middleName ?? "",
      instagram: profile?.instagram ?? "",
      avatarObjectKey: profile?.avatarObjectKey ?? null,
      skills: parseList(profile?.skillsJson),
      industries: parseList(profile?.industriesJson),
      geographies: parseList(profile?.geographiesJson),
      preferredTypes: parseList(profile?.preferredTypesJson),
      emailVerifiedAt: profile?.emailVerifiedAt ?? null,
      whatsappVerifiedAt: profile?.whatsappVerifiedAt ?? null,
    },
    companyProfile: companyProfileRows[0] ? {
      businessDescription: companyProfileRows[0].businessDescription,
      products: parseList(companyProfileRows[0].productsJson),
      targetAudience: companyProfileRows[0].targetAudience,
      advantages: parseList(companyProfileRows[0].advantagesJson),
      partnerPitch: companyProfileRows[0].partnerPitch,
    } : null,
  };
}

export async function getPartnerAttachment(token: string, attachmentId: string) {
  const portal = await getPartnerPortal(token);
  if (!portal) return null;
  const attachment = (await getDb().select().from(submissionAttachments).where(eq(submissionAttachments.id, attachmentId)).limit(1))[0];
  if (!attachment || !portal.submissions.some((submission) => submission.id === attachment.submissionId)) return null;
  return attachment;
}

export async function getPartnerKnowledgeFile(token: string, itemId: string) {
  const portal = await getPartnerPortal(token);
  if (!portal) return null;
  return portal.knowledgeItems.find((item) => item.id === itemId && item.objectKey) ?? null;
}

export async function getPartnerMissionResource(token: string, resourceId: string) {
  const portal = await getPartnerPortal(token);
  if (!portal) return null;
  const resource = (await getDb().select().from(missionResources).where(eq(missionResources.id, resourceId)).limit(1))[0];
  if (!resource || resource.companyId !== portal.company.id || !portal.missions.some((mission) => mission.id === resource.missionId)) return null;
  return resource;
}

export async function getMissionForPublicSubmission(programSlug: string, missionId: string) {
  const rows = await getDb().select({ program: programs, mission: missions, company: companies })
    .from(missions)
    .innerJoin(programs, eq(missions.programId, programs.id))
    .innerJoin(companies, eq(programs.companyId, companies.id))
    .where(and(eq(programs.slug, programSlug), eq(programs.status, "ACTIVE"), eq(missions.id, missionId), eq(missions.status, "ACTIVE")))
    .limit(1);
  return rows[0] ?? null;
}

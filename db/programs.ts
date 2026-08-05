import { and, asc, count, desc, eq, inArray, sum } from "drizzle-orm";
import { getDb } from ".";
import { missions, partners, programs, rewards, submissions } from "./schema";

function parseList(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parsePartnerComment(value: string) {
  try {
    const parsed = JSON.parse(value) as { partnerComment?: unknown };
    return typeof parsed.partnerComment === "string" ? parsed.partnerComment : "";
  } catch {
    return "";
  }
}

export type MissionRecord = {
  id: string;
  type: string;
  title: string;
  description: string;
  instructions: string[];
  proofRequirements: string[];
  rewardMode: string;
  rewardValue: number;
  rewardLabel: string;
  verificationRules: string;
  status: string;
  sortOrder: number;
};

export type ProgramRecord = {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  description: string;
  goal: string;
  currency: string;
  payoutTerms: string;
  legalTerms: string;
  expiresAt: string | null;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  missions: MissionRecord[];
};

function serializeMission(row: typeof missions.$inferSelect): MissionRecord {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    instructions: parseList(row.instructionsJson),
    proofRequirements: parseList(row.proofRequirementsJson),
    rewardMode: row.rewardMode,
    rewardValue: row.rewardValue,
    rewardLabel: row.rewardLabel,
    verificationRules: row.verificationRules,
    status: row.status,
    sortOrder: row.sortOrder,
  };
}

async function attachMissions(programRows: Array<typeof programs.$inferSelect>) {
  if (programRows.length === 0) return [];
  const missionRows = await getDb().select().from(missions).where(inArray(missions.programId, programRows.map((program) => program.id))).orderBy(asc(missions.sortOrder));
  return programRows.map((program): ProgramRecord => ({
    id: program.id,
    companyId: program.companyId,
    name: program.name,
    slug: program.slug,
    description: program.description,
    goal: program.goal,
    currency: program.currency,
    payoutTerms: program.payoutTerms,
    legalTerms: program.legalTerms,
    expiresAt: program.expiresAt,
    status: program.status,
    publishedAt: program.publishedAt,
    createdAt: program.createdAt,
    updatedAt: program.updatedAt,
    missions: missionRows.filter((mission) => mission.programId === program.id).map(serializeMission),
  }));
}

export async function getProgramsForCompany(companyId: string) {
  const rows = await getDb().select().from(programs).where(eq(programs.companyId, companyId)).orderBy(desc(programs.updatedAt));
  return attachMissions(rows);
}

export async function getProgramForCompany(companyId: string, programId: string) {
  const rows = await getDb().select().from(programs).where(and(eq(programs.companyId, companyId), eq(programs.id, programId))).limit(1);
  const result = await attachMissions(rows);
  return result[0] ?? null;
}

export async function getPublicProgramBySlug(slug: string) {
  const rows = await getDb().select().from(programs).where(and(eq(programs.slug, slug), eq(programs.status, "ACTIVE"))).limit(1);
  const result = await attachMissions(rows);
  return result[0] ?? null;
}

export async function getCompanyOperations(companyId: string) {
  const db = getDb();
  const [programCount, activeProgramCount, partnerCount, activePartnerCount, submissionCount, reviewCount, approvedRewards, paidRewards] = await Promise.all([
    db.select({ value: count() }).from(programs).where(eq(programs.companyId, companyId)),
    db.select({ value: count() }).from(programs).where(and(eq(programs.companyId, companyId), eq(programs.status, "ACTIVE"))),
    db.select({ value: count() }).from(partners).where(eq(partners.companyId, companyId)),
    db.select({ value: count() }).from(partners).where(and(eq(partners.companyId, companyId), eq(partners.status, "ACTIVE"))),
    db.select({ value: count() }).from(submissions).where(eq(submissions.companyId, companyId)),
    db.select({ value: count() }).from(submissions).where(and(eq(submissions.companyId, companyId), eq(submissions.status, "SUBMITTED"))),
    db.select({ value: sum(rewards.amount) }).from(rewards).where(and(eq(rewards.companyId, companyId), eq(rewards.status, "APPROVED"))),
    db.select({ value: sum(rewards.amount) }).from(rewards).where(and(eq(rewards.companyId, companyId), eq(rewards.status, "PAID"))),
  ]);
  return {
    programs: programCount[0]?.value ?? 0,
    activePrograms: activeProgramCount[0]?.value ?? 0,
    partners: partnerCount[0]?.value ?? 0,
    activePartners: activePartnerCount[0]?.value ?? 0,
    submissions: submissionCount[0]?.value ?? 0,
    awaitingReview: reviewCount[0]?.value ?? 0,
    approvedRewards: Number(approvedRewards[0]?.value ?? 0),
    paidRewards: Number(paidRewards[0]?.value ?? 0),
  };
}

export async function getSubmissionsForCompany(companyId: string) {
  const db = getDb();
  const rows = await db.select({ submission: submissions, partner: partners, mission: missions, program: programs })
    .from(submissions)
    .innerJoin(partners, eq(submissions.partnerId, partners.id))
    .innerJoin(missions, eq(submissions.missionId, missions.id))
    .innerJoin(programs, eq(submissions.programId, programs.id))
    .where(eq(submissions.companyId, companyId))
    .orderBy(desc(submissions.createdAt));
  return rows.map((row) => ({
    ...row.submission,
    partnerName: row.partner.name,
    partnerEmail: row.partner.email,
    missionTitle: row.mission.title,
    rewardValue: row.mission.rewardValue,
    rewardLabel: row.mission.rewardLabel,
    currency: row.program.currency,
    programName: row.program.name,
    partnerComment: parsePartnerComment(row.submission.payloadJson),
  }));
}

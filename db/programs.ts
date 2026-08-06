import { and, asc, count, desc, eq, inArray, sum } from "drizzle-orm";
import { getDb } from ".";
import { missions, partners, programs, rewards, submissionAttachments, submissions } from "./schema";

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
  agentCount: number;
  resultCount: number;
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
  const ids = programRows.map((program) => program.id);
  const [missionRows, agentRows, resultRows] = await Promise.all([
    getDb().select().from(missions).where(inArray(missions.programId, ids)).orderBy(asc(missions.sortOrder)),
    getDb().select({ id: partners.id, programId: partners.programId }).from(partners).where(inArray(partners.programId, ids)),
    getDb().select({ id: submissions.id, programId: submissions.programId }).from(submissions).where(inArray(submissions.programId, ids)),
  ]);
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
    agentCount: agentRows.filter((agent) => agent.programId === program.id).length,
    resultCount: resultRows.filter((result) => result.programId === program.id).length,
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
  const ids = rows.map((row) => row.submission.id);
  const attachmentRows = ids.length ? await db.select().from(submissionAttachments).where(inArray(submissionAttachments.submissionId, ids)).orderBy(asc(submissionAttachments.createdAt)) : [];
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
    attachments: attachmentRows.filter((attachment) => attachment.submissionId === row.submission.id),
  }));
}

export async function getAgentsForCompany(companyId: string) {
  const db = getDb();
  const rows = await db.select({ agent: partners, program: programs })
    .from(partners)
    .innerJoin(programs, eq(partners.programId, programs.id))
    .where(eq(partners.companyId, companyId))
    .orderBy(desc(partners.joinedAt));
  const ids = rows.map((row) => row.agent.id);
  const [resultRows, rewardRows] = ids.length ? await Promise.all([
    db.select({ id: submissions.id, partnerId: submissions.partnerId, status: submissions.status }).from(submissions).where(inArray(submissions.partnerId, ids)),
    db.select({ partnerId: rewards.partnerId, amount: rewards.amount, status: rewards.status }).from(rewards).where(inArray(rewards.partnerId, ids)),
  ]) : [[], []];
  return rows.map(({ agent, program }) => {
    const agentRewards = rewardRows.filter((reward) => reward.partnerId === agent.id);
    return {
      ...agent,
      programName: program.name,
      programSlug: program.slug,
      resultCount: resultRows.filter((result) => result.partnerId === agent.id).length,
      dealCount: resultRows.filter((result) => result.partnerId === agent.id && result.status === "DEAL").length,
      dueAmount: agentRewards.filter((reward) => reward.status === "APPROVED").reduce((total, reward) => total + reward.amount, 0),
      paidAmount: agentRewards.filter((reward) => reward.status === "PAID").reduce((total, reward) => total + reward.amount, 0),
    };
  });
}

export async function getRewardsForCompany(companyId: string) {
  return getDb().select({ reward: rewards, agent: partners, submission: submissions, mission: missions, program: programs })
    .from(rewards)
    .innerJoin(partners, eq(rewards.partnerId, partners.id))
    .innerJoin(submissions, eq(rewards.submissionId, submissions.id))
    .innerJoin(missions, eq(submissions.missionId, missions.id))
    .innerJoin(programs, eq(submissions.programId, programs.id))
    .where(eq(rewards.companyId, companyId))
    .orderBy(desc(rewards.createdAt));
}

export async function getCompanyAnalytics(companyId: string, days: number | null, programId?: string) {
  const db = getDb();
  const calculatedAt = Date.now();
  const [programRows, agentRows, resultRows, rewardRows] = await Promise.all([
    db.select().from(programs).where(eq(programs.companyId, companyId)),
    db.select().from(partners).where(eq(partners.companyId, companyId)),
    db.select().from(submissions).where(eq(submissions.companyId, companyId)),
    db.select().from(rewards).where(eq(rewards.companyId, companyId)),
  ]);
  const since = days ? calculatedAt - days * 86400000 : 0;
  const within = (date: string | null) => !days || (date ? new Date(date).getTime() >= since : false);
  const selectedPrograms = programRows.filter((program) => !programId || program.id === programId);
  const selectedIds = new Set(selectedPrograms.map((program) => program.id));
  const agents = agentRows.filter((agent) => selectedIds.has(agent.programId) && within(agent.joinedAt));
  const results = resultRows.filter((result) => selectedIds.has(result.programId) && within(result.createdAt));
  const resultIds = new Set(results.map((result) => result.id));
  const rewardItems = rewardRows.filter((reward) => resultIds.has(reward.submissionId));
  const byProgram = selectedPrograms.map((program) => {
    const programResults = results.filter((result) => result.programId === program.id);
    return {
      id: program.id,
      name: program.name,
      agents: agents.filter((agent) => agent.programId === program.id).length,
      results: programResults.length,
      accepted: programResults.filter((result) => ["ACCEPTED", "IN_PROGRESS", "DEAL", "REWARDED"].includes(result.status)).length,
      deals: programResults.filter((result) => result.status === "DEAL").length,
      paid: rewardItems.filter((reward) => reward.status === "PAID" && programResults.some((result) => result.id === reward.submissionId)).reduce((total, reward) => total + reward.amount, 0),
    };
  });
  return { programs: selectedPrograms, agents, results, rewards: rewardItems, byProgram, calculatedAt };
}

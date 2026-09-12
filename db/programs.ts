import { and, asc, count, countDistinct, desc, eq, inArray, isNotNull, sum } from "drizzle-orm";
import { getDb } from ".";
import { missionResources, missions, partners, programs, rewards, submissionAttachments, submissionStatusEvents, submissions } from "./schema";
import { parseSubmissionFormFields, type SubmissionFormField } from "../lib/submission-form";
import { isAnalyticsProgram } from "../lib/workflow";

function batches<T>(values: T[], size = 80): T[][] {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, i) => values.slice(i * size, (i + 1) * size));
}

function parseList(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseSubmissionPayload(value: string) {
  try {
    const parsed = JSON.parse(value) as { partnerComment?: unknown; customAnswers?: unknown; audioTranscript?: unknown; audioDurationSeconds?: unknown; audioConfirmed?: unknown; submittedByClient?: unknown; referralSource?: unknown };
    return {
      partnerComment: typeof parsed.partnerComment === "string" ? parsed.partnerComment : "",
      customAnswers: Array.isArray(parsed.customAnswers) ? parsed.customAnswers.filter((item): item is { fieldId: string; label: string; type: string; value: string | string[] } => Boolean(item && typeof item === "object" && typeof (item as { label?: unknown }).label === "string")) : [],
      audioTranscript: typeof parsed.audioTranscript === "string" ? parsed.audioTranscript : "",
      audioDurationSeconds: typeof parsed.audioDurationSeconds === "number" ? parsed.audioDurationSeconds : 0,
      audioConfirmed: parsed.audioConfirmed === true,
      submittedByClient: parsed.submittedByClient === true,
      referralSource: typeof parsed.referralSource === "string" ? parsed.referralSource : "AMBASSADOR_SUBMISSION",
    };
  } catch {
    return { partnerComment: "", customAnswers: [] as Array<{ fieldId: string; label: string; type: string; value: string | string[] }>, audioTranscript: "", audioDurationSeconds: 0, audioConfirmed: false, submittedByClient: false, referralSource: "AMBASSADOR_SUBMISSION" };
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
  rewardTrigger: string;
  verificationRules: string;
  status: string;
  sortOrder: number;
  resources: Array<{ id: string; fileName: string; mimeType: string; size: number }>;
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
  formFields: SubmissionFormField[];
  isTest: boolean;
  expiresAt: string | null;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  missions: MissionRecord[];
  agentCount: number;
  resultCount: number;
};

function serializeMission(row: typeof missions.$inferSelect, resources: Array<typeof missionResources.$inferSelect> = []): MissionRecord {
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
    rewardTrigger: row.rewardTrigger,
    verificationRules: row.verificationRules,
    status: row.status,
    sortOrder: row.sortOrder,
    resources: resources.filter((resource) => resource.missionId === row.id).map(({ id, fileName, mimeType, size }) => ({ id, fileName, mimeType, size })),
  };
}

async function attachMissions(programRows: Array<typeof programs.$inferSelect>) {
  if (programRows.length === 0) return [];
  const ids = programRows.map((program) => program.id);
  const [missionRows, resourceRows, agentRows, resultRows] = await Promise.all([
    getDb().select().from(missions).where(inArray(missions.programId, ids)).orderBy(asc(missions.sortOrder)),
    getDb().select().from(missionResources).where(inArray(missionResources.companyId, programRows.map((program) => program.companyId))).orderBy(asc(missionResources.createdAt)),
    getDb().select({ id: partners.id, programId: partners.programId }).from(partners).where(inArray(partners.programId, ids)),
    getDb().select({ id: submissions.id, programId: submissions.programId }).from(submissions).where(inArray(submissions.programId, ids)),
  ]);
  const resourcesByMission = new Map<string, Array<typeof missionResources.$inferSelect>>();
  for (const resource of resourceRows) resourcesByMission.set(resource.missionId, [...(resourcesByMission.get(resource.missionId) ?? []), resource]);
  const missionsByProgram = new Map<string, MissionRecord[]>();
  for (const mission of missionRows) missionsByProgram.set(mission.programId, [...(missionsByProgram.get(mission.programId) ?? []), serializeMission(mission, resourcesByMission.get(mission.id) ?? [])]);
  const agentCounts = new Map<string, number>();
  for (const agent of agentRows) agentCounts.set(agent.programId, (agentCounts.get(agent.programId) ?? 0) + 1);
  const resultCounts = new Map<string, number>();
  for (const result of resultRows) resultCounts.set(result.programId, (resultCounts.get(result.programId) ?? 0) + 1);
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
    formFields: parseSubmissionFormFields(program.submissionFormJson),
    isTest: program.isTest,
    expiresAt: program.expiresAt,
    status: program.status,
    publishedAt: program.publishedAt,
    createdAt: program.createdAt,
    updatedAt: program.updatedAt,
    missions: missionsByProgram.get(program.id) ?? [],
    agentCount: agentCounts.get(program.id) ?? 0,
    resultCount: resultCounts.get(program.id) ?? 0,
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
  const [programCount, activeProgramCount, partnerCount, activePartnerCount, contributedPartnerCount, convertedPartnerCount, submissionCount, reviewCount, approvedRewards, paidRewards, approvedByCurrency, paidByCurrency] = await Promise.all([
    db.select({ value: count() }).from(programs).where(eq(programs.companyId, companyId)),
    db.select({ value: count() }).from(programs).where(and(eq(programs.companyId, companyId), eq(programs.status, "ACTIVE"))),
    db.select({ value: countDistinct(partners.email) }).from(partners).where(eq(partners.companyId, companyId)),
    db.select({ value: countDistinct(partners.email) }).from(partners).where(and(eq(partners.companyId, companyId), eq(partners.status, "ACTIVE"))),
    db.select({ value: countDistinct(submissions.partnerId) }).from(submissions).where(eq(submissions.companyId, companyId)),
    db.select({ value: countDistinct(submissions.partnerId) }).from(submissions).where(and(eq(submissions.companyId, companyId), eq(submissions.salesStatus, "WON"))),
    db.select({ value: count() }).from(submissions).where(eq(submissions.companyId, companyId)),
    db.select({ value: count() }).from(submissions).where(and(eq(submissions.companyId, companyId), inArray(submissions.reviewStatus, ["PENDING", "REVIEWING"]))),
    db.select({ value: sum(rewards.amount) }).from(rewards).where(and(eq(rewards.companyId, companyId), eq(rewards.status, "APPROVED"))),
    db.select({ value: sum(rewards.amount) }).from(rewards).where(and(eq(rewards.companyId, companyId), eq(rewards.status, "PAID"), isNotNull(rewards.partnerConfirmedAt))),
    db.select({ currency: rewards.currency, amount: sum(rewards.amount) }).from(rewards).where(and(eq(rewards.companyId, companyId), eq(rewards.status, "APPROVED"))).groupBy(rewards.currency),
    db.select({ currency: rewards.currency, amount: sum(rewards.amount) }).from(rewards).where(and(eq(rewards.companyId, companyId), eq(rewards.status, "PAID"), isNotNull(rewards.partnerConfirmedAt))).groupBy(rewards.currency),
  ]);
  return {
    programs: programCount[0]?.value ?? 0,
    activePrograms: activeProgramCount[0]?.value ?? 0,
    partners: partnerCount[0]?.value ?? 0,
    activePartners: activePartnerCount[0]?.value ?? 0,
    contributedPartners: contributedPartnerCount[0]?.value ?? 0,
    convertedPartners: convertedPartnerCount[0]?.value ?? 0,
    submissions: submissionCount[0]?.value ?? 0,
    awaitingReview: reviewCount[0]?.value ?? 0,
    approvedRewards: Number(approvedRewards[0]?.value ?? 0),
    paidRewards: Number(paidRewards[0]?.value ?? 0),
    approvedRewardsByCurrency: approvedByCurrency.map((item) => ({ amount: Number(item.amount ?? 0), currency: item.currency })),
    paidRewardsByCurrency: paidByCurrency.map((item) => ({ amount: Number(item.amount ?? 0), currency: item.currency })),
  };
}

export async function getSubmissionsForCompany(companyId: string, options: { ids?: string[]; limit?: number; details?: boolean } = {}) {
  if (options.ids?.length === 0) return [];
  const db = getDb();
  const readRows = (ids?: string[]) => db.select({ submission: submissions, partner: partners, mission: missions, program: programs })
    .from(submissions)
    .innerJoin(partners, eq(submissions.partnerId, partners.id))
    .innerJoin(missions, eq(submissions.missionId, missions.id))
    .innerJoin(programs, eq(submissions.programId, programs.id))
    .where(and(eq(submissions.companyId, companyId), ids ? inArray(submissions.id, ids) : undefined))
    .orderBy(desc(submissions.createdAt), desc(submissions.id)).limit(options.limit ?? 2147483647);
  // D1 permits at most 100 bound parameters. Hydrate bounded batches, not one large IN clause.
  const rows = options.ids ? (await Promise.all(batches(options.ids).map(readRows))).flat().sort((a, b) => b.submission.createdAt.localeCompare(a.submission.createdAt) || b.submission.id.localeCompare(a.submission.id)).slice(0, options.limit) : await readRows();
  const ids = rows.map((row) => row.submission.id);
  const [attachmentRows, eventRows, rewardRows] = ids.length ? await Promise.all([
    options.details === false ? [] : Promise.all(batches(ids).map((batch) => db.select().from(submissionAttachments).where(inArray(submissionAttachments.submissionId, batch)).orderBy(asc(submissionAttachments.createdAt)))).then((rows) => rows.flat()),
    options.details === false ? [] : Promise.all(batches(ids).map((batch) => db.select().from(submissionStatusEvents).where(inArray(submissionStatusEvents.submissionId, batch)).orderBy(desc(submissionStatusEvents.createdAt)))).then((rows) => rows.flat()),
    Promise.all(batches(ids).map((batch) => db.select().from(rewards).where(inArray(rewards.submissionId, batch)))).then((rows) => rows.flat()),
  ]) : [[], [], []];
  const attachmentsBySubmission = new Map<string, typeof attachmentRows>();
  for (const attachment of attachmentRows) attachmentsBySubmission.set(attachment.submissionId, [...(attachmentsBySubmission.get(attachment.submissionId) ?? []), attachment]);
  const eventsBySubmission = new Map<string, typeof eventRows>();
  for (const event of eventRows) eventsBySubmission.set(event.submissionId, [...(eventsBySubmission.get(event.submissionId) ?? []), event]);
  const rewardBySubmission = new Map(rewardRows.map((reward) => [reward.submissionId, reward]));
  return rows.map((row) => ({
    ...row.submission,
    partnerName: row.partner.name,
    partnerEmail: row.partner.email,
    partnerPhone: row.partner.phone,
    missionTitle: row.mission.title,
    rewardMode: row.mission.rewardMode,
    rewardValue: row.mission.rewardValue,
    rewardLabel: row.mission.rewardLabel,
    currency: rewardBySubmission.get(row.submission.id)?.currency || row.program.currency,
    programName: row.program.name,
    ...parseSubmissionPayload(row.submission.payloadJson),
    reward: rewardBySubmission.get(row.submission.id) ?? null,
    attachments: attachmentsBySubmission.get(row.submission.id) ?? [],
    events: eventsBySubmission.get(row.submission.id) ?? [],
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
    Promise.all(batches(ids).map((batch) => db.select({ id: submissions.id, partnerId: submissions.partnerId, status: submissions.status, reviewStatus: submissions.reviewStatus, salesStatus: submissions.salesStatus }).from(submissions).where(inArray(submissions.partnerId, batch)))).then((rows) => rows.flat()),
    Promise.all(batches(ids).map((batch) => db.select({ partnerId: rewards.partnerId, amount: rewards.amount, status: rewards.status, partnerConfirmedAt: rewards.partnerConfirmedAt }).from(rewards).where(inArray(rewards.partnerId, batch)))).then((rows) => rows.flat()),
  ]) : [[], []];
  const resultsByPartner = new Map<string, typeof resultRows>();
  for (const result of resultRows) resultsByPartner.set(result.partnerId, [...(resultsByPartner.get(result.partnerId) ?? []), result]);
  const rewardsByPartner = new Map<string, typeof rewardRows>();
  for (const reward of rewardRows) rewardsByPartner.set(reward.partnerId, [...(rewardsByPartner.get(reward.partnerId) ?? []), reward]);
  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.agent.userId || row.agent.email.toLowerCase();
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return [...grouped.values()].map((group) => {
    const primary = group[0].agent;
    const groupIds = group.map((item) => item.agent.id);
    const agentResults = groupIds.flatMap((id) => resultsByPartner.get(id) ?? []);
    const agentRewards = groupIds.flatMap((id) => rewardsByPartner.get(id) ?? []);
    return {
      ...primary,
      status: group.some((item) => item.agent.status === "ACTIVE") ? "ACTIVE" : "BLOCKED",
      joinedAt: group.map((item) => item.agent.joinedAt).sort()[0],
      lastActiveAt: group.map((item) => item.agent.lastActiveAt).filter(Boolean).sort().at(-1) ?? null,
      programName: group.map((item) => item.program.name).join(", "),
      programSlug: group[0].program.slug,
      programCount: group.length,
      resultCount: agentResults.length,
      dealCount: agentResults.filter((result) => result.salesStatus === "WON").length,
      dueAmount: agentRewards.filter((reward) => reward.status === "APPROVED").reduce((total, reward) => total + reward.amount, 0),
      paidAmount: agentRewards.filter((reward) => reward.status === "PAID" && reward.partnerConfirmedAt).reduce((total, reward) => total + reward.amount, 0),
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
  const selectedPrograms = programRows.filter((program) => programId ? program.id === programId : isAnalyticsProgram(program));
  const selectedIds = new Set(selectedPrograms.map((program) => program.id));
  const programAgents = agentRows.filter((agent) => selectedIds.has(agent.programId));
  const identityGroups = new Map<string, typeof programAgents>();
  for (const agent of programAgents) {
    const key = agent.userId || agent.email.toLowerCase();
    identityGroups.set(key, [...(identityGroups.get(key) ?? []), agent]);
  }
  const agents = [...identityGroups.values()].map((group) => group[0]);
  const newAgents = [...identityGroups.values()].filter((group) => group.some((agent) => within(agent.joinedAt))).map((group) => group[0]);
  const results = resultRows.filter((result) => selectedIds.has(result.programId) && within(result.createdAt));
  const resultIds = new Set(results.map((result) => result.id));
  const rewardItems = rewardRows.filter((reward) => resultIds.has(reward.submissionId));
  const agentsByProgram = new Map<string, typeof programAgents>();
  for (const agent of programAgents) agentsByProgram.set(agent.programId, [...(agentsByProgram.get(agent.programId) ?? []), agent]);
  const resultsByProgram = new Map<string, typeof results>();
  const resultsByPartner = new Map<string, typeof results>();
  for (const result of results) {
    resultsByProgram.set(result.programId, [...(resultsByProgram.get(result.programId) ?? []), result]);
    resultsByPartner.set(result.partnerId, [...(resultsByPartner.get(result.partnerId) ?? []), result]);
  }
  const rewardsBySubmission = new Map(rewardItems.map((reward) => [reward.submissionId, reward]));
  const byProgram = selectedPrograms.map((program) => {
    const programResults = resultsByProgram.get(program.id) ?? [];
    return {
      id: program.id,
      name: program.name,
      currency: program.currency,
      agents: new Set((agentsByProgram.get(program.id) ?? []).map((agent) => agent.userId || agent.email.toLowerCase())).size,
      results: programResults.length,
      accepted: programResults.filter((result) => result.reviewStatus === "ACCEPTED").length,
      deals: programResults.filter((result) => result.salesStatus === "WON").length,
      paid: programResults.map((result) => rewardsBySubmission.get(result.id)).filter((reward) => reward?.status === "PAID" && reward.partnerConfirmedAt).reduce((total, reward) => total + (reward?.amount ?? 0), 0),
    };
  });
  const programNames = new Map(selectedPrograms.map((program) => [program.id, program.name]));
  const byAgent = [...identityGroups.values()].map((group) => {
    const agent = group[0];
    const groupIds = group.map((item) => item.id);
    const agentResults = groupIds.flatMap((id) => resultsByPartner.get(id) ?? []);
    const agentResultIds = new Set(agentResults.map((result) => result.id));
    const agentRewards = [...agentResultIds].map((id) => rewardsBySubmission.get(id)).filter((reward): reward is NonNullable<typeof reward> => Boolean(reward));
    const accepted = agentResults.filter((result) => result.reviewStatus === "ACCEPTED").length;
    const deals = agentResults.filter((result) => result.salesStatus === "WON").length;
    const activityDates = [agent.lastActiveAt, ...agentResults.map((result) => result.updatedAt || result.createdAt)].filter(Boolean).map((date) => new Date(date as string).getTime());
    return {
      id: agent.id,
      name: agent.name,
      email: agent.email,
      phone: agent.phone,
      programId: agent.programId,
      programName: [...new Set(group.map((item) => programNames.get(item.programId) ?? "Программа"))].join(", "),
      joinedAt: agent.joinedAt,
      lastActivity: new Date(Math.max(...activityDates, new Date(agent.joinedAt).getTime())).toISOString(),
      results: agentResults.length,
      accepted,
      deals,
      acceptanceRate: agentResults.length ? Math.round(accepted / agentResults.length * 100) : 0,
      dealRate: agentResults.length ? Math.round(deals / agentResults.length * 100) : 0,
      due: agentRewards.filter((reward) => reward.status === "APPROVED").reduce((total, reward) => total + reward.amount, 0),
      paid: agentRewards.filter((reward) => reward.status === "PAID" && reward.partnerConfirmedAt).reduce((total, reward) => total + reward.amount, 0),
      dueByCurrency: agentRewards.filter((reward) => reward.status === "APPROVED").map((reward) => ({ amount: reward.amount, currency: reward.currency })),
      paidByCurrency: agentRewards.filter((reward) => reward.status === "PAID" && reward.partnerConfirmedAt).map((reward) => ({ amount: reward.amount, currency: reward.currency })),
      score: deals * 100 + accepted * 20 + agentResults.length * 5,
    };
  }).sort((left, right) => right.score - left.score || new Date(right.lastActivity).getTime() - new Date(left.lastActivity).getTime());
  return { programs: selectedPrograms, agents, newAgents, results, rewards: rewardItems, byProgram, byAgent, calculatedAt };
}

import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { getCompanyForUser } from "../../../../db/company";
import { getProgramForCompany } from "../../../../db/programs";
import { companies, missionResources, missions, programs, submissions } from "../../../../db/schema";
import { getFilesBucket } from "../../../../lib/storage";
import { cleanList, cleanString, sameOrigin } from "../../company/_utils";
import { agentUrl } from "../../../../lib/public-origins";
import { normalizeSubmissionFormFields } from "../../../../lib/submission-form";

const GOALS = new Set(["LEADS", "DEALS", "BRAND", "ENGAGEMENT", "MIXED"]);
const CURRENCIES = new Set(["KZT", "RUB", "USD", "EUR"]);
const REWARD_MODES = new Set(["FIXED", "PERCENT", "POINTS", "NON_MONETARY"]);
const MISSION_TYPES = new Set(["LEAD", "DEAL", "IMAGE", "ENGAGEMENT"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Сначала войдите в аккаунт" }, { status: 401 });
  const company = await getCompanyForUser(user.userId);
  if (!company) return Response.json({ error: "Компания не найдена" }, { status: 404 });
  const { id } = await params;
  const current = await getProgramForCompany(company.id, id);
  if (!current) return Response.json({ error: "Программа не найдена" }, { status: 404 });

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const name = cleanString(payload.name, 100);
    const description = cleanString(payload.description, 1800);
    const goal = cleanString(payload.goal, 30);
    const currency = cleanString(payload.currency, 5);
    const payoutTerms = cleanString(payload.payoutTerms, 1800);
    const legalTerms = cleanString(payload.legalTerms, 2400);
    const expiresAtValue = cleanString(payload.expiresAt, 30);
    const publish = payload.publish === true;
    const pause = payload.pause === true;
    const missionPayloads = Array.isArray(payload.missions) ? payload.missions as Array<Record<string, unknown>> : [];
    const formFields = normalizeSubmissionFormFields(payload.formFields);
    if (name.length < 3 || !description) throw new Error("Заполните название и описание программы");
    const duplicate = await getDb().select({ id: programs.id }).from(programs).where(and(eq(programs.companyId, company.id), eq(programs.name, name))).limit(2);
    if (duplicate.some((program) => program.id !== id)) throw new Error("Программа с таким названием уже существует. Добавьте назначение или аудиторию в название.");
    if (!GOALS.has(goal) || !CURRENCIES.has(currency)) throw new Error("Проверьте цель и валюту программы");
    if (missionPayloads.length < current.missions.length || missionPayloads.length === 0 || missionPayloads.length > 12) throw new Error("В программе должно быть от 1 до 12 заданий");

    const currentMissionIds = new Set(current.missions.map((mission) => mission.id));
    const normalizedMissions = missionPayloads.map((mission, index) => {
      const incomingId = cleanString(mission.id, 80);
      const isNew = !currentMissionIds.has(incomingId);
      const missionId = isNew ? crypto.randomUUID() : incomingId;
      const type = cleanString(mission.type, 20);
      if (!MISSION_TYPES.has(type)) throw new Error("Выберите корректный тип задания");
      const title = cleanString(mission.title, 120);
      const missionDescription = cleanString(mission.description, 1200);
      const instructions = cleanList(mission.instructions, 6, 240);
      const proofRequirements = cleanList(mission.proofRequirements, 5, 240);
      const rewardMode = cleanString(mission.rewardMode, 30);
      const rewardValue = Math.max(0, Math.min(100000000, Math.round(Number(mission.rewardValue) || 0)));
      const rewardLabel = cleanString(mission.rewardLabel, 120);
      const verificationRules = cleanString(mission.verificationRules, 1200);
      if (!REWARD_MODES.has(rewardMode)) throw new Error("Выберите корректный тип вознаграждения");
      if (publish && (!title || !missionDescription || instructions.length < 1 || proofRequirements.length < 1 || !verificationRules)) throw new Error("Перед публикацией заполните описание, шаги, подтверждение и правила каждого задания");
      if (publish && rewardMode !== "NON_MONETARY" && rewardValue <= 0) throw new Error("Перед публикацией укажите размер вознаграждения для каждого денежного задания");
      if (publish && !rewardLabel) throw new Error("Перед публикацией укажите понятное название вознаграждения");
      return { id: missionId, type, title, description: missionDescription, instructions, proofRequirements, rewardMode, rewardValue, rewardLabel, verificationRules, sortOrder: index, isNew };
    });
    if (current.missions.some((mission) => !missionPayloads.some((payload) => cleanString(payload.id, 80) === mission.id))) throw new Error("Удаление действующих заданий пока недоступно: они могут быть связаны с результатами агентов");
    if (publish && (payoutTerms.length < 10 || legalTerms.length < 10)) throw new Error("Перед публикацией заполните сроки выплаты и юридические ограничения");

    let expiresAt: string | null = null;
    if (expiresAtValue) {
      const date = new Date(expiresAtValue);
      if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) throw new Error("Дата завершения должна быть в будущем");
      expiresAt = date.toISOString();
    }
    const now = new Date().toISOString();
    const nextStatus = pause ? "PAUSED" : publish ? "ACTIVE" : current.status;
    const db = getDb();
    const missionUpdates = normalizedMissions.filter((mission) => !mission.isNew).map((mission) => db.update(missions).set({
      title: mission.title,
      description: mission.description,
      instructionsJson: JSON.stringify(mission.instructions),
      proofRequirementsJson: JSON.stringify(mission.proofRequirements),
      rewardMode: mission.rewardMode,
      rewardValue: mission.rewardValue,
      rewardLabel: mission.rewardLabel,
      verificationRules: mission.verificationRules,
      sortOrder: mission.sortOrder,
      updatedAt: now,
    }).where(and(eq(missions.id, mission.id), eq(missions.programId, id))));
    const missionInserts = normalizedMissions.filter((mission) => mission.isNew).map((mission) => db.insert(missions).values({
      id: mission.id,
      programId: id,
      type: mission.type,
      title: mission.title,
      description: mission.description,
      instructionsJson: JSON.stringify(mission.instructions),
      proofRequirementsJson: JSON.stringify(mission.proofRequirements),
      rewardMode: mission.rewardMode,
      rewardValue: mission.rewardValue,
      rewardLabel: mission.rewardLabel,
      verificationRules: mission.verificationRules,
      sortOrder: mission.sortOrder,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    }));
    await db.batch([
      db.update(programs).set({ name, description, goal, currency, payoutTerms, legalTerms, submissionFormJson: JSON.stringify(formFields), expiresAt, status: nextStatus, publishedAt: publish ? current.publishedAt ?? now : current.publishedAt, updatedAt: now }).where(and(eq(programs.id, id), eq(programs.companyId, company.id))),
      ...missionUpdates,
      ...missionInserts,
      db.update(companies).set({ onboardingStatus: publish ? "PROGRAM_PUBLISHED" : "PROGRAM_DRAFT", updatedAt: now }).where(eq(companies.id, company.id)),
    ]);
    const saved = await getProgramForCompany(company.id, id);
    return Response.json({ status: nextStatus, publicUrl: nextStatus === "ACTIVE" ? agentUrl(`/p/${current.slug}`) : null, program: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сохранить программу";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Сначала войдите в аккаунт" }, { status: 401 });
  const company = await getCompanyForUser(user.userId);
  if (!company) return Response.json({ error: "Компания не найдена" }, { status: 404 });
  const { id } = await params;
  const current = await getProgramForCompany(company.id, id);
  if (!current) return Response.json({ error: "Программа не найдена" }, { status: 404 });
  const payload = await request.json() as { missionId?: string };
  const missionId = cleanString(payload.missionId, 80);
  const mission = current.missions.find((item) => item.id === missionId);
  if (!mission) return Response.json({ error: "Задание не найдено" }, { status: 404 });
  if (current.missions.length <= 1) return Response.json({ error: "В программе должно остаться хотя бы одно задание" }, { status: 400 });
  const linked = await getDb().select({ id: submissions.id }).from(submissions).where(eq(submissions.missionId, missionId)).limit(1);
  if (linked[0]) return Response.json({ error: "Нельзя удалить задание с результатами агентов. Поставьте программу на паузу и сохраните историю." }, { status: 409 });
  const resources = await getDb().select().from(missionResources).where(eq(missionResources.missionId, missionId));
  await Promise.all(resources.map((resource) => getFilesBucket().delete(resource.objectKey)));
  await getDb().batch([
    getDb().delete(missionResources).where(eq(missionResources.missionId, missionId)),
    getDb().delete(missions).where(and(eq(missions.id, missionId), eq(missions.programId, id))),
  ]);
  return Response.json({ ok: true });
}

import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { getCompanyForUser } from "../../../../db/company";
import { getProgramForCompany } from "../../../../db/programs";
import { companies, missions, programs } from "../../../../db/schema";
import { cleanList, cleanString, sameOrigin } from "../../company/_utils";

const GOALS = new Set(["LEADS", "DEALS", "BRAND", "ENGAGEMENT", "MIXED"]);
const CURRENCIES = new Set(["KZT", "RUB", "USD", "EUR"]);
const REWARD_MODES = new Set(["FIXED", "PERCENT", "POINTS", "NON_MONETARY"]);

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
    if (name.length < 3 || !description) throw new Error("Заполните название и описание программы");
    if (!GOALS.has(goal) || !CURRENCIES.has(currency)) throw new Error("Проверьте цель и валюту программы");
    if (missionPayloads.length !== current.missions.length || missionPayloads.length === 0) throw new Error("Набор миссий изменён некорректно");

    const currentMissionIds = new Set(current.missions.map((mission) => mission.id));
    const normalizedMissions = missionPayloads.map((mission, index) => {
      const missionId = cleanString(mission.id, 80);
      if (!currentMissionIds.has(missionId)) throw new Error("Одна из миссий не принадлежит программе");
      const title = cleanString(mission.title, 120);
      const missionDescription = cleanString(mission.description, 1200);
      const instructions = cleanList(mission.instructions, 6, 240);
      const proofRequirements = cleanList(mission.proofRequirements, 5, 240);
      const rewardMode = cleanString(mission.rewardMode, 30);
      const rewardValue = Math.max(0, Math.min(100000000, Math.round(Number(mission.rewardValue) || 0)));
      const rewardLabel = cleanString(mission.rewardLabel, 120);
      const verificationRules = cleanString(mission.verificationRules, 1200);
      if (!title || !missionDescription || instructions.length < 1 || proofRequirements.length < 1 || !verificationRules) throw new Error("Заполните описание, шаги, подтверждение и правила каждой миссии");
      if (!REWARD_MODES.has(rewardMode)) throw new Error("Выберите корректный тип вознаграждения");
      if (rewardMode !== "NON_MONETARY" && rewardValue <= 0) throw new Error("Укажите размер вознаграждения для каждой денежной миссии");
      if (!rewardLabel) throw new Error("Укажите понятное название вознаграждения");
      return { id: missionId, title, description: missionDescription, instructions, proofRequirements, rewardMode, rewardValue, rewardLabel, verificationRules, sortOrder: index };
    });
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
    const missionUpdates = normalizedMissions.map((mission) => db.update(missions).set({
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
    await db.batch([
      db.update(programs).set({ name, description, goal, currency, payoutTerms, legalTerms, expiresAt, status: nextStatus, publishedAt: publish ? current.publishedAt ?? now : current.publishedAt, updatedAt: now }).where(and(eq(programs.id, id), eq(programs.companyId, company.id))),
      ...missionUpdates,
      db.update(companies).set({ onboardingStatus: publish ? "PROGRAM_PUBLISHED" : "PROGRAM_DRAFT", updatedAt: now }).where(eq(companies.id, company.id)),
    ]);
    return Response.json({ status: nextStatus, publicUrl: nextStatus === "ACTIVE" ? `/p/${current.slug}` : null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сохранить программу";
    return Response.json({ error: message }, { status: 400 });
  }
}

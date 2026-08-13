import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { getDb } from "../../../../../db";
import { getCompanyForUser } from "../../../../../db/company";
import { getLatestCompanyProfile } from "../../../../../db/profile";
import { companies, companyProfileVersions, programs } from "../../../../../db/schema";
import { cleanString, sameOrigin } from "../../_utils";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Сначала войдите" }, { status: 401 });
  const company = await getCompanyForUser(user.userId);
  if (!company) return Response.json({ error: "Компания не найдена" }, { status: 404 });
  const body = await request.json() as { type?: string; payload?: Record<string, unknown> };
  const payload = body.payload ?? {};
  const now = new Date().toISOString();

  if (body.type === "UPDATE_COMPANY_CONTACTS") {
    const contactWhatsapp = cleanString(payload.contactWhatsapp, 40) || company.contactWhatsapp;
    const contactInstagram = cleanString(payload.contactInstagram, 80) || company.contactInstagram;
    await getDb().update(companies).set({ contactWhatsapp, contactInstagram, updatedAt: now }).where(eq(companies.id, company.id));
    return Response.json({ ok: true, message: "Контакты компании обновлены." });
  }
  if (body.type === "UPDATE_PROGRAM") {
    const programId = cleanString(payload.programId, 80);
    const current = (await getDb().select().from(programs).where(and(eq(programs.id, programId), eq(programs.companyId, company.id))).limit(1))[0];
    if (!current) return Response.json({ error: "Программа не найдена" }, { status: 404 });
    const description = cleanString(payload.description, 1800) || current.description;
    const payoutTerms = cleanString(payload.payoutTerms, 1800) || current.payoutTerms;
    const legalTerms = cleanString(payload.legalTerms, 2400) || current.legalTerms;
    await getDb().update(programs).set({ description, payoutTerms, legalTerms, updatedAt: now }).where(and(eq(programs.id, programId), eq(programs.companyId, company.id)));
    return Response.json({ ok: true, message: `Программа «${current.name}» обновлена.` });
  }
  if (body.type === "UPDATE_PROFILE_DRAFT") {
    const profile = await getLatestCompanyProfile(company.id);
    if (!profile || profile.status !== "DRAFT") return Response.json({ error: "Изменять можно только неподтверждённый черновик профиля" }, { status: 400 });
    const targetAudience = cleanString(payload.targetAudience, 2000) || profile.targetAudience;
    const partnerPitch = cleanString(payload.partnerPitch, 2000) || profile.partnerPitch;
    await getDb().update(companyProfileVersions).set({ targetAudience, partnerPitch, updatedAt: now }).where(eq(companyProfileVersions.id, profile.id));
    return Response.json({ ok: true, message: "Черновик профиля компании обновлён." });
  }
  return Response.json({ error: "Это действие нельзя применить автоматически" }, { status: 400 });
}

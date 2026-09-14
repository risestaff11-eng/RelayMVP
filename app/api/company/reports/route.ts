import { subscriptionDenied } from "@/lib/company-subscription";
import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getCompanyForUser } from "../../../../db/company";
import { ensureReportTemplate, getCompanyReportPage, getCompanyReports } from "../../../../db/reports";
import { getDb } from "../../../../db";
import { agentReports, reportRevisions, reportTemplates } from "../../../../db/schema";
import { DEFAULT_REPORT_METRICS, REPORT_FIELD_TYPES, type ReportField } from "../../../../lib/reporting";
import { cleanString, sameOrigin } from "../_utils";
import { companyPermissionDenied, hasCompanyPermission } from "../../../../lib/company-permissions";

async function context() { const user = await getChatGPTUser(); if (!user) return null; const company = await getCompanyForUser(user.userId); return company ? { user, company } : null; }

export async function GET(request: Request) {
  const ctx = await context();
  if (!ctx) return Response.json({ error: "Сначала войдите" }, { status: 401 });
  const denied = await subscriptionDenied(ctx.company, "REPORTS"); if (denied) return denied;
  const query = new URL(request.url).searchParams;
  const id = query.get("id");
  if (id) {
    const report = (await getCompanyReports(ctx.company.id, { id, limit: 1, publishedOnly: true }))[0];
    return report ? Response.json({ report }) : Response.json({ error: "Отчёт не найден" }, { status: 404 });
  }
  return Response.json(await getCompanyReportPage(ctx.company.id, {
    query: cleanString(query.get("query"), 120), program: cleanString(query.get("program"), 80), status: cleanString(query.get("status"), 30),
    audio: query.get("audio") === "true", files: query.get("files") === "true",
    offset: Math.min(1000000, Math.max(0, Math.floor(Number(query.get("offset")) || 0))),
  }));
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 }); const ctx = await context(); if (!ctx) return Response.json({ error: "Сначала войдите" }, { status: 401 });
  if (!hasCompanyPermission(ctx.company.role, "REPORTS_MANAGE")) return companyPermissionDenied();
  { const denied = await subscriptionDenied(ctx.company, "REPORTS"); if (denied) return denied; }
  try {
    const payload = await request.json() as Record<string, unknown>; const action = cleanString(payload.action, 30); const now = new Date().toISOString();
    if (action === "TEMPLATE") {
      const template = await ensureReportTemplate(ctx.company.id); const raw = Array.isArray(payload.fields) ? payload.fields : [];
      const fields: ReportField[] = raw.slice(0, 30).map((item, index) => { const field = item as Record<string, unknown>; const type = cleanString(field.type, 20); return { id: cleanString(field.id, 80) || crypto.randomUUID(), label: cleanString(field.label, 120) || "Новое поле", description: cleanString(field.description, 240), type: REPORT_FIELD_TYPES.includes(type as ReportField["type"]) ? type as ReportField["type"] : "TEXTAREA", required: field.required === true, enabled: field.enabled !== false, options: Array.isArray(field.options) ? field.options.map((value) => cleanString(value, 80)).filter(Boolean).slice(0, 20) : [], unit: cleanString(field.unit, 30), frequency: cleanString(field.frequency, 30), sortOrder: index }; });
      if (!fields.length) throw new Error("Оставьте хотя бы одно поле отчёта"); const metrics = Array.isArray(payload.metrics) ? payload.metrics.map((value) => cleanString(value, 30)).filter((value) => DEFAULT_REPORT_METRICS.includes(value)).slice(0, DEFAULT_REPORT_METRICS.length) : DEFAULT_REPORT_METRICS;
      await getDb().update(reportTemplates).set({ fieldsJson: JSON.stringify(fields), metricsJson: JSON.stringify(metrics), updatedAt: now }).where(and(eq(reportTemplates.id, template.id), eq(reportTemplates.companyId, ctx.company.id))); return Response.json({ ok: true, fields, metrics });
    }
    if (action === "STATUS") {
      const reportId = cleanString(payload.reportId, 80); const next = cleanString(payload.status, 30); if (!new Set(["VIEWED", "NEEDS_CLARIFICATION", "ACCEPTED"]).has(next)) throw new Error("Недопустимый статус");
      const report = (await getDb().select().from(agentReports).where(and(eq(agentReports.id, reportId), eq(agentReports.companyId, ctx.company.id))).limit(1))[0]; if (!report) return Response.json({ error: "Отчёт не найден" }, { status: 404 });
      if (report.status === next) return Response.json({ ok: true, status: next });
      const allowedTransitions: Record<string, string[]> = { SUBMITTED: ["VIEWED", "NEEDS_CLARIFICATION", "ACCEPTED"], VIEWED: ["NEEDS_CLARIFICATION", "ACCEPTED"], NEEDS_CLARIFICATION: ["ACCEPTED"] };
      if (!(allowedTransitions[report.status] || []).includes(next)) throw new Error("Статус отчёта уже изменился. Обновите страницу и повторите действие.");
      const comment = cleanString(payload.comment, 1200); if (next === "NEEDS_CLARIFICATION" && !comment) throw new Error("Укажите, что нужно уточнить");
      await getDb().update(agentReports).set({ status: next, companyComment: comment, viewedAt: report.viewedAt || now, acceptedAt: next === "ACCEPTED" ? now : report.acceptedAt, updatedAt: now }).where(eq(agentReports.id, report.id));
      await getDb().insert(reportRevisions).values({ id: crypto.randomUUID(), reportId: report.id, actorType: "COMPANY", fromStatus: report.status, toStatus: next, snapshotJson: report.answersJson, comment, createdAt: now }); return Response.json({ ok: true, status: next });
    }
    throw new Error("Неизвестное действие");
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Не удалось обновить отчёты" }, { status: 400 }); }
}

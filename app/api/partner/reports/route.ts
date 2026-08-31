import { and, eq, inArray } from "drizzle-orm";
import { getPartnerPortal } from "../../../../db/partner";
import { calculatePartnerReportMetrics, ensureReportTemplate, getPartnerReports } from "../../../../db/reports";
import { getDb } from "../../../../db";
import { agentReports, reportFiles, reportRevisions } from "../../../../db/schema";
import { getFilesBucket } from "../../../../lib/storage";
import { cleanString, sameOrigin } from "../../company/_utils";

const allowedTypes = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/csv"]);
const audioTypes = new Set(["audio/webm", "audio/mp4", "audio/mpeg", "audio/mp3", "audio/ogg", "audio/wav", "audio/x-wav", "audio/aac", "audio/x-m4a"]);
function parseAnswers(value: FormDataEntryValue | null) { try { const data = JSON.parse(String(value || "{}")); return data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : {}; } catch { return {}; } }

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || ""; const portal = await getPartnerPortal(token);
  if (!portal) return Response.json({ error: "Ссылка агента недействительна" }, { status: 401 });
  const template = await ensureReportTemplate(portal.company.id); const reports = await getPartnerReports(portal.partners.map((item) => item.id));
  return Response.json({ template, reports });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  try {
    const form = await request.formData(); const token = cleanString(form.get("token"), 80); const portal = await getPartnerPortal(token);
    if (!portal) return Response.json({ error: "Ссылка агента недействительна" }, { status: 401 });
    const template = await ensureReportTemplate(portal.company.id); const reportId = cleanString(form.get("reportId"), 80) || crypto.randomUUID(); const now = new Date().toISOString();
    const existing = (await getDb().select().from(agentReports).where(and(eq(agentReports.id, reportId), inArray(agentReports.partnerId, portal.partners.map((item) => item.id)))).limit(1))[0];
    if (existing && !["DRAFT", "NEEDS_CLARIFICATION"].includes(existing.status)) throw new Error("Этот отчёт уже отправлен и доступен только для просмотра");
    const programId = cleanString(form.get("programId"), 80) || null; if (programId && !portal.programs.some((item) => item.id === programId)) throw new Error("Программа недоступна");
    const partner = programId ? portal.partners.find((item) => item.programId === programId) : portal.partner;
    if (!partner) throw new Error("Агент не подключён к выбранной программе");
    const periodStart = cleanString(form.get("periodStart"), 10); const periodEnd = cleanString(form.get("periodEnd"), 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd) || periodStart > periodEnd) throw new Error("Проверьте период отчёта");
    const answers = parseAnswers(form.get("answers")); const submit = form.get("submit") === "yes"; const fields = existing ? JSON.parse(existing.templateSnapshotJson) : template.fields;
    if (submit) for (const field of fields) if (field.enabled !== false && field.required && field.type !== "FILE" && !String(answers[field.id] ?? "").trim()) throw new Error(`Заполните обязательное поле «${field.label}»`);
    const metrics = await calculatePartnerReportMetrics(portal.partners.map((item) => item.id), periodStart, periodEnd);
    const transcript = cleanString(form.get("transcript"), 12000); const audioDurationSeconds = Math.min(180, Math.max(0, Number(form.get("audioDurationSeconds")) || 0));
    const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0); const audio = form.get("audio"); const audioFile = audio instanceof File && audio.size > 0 ? audio : null;
    const currentFiles = existing ? await getDb().select().from(reportFiles).where(eq(reportFiles.reportId, reportId)) : [];
    if (currentFiles.filter((item) => item.kind === "ATTACHMENT").length + files.length > 5) throw new Error("К отчёту можно приложить не более 5 файлов");
    if (submit && fields.some((field: { enabled?: boolean; required?: boolean; type?: string }) => field.enabled !== false && field.required && field.type === "FILE") && currentFiles.filter((item) => item.kind === "ATTACHMENT").length + files.length === 0) throw new Error("Приложите обязательный файл к отчёту");
    if (files.some((file) => file.size > 10 * 1024 * 1024 || !allowedTypes.has(file.type))) throw new Error("Файлы должны быть PDF, DOC, TXT, CSV, JPG, PNG или WEBP размером до 10 МБ");
    if (audioFile && (audioFile.size > 10 * 1024 * 1024 || !audioTypes.has(audioFile.type.split(";", 1)[0].toLowerCase()) || audioDurationSeconds > 180)) throw new Error("Аудио должно быть не длиннее 3 минут и не больше 10 МБ");
    const status = submit ? "SUBMITTED" : "DRAFT"; const summary = { preview: String(answers.main_results || answers.work_done || transcript).slice(0, 280), blockers: String(answers.blockers || "").slice(0, 500), nextPlan: String(answers.next_plan || "").slice(0, 500), generatedAt: now };
    const values = { companyId: portal.company.id, partnerId: partner.id, programId, templateId: template.id, periodStart, periodEnd, templateSnapshotJson: existing?.templateSnapshotJson || JSON.stringify(template.fields), answersJson: JSON.stringify(answers), metricsJson: JSON.stringify(metrics), transcript, audioDurationSeconds, aiSummaryJson: JSON.stringify(summary), status, submittedAt: submit ? now : existing?.submittedAt ?? null, updatedAt: now };
    if (existing) await getDb().update(agentReports).set(values).where(eq(agentReports.id, reportId)); else await getDb().insert(agentReports).values({ id: reportId, ...values, companyComment: "", createdAt: now });
    const newFiles: Array<typeof reportFiles.$inferInsert> = [];
    for (const file of [...files, ...(audioFile ? [audioFile] : [])]) { const kind = file === audioFile ? "AUDIO" : "ATTACHMENT"; const objectKey = `${portal.company.id}/reports/${reportId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`; await getFilesBucket().put(objectKey, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } }); newFiles.push({ id: crypto.randomUUID(), reportId, companyId: portal.company.id, partnerId: partner.id, objectKey, fileName: cleanString(file.name, 180), mimeType: file.type, size: file.size, kind, createdAt: now }); }
    if (newFiles.length) await getDb().insert(reportFiles).values(newFiles);
    await getDb().insert(reportRevisions).values({ id: crypto.randomUUID(), reportId, actorType: "PARTNER", fromStatus: existing?.status ?? null, toStatus: status, snapshotJson: JSON.stringify({ answers, metrics }), comment: submit ? "Отчёт отправлен компании" : "Черновик сохранён", createdAt: now });
    return Response.json({ reportId, status }, { status: existing ? 200 : 201 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Не удалось сохранить отчёт" }, { status: 400 }); }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const url = new URL(request.url); const portal = await getPartnerPortal(url.searchParams.get("token") || ""); if (!portal) return Response.json({ error: "Ссылка агента недействительна" }, { status: 401 });
  const fileId = url.searchParams.get("fileId") || ""; const file = (await getDb().select().from(reportFiles).where(and(eq(reportFiles.id, fileId), inArray(reportFiles.partnerId, portal.partners.map((item) => item.id)))).limit(1))[0];
  if (!file) return Response.json({ error: "Файл не найден" }, { status: 404 }); const report = (await getDb().select().from(agentReports).where(eq(agentReports.id, file.reportId)).limit(1))[0]; if (!report || !["DRAFT", "NEEDS_CLARIFICATION"].includes(report.status)) return Response.json({ error: "Отправленный файл удалить нельзя" }, { status: 409 });
  await getFilesBucket().delete(file.objectKey); await getDb().delete(reportFiles).where(eq(reportFiles.id, file.id)); return Response.json({ ok: true });
}

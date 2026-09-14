import { getChatGPTUser } from "../../../chatgpt-auth";
import { getCompanyForUser } from "@/db/company";
import { getD1 } from "@/db";
import { sameOrigin } from "../_utils";
import { companyPermissionDenied, hasCompanyPermission } from "@/lib/company-permissions";
import { deliverLeadNotification } from "@/lib/company-submission-notifications";

async function context() {
  const user = await getChatGPTUser();
  return user ? getCompanyForUser(user.userId) : null;
}

export async function GET() {
  const company = await context();
  if (!company) return Response.json({ error: "Сначала войдите" }, { status: 401 });
  const jobs = await getD1().prepare("SELECT submission_id AS submissionId, status, attempts, next_attempt_at AS nextAttemptAt FROM lead_notification_jobs WHERE company_id = ? AND status <> 'SENT' ORDER BY created_at DESC LIMIT 25").bind(company.id).all();
  return Response.json({ jobs: jobs.results, canRetry: hasCompanyPermission(company.role, "CRM_MANAGE") });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const company = await context();
  if (!company) return Response.json({ error: "Сначала войдите" }, { status: 401 });
  if (!hasCompanyPermission(company.role, "CRM_MANAGE")) return companyPermissionDenied();
  const body = await request.json().catch(() => null) as { submissionId?: string } | null;
  if (typeof body?.submissionId !== "string") return Response.json({ error: "Укажите заявку" }, { status: 400 });
  const reset = await getD1().prepare("UPDATE lead_notification_jobs SET attempts = 0, status = 'RETRY', next_attempt_at = NULL WHERE submission_id = ? AND company_id = ? AND status = 'FAILED'")
    .bind(body.submissionId, company.id).run();
  if (!reset.meta.changes) return Response.json({ error: "Повтор доступен только для неотправленного письма" }, { status: 409 });
  await deliverLeadNotification(company.id, body.submissionId);
  return Response.json({ ok: true });
}

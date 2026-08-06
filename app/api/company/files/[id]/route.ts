import { eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { getDb } from "../../../../../db";
import { getCompanyForUser } from "../../../../../db/company";
import { submissionAttachments, submissions } from "../../../../../db/schema";
import { getFilesBucket } from "../../../../../lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return new Response("Сначала войдите", { status: 401 });
  const company = await getCompanyForUser(user.userId);
  if (!company) return new Response("Компания не найдена", { status: 404 });
  const { id } = await params;
  const row = (await getDb().select({ attachment: submissionAttachments, companyId: submissions.companyId })
    .from(submissionAttachments)
    .innerJoin(submissions, eq(submissionAttachments.submissionId, submissions.id))
    .where(eq(submissionAttachments.id, id)).limit(1))[0];
  if (!row || row.companyId !== company.id || !row.attachment.objectKey) return new Response("Файл не найден", { status: 404 });
  const object = await getFilesBucket().get(row.attachment.objectKey);
  if (!object) return new Response("Файл не найден", { status: 404 });
  return new Response(object.body, { headers: { "content-type": row.attachment.mimeType, "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(row.attachment.fileName)}`, "cache-control": "private, no-store" } });
}

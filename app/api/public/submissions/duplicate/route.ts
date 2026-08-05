import { and, eq, or } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { programs, submissions } from "../../../../../db/schema";
import { cleanString, sameOrigin } from "../../../company/_utils";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const payload = await request.json() as Record<string, unknown>;
  const slug = cleanString(payload.programSlug, 80);
  const email = cleanString(payload.contactEmail, 180).toLowerCase();
  const phone = cleanString(payload.contactPhone, 40);
  if (!slug || (!email && !phone)) return Response.json({ duplicate: false });
  const db = getDb();
  const conditions = [];
  if (email) conditions.push(eq(submissions.contactEmail, email));
  if (phone) conditions.push(eq(submissions.contactPhone, phone));
  const rows = await db.select({ id: submissions.id }).from(submissions)
    .innerJoin(programs, eq(submissions.programId, programs.id))
    .where(and(eq(programs.slug, slug), conditions.length === 1 ? conditions[0] : or(...conditions)))
    .limit(1);
  return Response.json({ duplicate: rows.length > 0 });
}

import { and, eq, ne } from "drizzle-orm";
import { getDb } from "../../../../db";
import { getPartnerPortal } from "../../../../db/partner";
import { partnerProfiles, partners } from "../../../../db/schema";
import { getFilesBucket } from "../../../../lib/storage";
import { cleanString, sameOrigin } from "../../company/_utils";

const avatarTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
function list(value: FormDataEntryValue | null, max = 12) { return cleanString(value, 1200).split(/[,\n]+/).map((item) => item.trim()).filter(Boolean).slice(0, max); }

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  try {
    const form = await request.formData();
    const token = cleanString(form.get("token"), 80);
    const portal = await getPartnerPortal(token);
    if (!portal) return Response.json({ error: "Ссылка недействительна" }, { status: 401 });
    const firstName = cleanString(form.get("firstName"), 60);
    const lastName = cleanString(form.get("lastName"), 60);
    const middleName = cleanString(form.get("middleName"), 60);
    const phone = cleanString(form.get("phone"), 40);
    const email = cleanString(form.get("email"), 180).toLowerCase();
    const instagram = cleanString(form.get("instagram"), 100).replace(/^@/, "");
    if (firstName.length < 2) throw new Error("Укажите имя");
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Проверьте email");
    if (phone.length < 7) throw new Error("Проверьте телефон");
    const db = getDb();
    const duplicates = await db.select({ id: partners.id }).from(partners).where(and(eq(partners.programId, portal.program.id), eq(partners.email, email), ne(partners.id, portal.partner.id))).limit(1);
    if (duplicates.length) throw new Error("Этот email уже используется другим агентом программы");
    const avatar = form.get("avatar");
    let avatarObjectKey = portal.profile.avatarObjectKey;
    if (avatar instanceof File && avatar.size > 0) {
      if (avatar.size > 5 * 1024 * 1024 || !avatarTypes.has(avatar.type)) throw new Error("Аватар: JPG, PNG или WEBP до 5 МБ");
      const bucket = getFilesBucket();
      const nextKey = `${portal.company.id}/avatars/${portal.partner.id}/${crypto.randomUUID()}-${avatar.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      await bucket.put(nextKey, await avatar.arrayBuffer(), { httpMetadata: { contentType: avatar.type } });
      if (avatarObjectKey) await bucket.delete(avatarObjectKey);
      avatarObjectKey = nextKey;
    }
    const now = new Date().toISOString();
    const profileValues = { firstName, lastName, middleName, instagram, avatarObjectKey, skillsJson: JSON.stringify(list(form.get("skills"))), industriesJson: JSON.stringify(list(form.get("industries"))), geographiesJson: JSON.stringify(list(form.get("geographies"))), preferredTypesJson: JSON.stringify(form.getAll("preferredTypes").map((item) => cleanString(item, 30)).filter(Boolean).slice(0, 4)), ...(phone === portal.partner.phone ? {} : { whatsappVerifiedAt: null }), updatedAt: now };
    const existing = await db.select().from(partnerProfiles).where(eq(partnerProfiles.partnerId, portal.partner.id)).limit(1);
    await db.batch([
      db.update(partners).set({ name: [firstName, middleName, lastName].filter(Boolean).join(" "), email, phone, lastActiveAt: now }).where(eq(partners.id, portal.partner.id)),
      existing[0] ? db.update(partnerProfiles).set(profileValues).where(eq(partnerProfiles.partnerId, portal.partner.id)) : db.insert(partnerProfiles).values({ partnerId: portal.partner.id, ...profileValues }),
    ]);
    return Response.json({ ok: true, avatarUrl: avatarObjectKey ? `/api/partner/avatar?token=${token}` : null });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Не удалось сохранить профиль" }, { status: 400 }); }
}

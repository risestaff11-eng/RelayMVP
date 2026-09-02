import { sameOrigin } from "../../company/_utils";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const payload = await request.json().catch(() => null) as { email?: string } | null;
  const rawEmail = payload?.email;
  const email = String(rawEmail ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "Укажите корректный email" }, { status: 400 });
  // Legacy clients route `exists: false/undefined` to registration. Always send them
  // to login, without querying the database or disclosing account existence/name.
  return Response.json({ ok: true, exists: true, nextStep: "LOGIN" }, { headers: { "Cache-Control": "no-store" } });
}

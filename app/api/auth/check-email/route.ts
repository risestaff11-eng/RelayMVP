import { sameOrigin } from "../../company/_utils";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const { email: rawEmail } = await request.json() as { email?: string };
  const email = String(rawEmail ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "Укажите корректный email" }, { status: 400 });
  // Do not disclose whether an account exists or reveal a person's name to an anonymous caller.
  return Response.json({ ok: true, nextStep: "CONTINUE" });
}

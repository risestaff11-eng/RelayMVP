export function apiError(message: string, status: number, code: string) {
  return Response.json({ error: { code, message } }, { status, headers: { "cache-control": "no-store" } });
}

export function apiJson(data: unknown, status = 200) {
  return Response.json({ data }, { status, headers: { "cache-control": "no-store" } });
}

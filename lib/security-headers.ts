export function secureResponse(response: Response, request: Request) {
  const result = new Response(response.body, response);
  const url = new URL(request.url);
  result.headers.set("X-Content-Type-Options", "nosniff");
  result.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  result.headers.set("Permissions-Policy", "camera=(), geolocation=(), payment=(), microphone=(self)");
  // Keep vinext's inline bootstrap working; restrict embedding, plugin content and base URL injection.
  result.headers.set("Content-Security-Policy", "object-src 'none'; base-uri 'self'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com");
  if (url.protocol === "https:") result.headers.set("Strict-Transport-Security", "max-age=31536000");
  if (/^\/(dashboard|system|admin|auth|onboarding|partner|agent|agent-login|ref)(\/|$)/.test(url.pathname) || url.pathname.startsWith("/api/")) {
    result.headers.set("Cache-Control", "no-store, private, max-age=0");
    result.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return result;
}

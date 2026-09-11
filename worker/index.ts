/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { canonicalRedirectFor } from "../lib/domain-routing";
import { drainDueIntegrationDeliveries, safeIntegrationEvent } from "../lib/integrations/service";
import { drainCompanyApplicationNotifications } from "../lib/company-application-service";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  AI_PROVIDER?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GEMINI_AUDIO_MODEL?: string;
  ADMIN_SECRET?: string;
  INTEGRATION_ENCRYPTION_KEY?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

let lastIntegrationDrainAt = 0;

function scheduleIntegrationDrain(env: Env, ctx: ExecutionContext) {
  if (!env.DB) return;
  const now = Date.now();
  if (now - lastIntegrationDrainAt < 30_000) return;
  lastIntegrationDrainAt = now;
  ctx.waitUntil(Promise.all([
    safeIntegrationEvent(drainDueIntegrationDeliveries()),
    drainCompanyApplicationNotifications().catch(() => console.error("Company application notification drain failed")),
  ]));
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    scheduleIntegrationDrain(env, ctx);
    const url = new URL(request.url);

    if (url.hostname === "broker.risestaff.kz" && (request.method === "GET" || request.method === "HEAD")) {
      if (url.pathname === "/robots.txt") return new Response(request.method === "HEAD" ? null : "User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: https://broker.risestaff.kz/sitemap.xml\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
      if (url.pathname === "/sitemap.xml") return new Response(request.method === "HEAD" ? null : '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://broker.risestaff.kz/</loc></url></urlset>', { headers: { "Content-Type": "application/xml; charset=utf-8" } });
    }

    if (request.method === "GET" || request.method === "HEAD") {
      const destination = canonicalRedirectFor(request.url);
      if (destination) return Response.redirect(destination, 308);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    // Keep the public broker hostname while rendering its dedicated landing route.
    // API requests retain their original URL for same-origin validation.
    let routedRequest = request;
    if (url.hostname === "broker.risestaff.kz" && url.pathname === "/") {
      const brokerUrl = new URL(request.url);
      brokerUrl.pathname = "/broker";
      routedRequest = new Request(brokerUrl, request);
    }
    const response = await handler.fetch(routedRequest, env, ctx);
    const privateAgentPath = ["/partner", "/ref", "/agent", "/agent-login", "/api/partner", "/api/agent"].some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`));
    if (url.pathname === "/auth" || url.pathname.startsWith("/api/auth/") || privateAgentPath) {
      const privateResponse = new Response(response.body, response);
      privateResponse.headers.set("Cache-Control", "no-store, private, max-age=0");
      if (privateAgentPath) {
        privateResponse.headers.set("Referrer-Policy", "no-referrer");
        privateResponse.headers.set("X-Robots-Tag", "noindex, nofollow");
      }
      return privateResponse;
    }
    return response;
  },
  async scheduled(_controller: ScheduledController, _env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(Promise.all([
      safeIntegrationEvent(drainDueIntegrationDeliveries()),
      drainCompanyApplicationNotifications().catch(() => console.error("Company application notification drain failed")),
    ]));
  },
};

export default worker;

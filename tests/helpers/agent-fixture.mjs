import { DatabaseSync } from "node:sqlite";
import { is, SQL } from "drizzle-orm";
import { getTableConfig, SQLiteTable, SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { typescriptLoader } from "./load-typescript.mjs";

const quote = (value) => `"${value.replaceAll('"', '""')}"`;

/** Real SQL queries against an ephemeral database derived from the actual schema.
 * Only transport boundaries (email, R2, provider and cookies) are substituted.
 * Requires Node >=22.16, which supports array results for joined SQL projections:
 * https://nodejs.org/en/blog/release/v22.16.0
 */
export function agentFixture() {
  const sqlite = new DatabaseSync(":memory:");
  const binding = {
    prepare(query) {
      const statement = sqlite.prepare(query);
      let params = [];
      return {
        bind(...values) { params = values; return this; },
        async raw() { statement.setReturnArrays(true); return statement.all(...params); },
        async all() { statement.setReturnArrays(false); return { results: statement.all(...params), success: true, meta: {} }; },
        async run() { const result = statement.run(...params); return { success: true, meta: { changes: result.changes } }; },
      };
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try { const rows = []; for (const statement of statements) rows.push(await statement.all()); sqlite.exec("COMMIT"); return rows; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
  const jar = new Map();
  const objects = new Map();
  const deliveries = [];
  const runtime = { DB: binding, FILES: {
    async put(key, value, options) { objects.set(key, { value, options }); },
    async get(key) { const item = objects.get(key); return item ? { body: item.value } : null; },
    async delete(key) { objects.delete(key); },
  } };
  const load = typescriptLoader({
    "cloudflare:workers": { env: runtime },
    "next/headers": { cookies: async () => ({ get: (key) => jar.get(key), set: (key, value, options) => jar.set(key, { value, options }) }) },
    "next/navigation": { redirect: (url) => { throw new Error(`REDIRECT:${url}`); }, notFound: () => { throw new Error("NOT_FOUND"); } },
  });
  const schema = load(new URL("../../db/schema.ts", import.meta.url));
  const dialect = new SQLiteSyncDialect();
  for (const table of Object.values(schema).filter((value) => is(value, SQLiteTable))) {
    const config = getTableConfig(table);
    const definitions = config.columns.map((column) => {
      const value = column.default;
      const defaultSql = value === undefined ? "" : is(value, SQL) ? dialect.sqlToQuery(value).sql : typeof value === "string" ? `'${value.replaceAll("'", "''")}'` : String(Number(value));
      return `${quote(column.name)} ${column.getSQLType()}${column.primary ? " PRIMARY KEY" : ""}${column.notNull ? " NOT NULL" : ""}${column.isUnique ? " UNIQUE" : ""}${defaultSql ? ` DEFAULT (${defaultSql})` : ""}`;
    });
    for (const pk of config.primaryKeys) definitions.push(`PRIMARY KEY (${pk.columns.map((column) => quote(column.name)).join(",")})`);
    for (const index of config.indexes.filter((index) => index.config.unique)) definitions.push(`UNIQUE (${index.config.columns.map((column) => quote(column.name)).join(",")})`);
    sqlite.exec(`CREATE TABLE ${quote(config.name)} (${definitions.join(",")})`);
  }
  const db = load(new URL("../../db/index.ts", import.meta.url)).getDb();
  const mail = load(new URL("../../lib/agent-email.ts", import.meta.url));
  mail.sendAgentLoginCode = async (email, code) => deliveries.push({ type: "code", email, code });
  mail.sendCompanyNewSubmissionNotification = async (data) => deliveries.push({ type: "submission", ...data });
  mail.sendAgentApplicationNotification = async (data) => deliveries.push({ type: "application", ...data });
  mail.sendAgentWorkUpdate = async (data) => deliveries.push({ type: "work-update", ...data });
  const auth = load(new URL("../../app/chatgpt-auth.ts", import.meta.url));
  let owner = null;
  auth.getChatGPTUser = async () => owner;
  return {
    sqlite, binding, db, schema, load, jar, objects, deliveries, runtime,
    async seed({ companyId = "company-a", programId = "program-a", partnerId = "partner-a", email = "agent@example.test", phone = "+7 777 123 45 67", userId = "agent-user", status = "ACTIVE", type = "LEAD", expiresAt = null } = {}) {
      const now = new Date().toISOString();
      const ownerId = `${companyId}-owner`;
      await db.insert(schema.users).values({ id: ownerId, email: `${ownerId}@example.test`, displayName: "Owner", status: "active" }).onConflictDoNothing();
      await db.insert(schema.companies).values({ id: companyId, ownerUserId: ownerId, name: companyId, website: "https://example.test", industry: "Education", teamSize: "10", primaryGoal: "LEADS" }).onConflictDoNothing();
      await db.insert(schema.companyMembers).values({ userId: ownerId, companyId, role: "OWNER" }).onConflictDoNothing();
      if (userId) await db.insert(schema.users).values({ id: userId, email, displayName: "Ambassador" }).onConflictDoNothing();
      await db.insert(schema.programs).values({ id: programId, companyId, name: programId, slug: programId, status, expiresAt, payoutTerms: "Payment in 7 days", legalTerms: "Rules" });
      const missionId = `${programId}-mission`;
      await db.insert(schema.missions).values({ id: missionId, programId, type, title: "Recommend a course", rewardValue: 25000, rewardLabel: "25 000 ₸" });
      await db.insert(schema.partners).values({ id: partnerId, userId, companyId, programId, name: "Ambassador", email, phone });
      await db.insert(schema.partnerProfiles).values({ partnerId, firstName: "Ambassador" });
      await db.insert(schema.partnerMissionAcceptances).values({ id: `${partnerId}-acceptance`, partnerId, missionId });
      const tokens = load(new URL("../../lib/partner-token.ts", import.meta.url));
      const token = tokens.createPartnerToken();
      const referralToken = tokens.createPartnerToken();
      const accessExpiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
      await db.insert(schema.partnerAccessLinks).values({ id: `${partnerId}-access`, partnerId, tokenHash: await tokens.hashPartnerToken(token), expiresAt: accessExpiresAt, createdAt: now });
      await db.insert(schema.partnerReferralLinks).values({ id: `${partnerId}-referral`, partnerId, missionId, tokenHash: await tokens.hashPartnerToken(referralToken), expiresAt: accessExpiresAt });
      return { companyId, programId, partnerId, missionId, email, phone, token, referralToken, accessExpiresAt };
    },
    setCompany(companyId) { owner = companyId ? { userId: `${companyId}-owner` } : null; },
    async request(path, data, options = {}) {
      const { route = path, method = "POST", params = {}, headers = {} } = options;
      const handler = load(new URL(`../../app${route}/route.ts`, import.meta.url))[method];
      return handler(new Request(`https://agents.risestaff.kz${path}`, {
        method, headers: { origin: "https://agents.risestaff.kz", ...(!(data instanceof FormData) && data !== undefined ? { "content-type": "application/json" } : {}), ...headers },
        ...(data !== undefined ? { body: data instanceof FormData ? data : JSON.stringify(data) } : {}),
      }), { params: Promise.resolve(params) });
    },
    form(identity, values = {}) {
      const form = new FormData();
      for (const [key, value] of Object.entries({ token: identity.token, programSlug: identity.programId, missionId: identity.missionId, "field__contact-name": "Client", "field__contact-phone": "+7 701 222 33 44", ...values })) form.set(key, value);
      return form;
    },
    close() { sqlite.close(); },
  };
}

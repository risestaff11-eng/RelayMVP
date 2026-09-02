import { DatabaseSync } from "node:sqlite";
import { typescriptLoader } from "./load-typescript.mjs";

export function authFixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL, display_name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '', company_name TEXT NOT NULL DEFAULT '', password_hash TEXT,
      status TEXT NOT NULL DEFAULT 'pending', email_verified_at TEXT, last_login_at TEXT,
      login_count INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE user_roles (user_id TEXT NOT NULL, role TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id, role));
    CREATE TABLE auth_sessions (id TEXT PRIMARY KEY, user_id TEXT, expires_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE password_reset_attempts (id TEXT PRIMARY KEY, key_hash TEXT, successful INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  `);
  for (const table of ["company_email_verification_codes", "password_reset_codes"]) {
    sqlite.exec(`CREATE TABLE ${table} (id TEXT PRIMARY KEY, user_id TEXT, destination TEXT, code_hash TEXT,
      expires_at TEXT, consumed_at TEXT, attempts INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
  }
  const binding = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      let params = [];
      return {
        bind(...values) { params = values; return this; },
        async raw() { return statement.all(...params).map((row) => Object.values(row)); },
        async all() { return { results: statement.all(...params), success: true, meta: {} }; },
        async run() { statement.run(...params); return { success: true, meta: {} }; },
      };
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.all());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
  const jar = new Map();
  const deliveries = [];
  const load = typescriptLoader({
    "cloudflare:workers": { env: { DB: binding } },
    "next/headers": { cookies: async () => ({ get: (name) => jar.get(name), set: (name, value) => jar.set(name, { value }) }) },
  });
  const mail = load(new URL("../../lib/company-email-verification.ts", import.meta.url));
  mail.sendCompanyEmailCode = async (email, code) => deliveries.push({ email, code, type: "verify" });
  mail.sendPasswordResetCode = async (email, code) => deliveries.push({ email, code, type: "reset" });
  const auth = load(new URL("../../lib/account-auth.ts", import.meta.url));
  const handlers = Object.fromEntries(["check-email", "login", "register", "email-verification", "reset-password"].map((name) => [
    `/api/auth/${name}`, load(new URL(`../../app/api/auth/${name}/route.ts`, import.meta.url)).POST,
  ]));
  return {
    sqlite, jar, deliveries, load, auth,
    async seed(email = "existing@example.test", status = "active", role = "COMPANY") {
      const id = crypto.randomUUID();
      sqlite.prepare("INSERT INTO users (id,email,display_name,password_hash,status) VALUES (?,?,?,?,?)")
        .run(id, email, "Test Company Owner", await auth.hashPassword("ValidPass123"), status);
      sqlite.prepare("INSERT INTO user_roles (user_id,role) VALUES (?,?)").run(id, role);
      return id;
    },
    async request(path, payload, headers = {}) {
      return handlers[path](new Request(`https://company.risestaff.kz${path}`, {
        method: "POST", headers: { "content-type": "application/json", origin: "https://company.risestaff.kz", ...headers }, body: JSON.stringify(payload),
      }));
    },
    close() { sqlite.close(); },
  };
}

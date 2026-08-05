import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const companies = sqliteTable("companies", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull().unique().references(() => users.id),
  name: text("name").notNull(),
  website: text("website").notNull(),
  industry: text("industry").notNull(),
  teamSize: text("team_size").notNull(),
  primaryGoal: text("primary_goal").notNull(),
  onboardingStatus: text("onboarding_status").notNull().default("COMPANY_CREATED"),
  planCode: text("plan_code").notNull().default("TRIAL"),
  aiTokenBalance: integer("ai_token_balance").notNull().default(100000),
  aiTokensUsed: integer("ai_tokens_used").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const companyMembers = sqliteTable(
  "company_members",
  {
    companyId: text("company_id").notNull().references(() => companies.id),
    userId: text("user_id").notNull().references(() => users.id),
    role: text("role").notNull().default("OWNER"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.companyId, table.userId] }),
    index("idx_company_members_user_id").on(table.userId),
  ],
);

export const programs = sqliteTable(
  "programs",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    status: text("status").notNull().default("DRAFT"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_programs_company_id").on(table.companyId)],
);

export const companyProfileVersions = sqliteTable(
  "company_profile_versions",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").notNull().references(() => companies.id),
    versionNumber: integer("version_number").notNull(),
    sourceWebsite: text("source_website").notNull(),
    status: text("status").notNull().default("DRAFT"),
    businessDescription: text("business_description").notNull().default(""),
    productsJson: text("products_json").notNull().default("[]"),
    targetAudience: text("target_audience").notNull().default(""),
    advantagesJson: text("advantages_json").notNull().default("[]"),
    buyingTriggersJson: text("buying_triggers_json").notNull().default("[]"),
    disqualifiersJson: text("disqualifiers_json").notNull().default("[]"),
    geographiesJson: text("geographies_json").notNull().default("[]"),
    partnerPitch: text("partner_pitch").notNull().default(""),
    missingFieldsJson: text("missing_fields_json").notNull().default("[]"),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    confirmedAt: text("confirmed_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_company_profile_versions_company_version").on(table.companyId, table.versionNumber),
    index("idx_company_profile_versions_company_status").on(table.companyId, table.status),
  ],
);

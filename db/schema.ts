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
    profileVersionId: text("profile_version_id"),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description").notNull().default(""),
    goal: text("goal").notNull().default("LEADS"),
    currency: text("currency").notNull().default("KZT"),
    payoutTerms: text("payout_terms").notNull().default(""),
    legalTerms: text("legal_terms").notNull().default(""),
    expiresAt: text("expires_at"),
    status: text("status").notNull().default("DRAFT"),
    publishedAt: text("published_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_programs_company_id").on(table.companyId),
    index("idx_programs_company_status").on(table.companyId, table.status),
  ],
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

export const missions = sqliteTable(
  "missions",
  {
    id: text("id").primaryKey(),
    programId: text("program_id").notNull().references(() => programs.id),
    type: text("type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    instructionsJson: text("instructions_json").notNull().default("[]"),
    proofRequirementsJson: text("proof_requirements_json").notNull().default("[]"),
    rewardMode: text("reward_mode").notNull().default("FIXED"),
    rewardValue: integer("reward_value").notNull().default(0),
    rewardLabel: text("reward_label").notNull().default(""),
    verificationRules: text("verification_rules").notNull().default(""),
    status: text("status").notNull().default("ACTIVE"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_missions_program_sort").on(table.programId, table.sortOrder)],
);

export const partners = sqliteTable(
  "partners",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").notNull().references(() => companies.id),
    programId: text("program_id").notNull().references(() => programs.id),
    name: text("name").notNull(),
    email: text("email").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    joinedAt: text("joined_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    lastActiveAt: text("last_active_at"),
  },
  (table) => [
    uniqueIndex("idx_partners_program_email").on(table.programId, table.email),
    index("idx_partners_company_status").on(table.companyId, table.status),
  ],
);

export const submissions = sqliteTable(
  "submissions",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").notNull().references(() => companies.id),
    programId: text("program_id").notNull().references(() => programs.id),
    missionId: text("mission_id").notNull().references(() => missions.id),
    partnerId: text("partner_id").notNull().references(() => partners.id),
    type: text("type").notNull(),
    contactName: text("contact_name").notNull().default(""),
    contactCompany: text("contact_company").notNull().default(""),
    contactEmail: text("contact_email").notNull().default(""),
    contactPhone: text("contact_phone").notNull().default(""),
    payloadJson: text("payload_json").notNull().default("{}"),
    status: text("status").notNull().default("SUBMITTED"),
    companyComment: text("company_comment").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_submissions_company_status").on(table.companyId, table.status),
    index("idx_submissions_program_created").on(table.programId, table.createdAt),
  ],
);

export const rewards = sqliteTable(
  "rewards",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").notNull().references(() => companies.id),
    submissionId: text("submission_id").notNull().unique().references(() => submissions.id),
    partnerId: text("partner_id").notNull().references(() => partners.id),
    amount: integer("amount").notNull().default(0),
    currency: text("currency").notNull().default("KZT"),
    status: text("status").notNull().default("PENDING"),
    approvedAt: text("approved_at"),
    paidAt: text("paid_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_rewards_company_status").on(table.companyId, table.status),
    index("idx_rewards_partner_status").on(table.partnerId, table.status),
  ],
);

import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { INITIAL_COMPANY_AI_CREDITS } from "../lib/company-credits";

export const marketingEvents = sqliteTable("marketing_events", {
  id: text("id").primaryKey(),
  event: text("event").notNull(),
  path: text("path").notNull().default("/"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_marketing_events_event_created").on(table.event, table.createdAt)]);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  phone: text("phone").notNull().default(""),
  companyName: text("company_name").notNull().default(""),
  passwordHash: text("password_hash"),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_users_email").on(table.email)]);

export const authSessions = sqliteTable("auth_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_auth_sessions_user").on(table.userId)]);

export const passwordResetAttempts = sqliteTable("password_reset_attempts", {
  id: text("id").primaryKey(),
  keyHash: text("key_hash").notNull(),
  successful: integer("successful", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_password_reset_attempts_key_created").on(table.keyHash, table.createdAt)]);

export const userRoles = sqliteTable(
  "user_roles",
  {
    userId: text("user_id").notNull().references(() => users.id),
    role: text("role").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.role] }),
    index("idx_user_roles_role").on(table.role),
  ],
);

export const companies = sqliteTable("companies", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull().unique().references(() => users.id),
  name: text("name").notNull(),
  website: text("website").notNull(),
  contactWhatsapp: text("contact_whatsapp").notNull().default(""),
  contactInstagram: text("contact_instagram").notNull().default(""),
  logoObjectKey: text("logo_object_key"),
  industry: text("industry").notNull(),
  teamSize: text("team_size").notNull(),
  primaryGoal: text("primary_goal").notNull(),
  onboardingStatus: text("onboarding_status").notNull().default("COMPANY_CREATED"),
  planCode: text("plan_code").notNull().default("TRIAL"),
  aiTokenBalance: integer("ai_token_balance").notNull().default(INITIAL_COMPANY_AI_CREDITS),
  aiTokensUsed: integer("ai_tokens_used").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const companyKnowledgeItems = sqliteTable(
  "company_knowledge_items",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").notNull().references(() => companies.id),
    kind: text("kind").notNull().default("SCRIPT"),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    content: text("content").notNull().default(""),
    agentAction: text("agent_action").notNull().default(""),
    channel: text("channel").notNull().default("ALL"),
    salesStage: text("sales_stage").notNull().default("PREPARE"),
    audience: text("audience").notNull().default(""),
    sourceBasisJson: text("source_basis_json").notNull().default("[]"),
    warningsJson: text("warnings_json").notNull().default("[]"),
    externalUrl: text("external_url"),
    objectKey: text("object_key"),
    fileName: text("file_name"),
    mimeType: text("mime_type").notNull().default("application/octet-stream"),
    size: integer("size").notNull().default(0),
    status: text("status").notNull().default("PUBLISHED"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_company_knowledge_company_status").on(table.companyId, table.status, table.sortOrder)],
);

export const companyMethodologyBriefs = sqliteTable("company_methodology_briefs", {
  companyId: text("company_id").primaryKey().references(() => companies.id),
  offer: text("offer").notNull().default(""),
  idealCustomer: text("ideal_customer").notNull().default(""),
  decisionMakers: text("decision_makers").notNull().default(""),
  customerProblems: text("customer_problems").notNull().default(""),
  salesGoal: text("sales_goal").notNull().default(""),
  nextStep: text("next_step").notNull().default(""),
  channelsJson: text("channels_json").notNull().default("[]"),
  tone: text("tone").notNull().default("Деловой и человеческий"),
  proofPoints: text("proof_points").notNull().default(""),
  mustSay: text("must_say").notNull().default(""),
  mustNotSay: text("must_not_say").notNull().default(""),
  language: text("language").notNull().default("Русский"),
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
    submissionFormJson: text("submission_form_json").notNull().default("[]"),
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

export const missionResources = sqliteTable(
  "mission_resources",
  {
    id: text("id").primaryKey(),
    missionId: text("mission_id").notNull().references(() => missions.id),
    companyId: text("company_id").notNull().references(() => companies.id),
    objectKey: text("object_key").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull().default("application/octet-stream"),
    size: integer("size").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_mission_resources_mission").on(table.missionId, table.createdAt),
    index("idx_mission_resources_company").on(table.companyId),
  ],
);

export const partners = sqliteTable(
  "partners",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id),
    companyId: text("company_id").notNull().references(() => companies.id),
    programId: text("program_id").notNull().references(() => programs.id),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull().default(""),
    status: text("status").notNull().default("ACTIVE"),
    joinedAt: text("joined_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    lastActiveAt: text("last_active_at"),
  },
  (table) => [
    uniqueIndex("idx_partners_program_email").on(table.programId, table.email),
    index("idx_partners_company_status").on(table.companyId, table.status),
    index("idx_partners_user_id").on(table.userId),
  ],
);

export const legalAcceptances = sqliteTable(
  "legal_acceptances",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    programId: text("program_id").notNull().references(() => programs.id),
    documentVersion: text("document_version").notNull(),
    acceptedAt: text("accepted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_legal_acceptances_user_program").on(table.userId, table.programId)],
);

export const partnerAccessLinks = sqliteTable(
  "partner_access_links",
  {
    id: text("id").primaryKey(),
    partnerId: text("partner_id").notNull().references(() => partners.id),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: text("expires_at").notNull(),
    lastUsedAt: text("last_used_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_partner_access_links_partner").on(table.partnerId)],
);

export const partnerReferralLinks = sqliteTable(
  "partner_referral_links",
  {
    id: text("id").primaryKey(),
    partnerId: text("partner_id").notNull().references(() => partners.id),
    missionId: text("mission_id").notNull().references(() => missions.id),
    tokenHash: text("token_hash").notNull().unique(),
    status: text("status").notNull().default("ACTIVE"),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_partner_referral_links_partner").on(table.partnerId, table.status),
    index("idx_partner_referral_links_mission").on(table.missionId),
  ],
);

export const partnerProfiles = sqliteTable("partner_profiles", {
  partnerId: text("partner_id").primaryKey().references(() => partners.id),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  middleName: text("middle_name").notNull().default(""),
  instagram: text("instagram").notNull().default(""),
  avatarObjectKey: text("avatar_object_key"),
  skillsJson: text("skills_json").notNull().default("[]"),
  industriesJson: text("industries_json").notNull().default("[]"),
  geographiesJson: text("geographies_json").notNull().default("[]"),
  preferredTypesJson: text("preferred_types_json").notNull().default("[]"),
  level: integer("level").notNull().default(1),
  usefulActionStreak: integer("useful_action_streak").notNull().default(0),
  emailVerifiedAt: text("email_verified_at"),
  whatsappVerifiedAt: text("whatsapp_verified_at"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const contactVerificationCodes = sqliteTable(
  "contact_verification_codes",
  {
    id: text("id").primaryKey(),
    partnerId: text("partner_id").notNull().references(() => partners.id),
    channel: text("channel").notNull(),
    destination: text("destination").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    consumedAt: text("consumed_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_contact_verification_partner_channel").on(table.partnerId, table.channel, table.createdAt)],
);

export const partnerMissionAcceptances = sqliteTable(
  "partner_mission_acceptances",
  {
    id: text("id").primaryKey(),
    partnerId: text("partner_id").notNull().references(() => partners.id),
    missionId: text("mission_id").notNull().references(() => missions.id),
    status: text("status").notNull().default("ACTIVE"),
    acceptedAt: text("accepted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    completedAt: text("completed_at"),
  },
  (table) => [
    uniqueIndex("idx_partner_missions_unique").on(table.partnerId, table.missionId),
    index("idx_partner_missions_partner_status").on(table.partnerId, table.status),
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

export const submissionAttachments = sqliteTable(
  "submission_attachments",
  {
    id: text("id").primaryKey(),
    submissionId: text("submission_id").notNull().references(() => submissions.id),
    objectKey: text("object_key"),
    externalUrl: text("external_url"),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull().default("application/octet-stream"),
    size: integer("size").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_submission_attachments_submission").on(table.submissionId)],
);

export const submissionStatusEvents = sqliteTable(
  "submission_status_events",
  {
    id: text("id").primaryKey(),
    submissionId: text("submission_id").notNull().references(() => submissions.id),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    actorType: text("actor_type").notNull(),
    comment: text("comment").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_submission_events_submission_created").on(table.submissionId, table.createdAt)],
);

export const submissionDisputes = sqliteTable(
  "submission_disputes",
  {
    id: text("id").primaryKey(),
    submissionId: text("submission_id").notNull().references(() => submissions.id),
    partnerId: text("partner_id").notNull().references(() => partners.id),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("OPEN"),
    resolution: text("resolution").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    resolvedAt: text("resolved_at"),
  },
  (table) => [index("idx_submission_disputes_submission_status").on(table.submissionId, table.status)],
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
    partnerConfirmedAt: text("partner_confirmed_at"),
    plannedAt: text("planned_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_rewards_company_status").on(table.companyId, table.status),
    index("idx_rewards_partner_status").on(table.partnerId, table.status),
  ],
);

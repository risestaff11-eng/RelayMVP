import { sql } from "drizzle-orm";
import { index, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

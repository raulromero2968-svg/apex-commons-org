import { pgEnum, pgTable, text, timestamp, varchar, serial, integer, jsonb } from "drizzle-orm/pg-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */

export const roleEnum = pgEnum("role", ["user", "admin", "teacher"]);
export const contributorLevelEnum = pgEnum("contributor_level", ["bronze", "silver", "gold", "platinum"]);
export const resourceStatusEnum = pgEnum("resource_status", ["pending", "approved", "rejected"]);
export const rcTransactionTypeEnum = pgEnum("rc_transaction_type", [
  "upvote_received", "resource_approved", "resource_submitted",
  "proposal_created", "vote_cast", "admin_adjustment", "daily_login", "level_up_bonus", "bonus"
]);

export const users = pgTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  contributorLevel: contributorLevelEnum("contributorLevel").default("bronze"),
  reputationCredits: integer("reputationCredits").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Waitlist signups
export const waitlist = pgTable("waitlist", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name"),
  email: varchar("email", { length: 320 }).notNull(),
  message: text("message"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type Waitlist = typeof waitlist.$inferSelect;
export type InsertWaitlist = typeof waitlist.$inferInsert;

// Educational Resources - The Content Core
export const resources = pgTable("resources", {
  id: serial("id").primaryKey(),
  contributorId: varchar("contributorId", { length: 64 }).notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 64 }).notNull(),
  gradeLevel: varchar("gradeLevel", { length: 32 }).notNull(),
  resourceType: varchar("resourceType", { length: 64 }).notNull(),
  thumbnailUrl: text("thumbnailUrl"),
  files: jsonb("files").$type<{ url: string; name: string; size: number; type: string }[]>().default([]),
  status: resourceStatusEnum("status").default("pending").notNull(),
  upvotes: integer("upvotes").default(0).notNull(),
  downvotes: integer("downvotes").default(0).notNull(),
  views: integer("views").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Resource = typeof resources.$inferSelect;
export type InsertResource = typeof resources.$inferInsert;

// Resource Voting (prevents duplicate votes)
export const resourceVotes = pgTable("resource_votes", {
  id: serial("id").primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull().references(() => users.id),
  resourceId: integer("resourceId").notNull().references(() => resources.id),
  voteType: integer("voteType").notNull(), // 1 = upvote, -1 = downvote
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ResourceVote = typeof resourceVotes.$inferSelect;
export type InsertResourceVote = typeof resourceVotes.$inferInsert;

// Reputation Credit Transactions (The Moral Engine Ledger)
export const rcTransactions = pgTable("rc_transactions", {
  id: serial("id").primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull().references(() => users.id),
  amount: integer("amount").notNull(),
  type: rcTransactionTypeEnum("type").notNull(),
  referenceId: integer("referenceId"), // Points to resourceId or other entity
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RcTransaction = typeof rcTransactions.$inferSelect;
export type InsertRcTransaction = typeof rcTransactions.$inferInsert;

// Proposal status enum
export const proposalStatusEnum = pgEnum("proposal_status", ["active", "passed", "rejected", "expired"]);

// Proposals - The Community Brain
export const proposals = pgTable("proposals", {
  id: serial("id").primaryKey(),
  authorId: varchar("authorId", { length: 64 }).notNull().references(() => users.id),
  title: varchar("title", { length: 100 }).notNull(),
  content: text("content").notNull(),
  status: proposalStatusEnum("status").default("active").notNull(),
  yesVotes: integer("yesVotes").default(0).notNull(),
  noVotes: integer("noVotes").default(0).notNull(),
  abstainVotes: integer("abstainVotes").default(0).notNull(),
  startDate: timestamp("startDate").defaultNow(),
  endDate: timestamp("endDate").notNull(),
});

export type Proposal = typeof proposals.$inferSelect;
export type InsertProposal = typeof proposals.$inferInsert;

// Vote type enum
export const voteTypeEnum = pgEnum("vote_type", ["yes", "no", "abstain"]);

// Proposal Votes - Democratic Participation Record
export const proposalVotes = pgTable("proposal_votes", {
  id: serial("id").primaryKey(),
  proposalId: integer("proposalId").notNull().references(() => proposals.id),
  userId: varchar("userId", { length: 64 }).notNull().references(() => users.id),
  vote: voteTypeEnum("vote").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProposalVote = typeof proposalVotes.$inferSelect;
export type InsertProposalVote = typeof proposalVotes.$inferInsert;

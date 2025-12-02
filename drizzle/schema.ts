import { pgEnum, pgTable, text, timestamp, varchar, integer, boolean } from "drizzle-orm/pg-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const contributorLevelEnum = pgEnum("contributor_level", ["bronze", "silver", "gold", "platinum"]);

export const users = pgTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  reputationCredits: integer("reputationCredits").default(0).notNull(),
  contributorLevel: contributorLevelEnum("contributorLevel").default("bronze").notNull(),
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

// Resource categories and status enums
export const resourceCategoryEnum = pgEnum("resource_category", [
  "tutorial", "tool", "library", "article", "video", "course", "template", "other"
]);
export const resourceStatusEnum = pgEnum("resource_status", ["pending", "approved", "rejected"]);

// Resources - The Content Core
export const resources = pgTable("resources", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  url: varchar("url", { length: 2048 }).notNull(),
  category: resourceCategoryEnum("category").default("other").notNull(),
  tags: text("tags"), // JSON array stored as text
  submitterId: varchar("submitterId", { length: 64 }).notNull(),
  status: resourceStatusEnum("status").default("pending").notNull(),
  upvotes: integer("upvotes").default(0).notNull(),
  downvotes: integer("downvotes").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  approvedAt: timestamp("approvedAt"),
});

export type Resource = typeof resources.$inferSelect;
export type InsertResource = typeof resources.$inferInsert;

// RC Transaction types
export const rcTransactionTypeEnum = pgEnum("rc_transaction_type", [
  "resource_submitted", "resource_approved", "resource_upvoted",
  "proposal_created", "vote_cast", "admin_adjustment", "bonus"
]);

// Reputation Credit Transactions - The Moral Engine Ledger
export const rcTransactions = pgTable("rc_transactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("userId", { length: 64 }).notNull(),
  amount: integer("amount").notNull(),
  type: rcTransactionTypeEnum("type").notNull(),
  referenceId: varchar("referenceId", { length: 64 }), // Related resource/proposal ID
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type RcTransaction = typeof rcTransactions.$inferSelect;
export type InsertRcTransaction = typeof rcTransactions.$inferInsert;

// Proposal status enum
export const proposalStatusEnum = pgEnum("proposal_status", ["active", "passed", "rejected", "expired"]);

// Proposals - The Community Brain
export const proposals = pgTable("proposals", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  authorId: varchar("authorId", { length: 64 }).notNull(),
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
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  proposalId: integer("proposalId").notNull(),
  userId: varchar("userId", { length: 64 }).notNull(),
  vote: voteTypeEnum("vote").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type ProposalVote = typeof proposalVotes.$inferSelect;
export type InsertProposalVote = typeof proposalVotes.$inferInsert;

// Resource Votes - Track individual votes on resources
export const resourceVotes = pgTable("resource_votes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  resourceId: integer("resourceId").notNull(),
  userId: varchar("userId", { length: 64 }).notNull(),
  vote: integer("vote").notNull(), // 1 for upvote, -1 for downvote
  createdAt: timestamp("createdAt").defaultNow(),
});

export type ResourceVote = typeof resourceVotes.$inferSelect;
export type InsertResourceVote = typeof resourceVotes.$inferInsert;


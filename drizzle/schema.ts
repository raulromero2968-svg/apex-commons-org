import { pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */

export const roleEnum = pgEnum("role", ["user", "admin"]);

export const users = pgTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
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

// Resource categories enum
export const categoryEnum = pgEnum("category", [
  "Mathematics",
  "Science",
  "History",
  "Computer Science",
  "Language Arts",
  "Social Studies",
  "Arts",
  "Physical Education",
  "Other",
]);

// Grade levels enum
export const gradeLevelEnum = pgEnum("grade_level", [
  "Elementary",
  "Middle School",
  "High School",
  "University",
  "Professional",
]);

// Resource types enum
export const resourceTypeEnum = pgEnum("resource_type", [
  "Lesson Plan",
  "Worksheet",
  "Video",
  "Interactive",
  "Assessment",
  "Presentation",
  "Article",
  "Other",
]);

// Contributor reputation levels enum
export const contributorLevelEnum = pgEnum("contributor_level", [
  "bronze",
  "silver",
  "gold",
  "platinum",
]);

// Contributors table (extends users with reputation)
export const contributors = pgTable("contributors", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).references(() => users.id),
  name: text("name").notNull(),
  level: contributorLevelEnum("level").default("bronze").notNull(),
  totalContributions: varchar("totalContributions", { length: 10 }).default("0"),
  reputation: varchar("reputation", { length: 10 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type Contributor = typeof contributors.$inferSelect;
export type InsertContributor = typeof contributors.$inferInsert;

// Resources table - the core of our knowledge library
export const resources = pgTable("resources", {
  id: varchar("id", { length: 64 }).primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  category: categoryEnum("category").notNull(),
  gradeLevel: gradeLevelEnum("gradeLevel").notNull(),
  resourceType: resourceTypeEnum("resourceType").notNull(),

  // File information
  fileUrl: text("fileUrl"),
  thumbnailUrl: text("thumbnailUrl"),
  fileSize: varchar("fileSize", { length: 20 }),
  mimeType: varchar("mimeType", { length: 100 }),

  // Contributor reference
  contributorId: varchar("contributorId", { length: 64 })
    .references(() => contributors.id)
    .notNull(),

  // Engagement metrics
  upvotes: varchar("upvotes", { length: 10 }).default("0"),
  downvotes: varchar("downvotes", { length: 10 }).default("0"),
  views: varchar("views", { length: 10 }).default("0"),
  downloads: varchar("downloads", { length: 10 }).default("0"),

  // Tags for search
  tags: text("tags"), // Comma-separated for simplicity

  // Status
  isPublished: varchar("isPublished", { length: 5 }).default("true"),
  isFeatured: varchar("isFeatured", { length: 5 }).default("false"),

  // Timestamps
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export type Resource = typeof resources.$inferSelect;
export type InsertResource = typeof resources.$inferInsert;

// Resource votes - track who voted on what
export const resourceVotes = pgTable("resource_votes", {
  id: varchar("id", { length: 64 }).primaryKey(),
  resourceId: varchar("resourceId", { length: 64 })
    .references(() => resources.id)
    .notNull(),
  userId: varchar("userId", { length: 64 })
    .references(() => users.id)
    .notNull(),
  voteType: varchar("voteType", { length: 10 }).notNull(), // 'up' or 'down'
  createdAt: timestamp("createdAt").defaultNow(),
});

export type ResourceVote = typeof resourceVotes.$inferSelect;
export type InsertResourceVote = typeof resourceVotes.$inferInsert;


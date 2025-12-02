import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
  integer,
  boolean,
  json,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================================
// ENUMS
// ============================================================================

export const roleEnum = pgEnum("role", ["user", "teacher", "moderator", "admin"]);

export const resourceStatusEnum = pgEnum("resource_status", [
  "draft",
  "pending",
  "approved",
  "rejected",
  "archived",
]);

export const resourceCategoryEnum = pgEnum("resource_category", [
  "lesson_plan",
  "worksheet",
  "assessment",
  "presentation",
  "video",
  "interactive",
  "reference",
  "template",
  "other",
]);

export const resourceTypeEnum = pgEnum("resource_type", [
  "pdf",
  "doc",
  "ppt",
  "video",
  "image",
  "link",
  "html",
  "zip",
  "other",
]);

export const gradeLevelEnum = pgEnum("grade_level", [
  "pre_k",
  "kindergarten",
  "1st",
  "2nd",
  "3rd",
  "4th",
  "5th",
  "6th",
  "7th",
  "8th",
  "9th",
  "10th",
  "11th",
  "12th",
  "higher_ed",
  "professional",
  "all",
]);

export const subjectEnum = pgEnum("subject", [
  "math",
  "science",
  "english",
  "history",
  "geography",
  "art",
  "music",
  "pe",
  "computer_science",
  "foreign_language",
  "social_studies",
  "stem",
  "special_education",
  "other",
]);

export const visibilityEnum = pgEnum("visibility", ["public", "private", "unlisted"]);

export const proposalStatusEnum = pgEnum("proposal_status", [
  "draft",
  "active",
  "accepted",
  "rejected",
  "withdrawn",
]);

export const proposalChoiceEnum = pgEnum("proposal_choice", ["for", "against", "abstain"]);

export const rcReasonEnum = pgEnum("rc_reason", [
  "resource_submitted",
  "resource_approved",
  "resource_rejected",
  "resource_upvoted",
  "resource_downvoted",
  "proposal_created",
  "proposal_passed",
  "proposal_rejected",
  "proposal_vote_cast",
  "moderation_action",
  "flag_submitted",
  "flag_upheld",
  "flag_dismissed",
  "daily_login",
  "referral_bonus",
  "manual_adjustment",
]);

export const flagStatusEnum = pgEnum("flag_status", [
  "open",
  "under_review",
  "resolved",
  "dismissed",
]);

export const flagReasonEnum = pgEnum("flag_reason", [
  "inappropriate_content",
  "copyright_violation",
  "inaccurate_information",
  "spam",
  "low_quality",
  "duplicate",
  "offensive_language",
  "other",
]);

export const contributorLevelEnum = pgEnum("contributor_level", [
  "newcomer",
  "contributor",
  "trusted",
  "expert",
  "master",
]);

// ============================================================================
// USERS
// ============================================================================

export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("login_method", { length: 64 }),
    role: roleEnum("role").default("user").notNull(),

    // Profile fields
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    subjects: json("subjects").$type<string[]>().default([]),
    gradeLevels: json("grade_levels").$type<string[]>().default([]),

    // Reputation & Contribution
    reputationCredits: integer("reputation_credits").default(0).notNull(),
    contributorLevel: contributorLevelEnum("contributor_level").default("newcomer").notNull(),

    // Stats (denormalized for performance)
    totalResourcesSubmitted: integer("total_resources_submitted").default(0).notNull(),
    totalResourcesApproved: integer("total_resources_approved").default(0).notNull(),
    totalUpvotesReceived: integer("total_upvotes_received").default(0).notNull(),
    totalDownloadsReceived: integer("total_downloads_received").default(0).notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    lastSignedIn: timestamp("last_signed_in").defaultNow(),
  },
  (table) => [
    index("users_role_idx").on(table.role),
    index("users_contributor_level_idx").on(table.contributorLevel),
    index("users_reputation_idx").on(table.reputationCredits),
  ]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================================================
// WAITLIST
// ============================================================================

export const waitlist = pgTable("waitlist", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name"),
  email: varchar("email", { length: 320 }).notNull(),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Waitlist = typeof waitlist.$inferSelect;
export type InsertWaitlist = typeof waitlist.$inferInsert;

// ============================================================================
// RESOURCES
// ============================================================================

export const resources = pgTable(
  "resources",
  {
    id: varchar("id", { length: 64 }).primaryKey(),

    // Core metadata
    title: text("title").notNull(),
    description: text("description"),
    summary: text("summary"), // Short summary for cards

    // Classification
    category: resourceCategoryEnum("category").notNull(),
    resourceType: resourceTypeEnum("resource_type").notNull(),
    subject: subjectEnum("subject").notNull(),
    gradeLevel: gradeLevelEnum("grade_level").notNull(),

    // Tags and standards
    tags: json("tags").$type<string[]>().default([]),
    standards: json("standards").$type<string[]>().default([]), // e.g., Common Core standards

    // File/Content
    fileUrl: text("file_url"),
    fileName: text("file_name"),
    fileSize: integer("file_size"), // in bytes
    thumbnailUrl: text("thumbnail_url"),
    externalUrl: text("external_url"), // for link-type resources

    // Authorship
    contributorId: varchar("contributor_id", { length: 64 })
      .notNull()
      .references(() => users.id),

    // Status & Review
    status: resourceStatusEnum("status").default("draft").notNull(),
    reviewedBy: varchar("reviewed_by", { length: 64 }).references(() => users.id),
    reviewedAt: timestamp("reviewed_at"),
    reviewNotes: text("review_notes"),

    // Engagement stats (denormalized for performance)
    viewCount: integer("view_count").default(0).notNull(),
    downloadCount: integer("download_count").default(0).notNull(),
    upvoteCount: integer("upvote_count").default(0).notNull(),
    downvoteCount: integer("downvote_count").default(0).notNull(),
    netVotes: integer("net_votes").default(0).notNull(), // upvotes - downvotes
    commentCount: integer("comment_count").default(0).notNull(),

    // Flags
    isFeatured: boolean("is_featured").default(false).notNull(),
    isEditorPick: boolean("is_editor_pick").default(false).notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    publishedAt: timestamp("published_at"),
  },
  (table) => [
    index("resources_status_idx").on(table.status),
    index("resources_category_idx").on(table.category),
    index("resources_subject_idx").on(table.subject),
    index("resources_grade_level_idx").on(table.gradeLevel),
    index("resources_contributor_idx").on(table.contributorId),
    index("resources_net_votes_idx").on(table.netVotes),
    index("resources_view_count_idx").on(table.viewCount),
    index("resources_created_at_idx").on(table.createdAt),
    index("resources_published_at_idx").on(table.publishedAt),
  ]
);

export type Resource = typeof resources.$inferSelect;
export type InsertResource = typeof resources.$inferInsert;

// ============================================================================
// RESOURCE VOTES
// ============================================================================

export const resourceVotes = pgTable(
  "resource_votes",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    resourceId: varchar("resource_id", { length: 64 })
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    value: integer("value").notNull(), // +1 or -1
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("resource_votes_unique_idx").on(table.resourceId, table.userId),
    index("resource_votes_resource_idx").on(table.resourceId),
    index("resource_votes_user_idx").on(table.userId),
  ]
);

export type ResourceVote = typeof resourceVotes.$inferSelect;
export type InsertResourceVote = typeof resourceVotes.$inferInsert;

// ============================================================================
// RESOURCE COMMENTS
// ============================================================================

export const resourceComments = pgTable(
  "resource_comments",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    resourceId: varchar("resource_id", { length: 64 })
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: varchar("parent_id", { length: 64 }), // for threaded comments
    content: text("content").notNull(),
    isEdited: boolean("is_edited").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("resource_comments_resource_idx").on(table.resourceId),
    index("resource_comments_user_idx").on(table.userId),
    index("resource_comments_parent_idx").on(table.parentId),
  ]
);

export type ResourceComment = typeof resourceComments.$inferSelect;
export type InsertResourceComment = typeof resourceComments.$inferInsert;

// ============================================================================
// COLLECTIONS
// ============================================================================

export const collections = pgTable(
  "collections",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    ownerId: varchar("owner_id", { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    visibility: visibilityEnum("visibility").default("private").notNull(),
    tags: json("tags").$type<string[]>().default([]),
    thumbnailUrl: text("thumbnail_url"),

    // Stats
    resourceCount: integer("resource_count").default(0).notNull(),
    followerCount: integer("follower_count").default(0).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("collections_owner_idx").on(table.ownerId),
    index("collections_visibility_idx").on(table.visibility),
  ]
);

export type Collection = typeof collections.$inferSelect;
export type InsertCollection = typeof collections.$inferInsert;

// ============================================================================
// COLLECTION RESOURCES (JOIN TABLE)
// ============================================================================

export const collectionResources = pgTable(
  "collection_resources",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    collectionId: varchar("collection_id", { length: 64 })
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    resourceId: varchar("resource_id", { length: 64 })
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").default(0).notNull(),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("collection_resources_unique_idx").on(table.collectionId, table.resourceId),
    index("collection_resources_collection_idx").on(table.collectionId),
    index("collection_resources_resource_idx").on(table.resourceId),
  ]
);

export type CollectionResource = typeof collectionResources.$inferSelect;
export type InsertCollectionResource = typeof collectionResources.$inferInsert;

// ============================================================================
// PROPOSALS (GOVERNANCE)
// ============================================================================

export const proposals = pgTable(
  "proposals",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    authorId: varchar("author_id", { length: 64 })
      .notNull()
      .references(() => users.id),

    // Content
    title: text("title").notNull(),
    summary: text("summary").notNull(), // Short summary
    body: text("body").notNull(), // Full proposal text (markdown)

    // Status
    status: proposalStatusEnum("status").default("draft").notNull(),

    // RC requirements
    minRcToCreate: integer("min_rc_to_create").default(100).notNull(),
    minRcToVote: integer("min_rc_to_vote").default(10).notNull(),
    snapshotRc: integer("snapshot_rc").notNull(), // Author's RC when created

    // Voting results
    votesFor: integer("votes_for").default(0).notNull(),
    votesAgainst: integer("votes_against").default(0).notNull(),
    votesAbstain: integer("votes_abstain").default(0).notNull(),
    totalRcWeight: integer("total_rc_weight").default(0).notNull(), // Total RC weight of all votes

    // Tags
    tags: json("tags").$type<string[]>().default([]),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    activatedAt: timestamp("activated_at"),
    closedAt: timestamp("closed_at"),
    votingEndsAt: timestamp("voting_ends_at"),
  },
  (table) => [
    index("proposals_status_idx").on(table.status),
    index("proposals_author_idx").on(table.authorId),
    index("proposals_created_at_idx").on(table.createdAt),
    index("proposals_voting_ends_idx").on(table.votingEndsAt),
  ]
);

export type Proposal = typeof proposals.$inferSelect;
export type InsertProposal = typeof proposals.$inferInsert;

// ============================================================================
// PROPOSAL VOTES
// ============================================================================

export const proposalVotes = pgTable(
  "proposal_votes",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    proposalId: varchar("proposal_id", { length: 64 })
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    voterId: varchar("voter_id", { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    choice: proposalChoiceEnum("choice").notNull(),
    weightRc: integer("weight_rc").notNull(), // RC weight at vote time
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("proposal_votes_unique_idx").on(table.proposalId, table.voterId),
    index("proposal_votes_proposal_idx").on(table.proposalId),
    index("proposal_votes_voter_idx").on(table.voterId),
  ]
);

export type ProposalVote = typeof proposalVotes.$inferSelect;
export type InsertProposalVote = typeof proposalVotes.$inferInsert;

// ============================================================================
// RC TRANSACTIONS (REPUTATION CREDITS LEDGER)
// ============================================================================

export const rcTransactions = pgTable(
  "rc_transactions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(), // positive = earn, negative = spend
    reason: rcReasonEnum("reason").notNull(),

    // Reference to related entity
    referenceType: text("reference_type"), // 'resource', 'proposal', 'flag', etc.
    referenceId: varchar("reference_id", { length: 64 }),

    // Additional metadata
    meta: json("meta").$type<Record<string, unknown>>().default({}),

    // Running balance after this transaction
    balanceAfter: integer("balance_after").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("rc_transactions_user_idx").on(table.userId),
    index("rc_transactions_reason_idx").on(table.reason),
    index("rc_transactions_created_at_idx").on(table.createdAt),
    index("rc_transactions_reference_idx").on(table.referenceType, table.referenceId),
  ]
);

export type RcTransaction = typeof rcTransactions.$inferSelect;
export type InsertRcTransaction = typeof rcTransactions.$inferInsert;

// ============================================================================
// MODERATION FLAGS
// ============================================================================

export const moderationFlags = pgTable(
  "moderation_flags",
  {
    id: varchar("id", { length: 64 }).primaryKey(),

    // What's being flagged
    targetType: text("target_type").notNull(), // 'resource', 'comment', 'collection'
    targetId: varchar("target_id", { length: 64 }).notNull(),

    // Who flagged it
    reporterId: varchar("reporter_id", { length: 64 })
      .notNull()
      .references(() => users.id),

    // Flag details
    reason: flagReasonEnum("reason").notNull(),
    details: text("details"), // Additional explanation

    // Resolution
    status: flagStatusEnum("status").default("open").notNull(),
    resolvedBy: varchar("resolved_by", { length: 64 }).references(() => users.id),
    resolvedAt: timestamp("resolved_at"),
    resolutionNotes: text("resolution_notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("moderation_flags_status_idx").on(table.status),
    index("moderation_flags_target_idx").on(table.targetType, table.targetId),
    index("moderation_flags_reporter_idx").on(table.reporterId),
    index("moderation_flags_created_at_idx").on(table.createdAt),
  ]
);

export type ModerationFlag = typeof moderationFlags.$inferSelect;
export type InsertModerationFlag = typeof moderationFlags.$inferInsert;

// ============================================================================
// RESOURCE DOWNLOADS (TRACKING)
// ============================================================================

export const resourceDownloads = pgTable(
  "resource_downloads",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    resourceId: varchar("resource_id", { length: 64 })
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 64 }).references(() => users.id, { onDelete: "set null" }),
    ipHash: varchar("ip_hash", { length: 64 }), // hashed IP for anonymous downloads
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("resource_downloads_resource_idx").on(table.resourceId),
    index("resource_downloads_user_idx").on(table.userId),
  ]
);

export type ResourceDownload = typeof resourceDownloads.$inferSelect;
export type InsertResourceDownload = typeof resourceDownloads.$inferInsert;

// ============================================================================
// RESOURCE VIEWS (TRACKING)
// ============================================================================

export const resourceViews = pgTable(
  "resource_views",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    resourceId: varchar("resource_id", { length: 64 })
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 64 }).references(() => users.id, { onDelete: "set null" }),
    ipHash: varchar("ip_hash", { length: 64 }), // hashed IP for anonymous views
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("resource_views_resource_idx").on(table.resourceId),
    index("resource_views_user_idx").on(table.userId),
  ]
);

export type ResourceView = typeof resourceViews.$inferSelect;
export type InsertResourceView = typeof resourceViews.$inferInsert;

// ============================================================================
// COLLECTION FOLLOWERS
// ============================================================================

export const collectionFollowers = pgTable(
  "collection_followers",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    collectionId: varchar("collection_id", { length: 64 })
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("collection_followers_unique_idx").on(table.collectionId, table.userId),
    index("collection_followers_collection_idx").on(table.collectionId),
    index("collection_followers_user_idx").on(table.userId),
  ]
);

export type CollectionFollower = typeof collectionFollowers.$inferSelect;
export type InsertCollectionFollower = typeof collectionFollowers.$inferInsert;

// ============================================================================
// RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  resources: many(resources),
  resourceVotes: many(resourceVotes),
  resourceComments: many(resourceComments),
  collections: many(collections),
  proposals: many(proposals),
  proposalVotes: many(proposalVotes),
  rcTransactions: many(rcTransactions),
  moderationFlags: many(moderationFlags),
}));

export const resourcesRelations = relations(resources, ({ one, many }) => ({
  contributor: one(users, {
    fields: [resources.contributorId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [resources.reviewedBy],
    references: [users.id],
  }),
  votes: many(resourceVotes),
  comments: many(resourceComments),
  collectionResources: many(collectionResources),
  downloads: many(resourceDownloads),
  views: many(resourceViews),
}));

export const resourceVotesRelations = relations(resourceVotes, ({ one }) => ({
  resource: one(resources, {
    fields: [resourceVotes.resourceId],
    references: [resources.id],
  }),
  user: one(users, {
    fields: [resourceVotes.userId],
    references: [users.id],
  }),
}));

export const resourceCommentsRelations = relations(resourceComments, ({ one, many }) => ({
  resource: one(resources, {
    fields: [resourceComments.resourceId],
    references: [resources.id],
  }),
  user: one(users, {
    fields: [resourceComments.userId],
    references: [users.id],
  }),
  parent: one(resourceComments, {
    fields: [resourceComments.parentId],
    references: [resourceComments.id],
  }),
  replies: many(resourceComments),
}));

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  owner: one(users, {
    fields: [collections.ownerId],
    references: [users.id],
  }),
  collectionResources: many(collectionResources),
  followers: many(collectionFollowers),
}));

export const collectionResourcesRelations = relations(collectionResources, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionResources.collectionId],
    references: [collections.id],
  }),
  resource: one(resources, {
    fields: [collectionResources.resourceId],
    references: [resources.id],
  }),
}));

export const proposalsRelations = relations(proposals, ({ one, many }) => ({
  author: one(users, {
    fields: [proposals.authorId],
    references: [users.id],
  }),
  votes: many(proposalVotes),
}));

export const proposalVotesRelations = relations(proposalVotes, ({ one }) => ({
  proposal: one(proposals, {
    fields: [proposalVotes.proposalId],
    references: [proposals.id],
  }),
  voter: one(users, {
    fields: [proposalVotes.voterId],
    references: [users.id],
  }),
}));

export const rcTransactionsRelations = relations(rcTransactions, ({ one }) => ({
  user: one(users, {
    fields: [rcTransactions.userId],
    references: [users.id],
  }),
}));

export const moderationFlagsRelations = relations(moderationFlags, ({ one }) => ({
  reporter: one(users, {
    fields: [moderationFlags.reporterId],
    references: [users.id],
  }),
  resolver: one(users, {
    fields: [moderationFlags.resolvedBy],
    references: [users.id],
  }),
}));

export const resourceDownloadsRelations = relations(resourceDownloads, ({ one }) => ({
  resource: one(resources, {
    fields: [resourceDownloads.resourceId],
    references: [resources.id],
  }),
  user: one(users, {
    fields: [resourceDownloads.userId],
    references: [users.id],
  }),
}));

export const resourceViewsRelations = relations(resourceViews, ({ one }) => ({
  resource: one(resources, {
    fields: [resourceViews.resourceId],
    references: [resources.id],
  }),
  user: one(users, {
    fields: [resourceViews.userId],
    references: [users.id],
  }),
}));

export const collectionFollowersRelations = relations(collectionFollowers, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionFollowers.collectionId],
    references: [collections.id],
  }),
  user: one(users, {
    fields: [collectionFollowers.userId],
    references: [users.id],
  }),
}));

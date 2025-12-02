import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, sql } from "drizzle-orm";
import {
  router,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
} from "../_core/trpc";
import { getDb } from "../db";
import {
  users,
  resources,
  rcTransactions,
  proposals,
  collections,
} from "../../drizzle/schema";
import { CONTRIBUTOR_LEVELS, PAGINATION } from "@shared/const";

// Input schemas
const updateProfileInput = z.object({
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  subjects: z.array(z.string()).optional(),
  gradeLevels: z.array(z.string()).optional(),
});

// Helper: Calculate contributor level from RC
function getContributorLevel(rc: number): keyof typeof CONTRIBUTOR_LEVELS {
  for (const [level, range] of Object.entries(CONTRIBUTOR_LEVELS)) {
    if (rc >= range.min && rc <= range.max) {
      return level as keyof typeof CONTRIBUTOR_LEVELS;
    }
  }
  return "newcomer";
}

export const userRouter = router({
  // Get current user (authenticated)
  me: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id));
    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    return {
      ...user,
      contributorLevelInfo: CONTRIBUTOR_LEVELS[user.contributorLevel],
    };
  }),

  // Get user profile (public)
  getProfile: publicProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        bio: users.bio,
        avatarUrl: users.avatarUrl,
        subjects: users.subjects,
        gradeLevels: users.gradeLevels,
        reputationCredits: users.reputationCredits,
        contributorLevel: users.contributorLevel,
        totalResourcesSubmitted: users.totalResourcesSubmitted,
        totalResourcesApproved: users.totalResourcesApproved,
        totalUpvotesReceived: users.totalUpvotesReceived,
        totalDownloadsReceived: users.totalDownloadsReceived,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, input.id));

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    return {
      ...user,
      contributorLevelInfo: CONTRIBUTOR_LEVELS[user.contributorLevel],
    };
  }),

  // Update profile (authenticated)
  updateProfile: protectedProcedure.input(updateProfileInput).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    await db
      .update(users)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(users.id, ctx.user.id));

    return { success: true };
  }),

  // Get user stats (public)
  getStats: publicProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const [user] = await db.select().from(users).where(eq(users.id, input.id));
    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    // Get additional stats
    const [resourceStats] = await db
      .select({
        totalViews: sql<number>`COALESCE(SUM(${resources.viewCount}), 0)`,
        totalComments: sql<number>`COALESCE(SUM(${resources.commentCount}), 0)`,
      })
      .from(resources)
      .where(eq(resources.contributorId, input.id));

    const [proposalCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(proposals)
      .where(eq(proposals.authorId, input.id));

    const [collectionCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(collections)
      .where(eq(collections.ownerId, input.id));

    return {
      reputationCredits: user.reputationCredits,
      contributorLevel: user.contributorLevel,
      contributorLevelInfo: CONTRIBUTOR_LEVELS[user.contributorLevel],
      totalResourcesSubmitted: user.totalResourcesSubmitted,
      totalResourcesApproved: user.totalResourcesApproved,
      totalUpvotesReceived: user.totalUpvotesReceived,
      totalDownloadsReceived: user.totalDownloadsReceived,
      totalViews: resourceStats?.totalViews ?? 0,
      totalComments: resourceStats?.totalComments ?? 0,
      totalProposals: proposalCount?.count ?? 0,
      totalCollections: collectionCount?.count ?? 0,
    };
  }),

  // Get RC transaction history (authenticated, own only)
  getRcHistory: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(PAGINATION.MAX_PAGE_SIZE).default(PAGINATION.DEFAULT_PAGE_SIZE),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const transactions = await db
        .select()
        .from(rcTransactions)
        .where(eq(rcTransactions.userId, ctx.user.id))
        .orderBy(desc(rcTransactions.createdAt))
        .limit(input.limit + 1);

      const hasMore = transactions.length > input.limit;
      const items = hasMore ? transactions.slice(0, -1) : transactions;

      return {
        items,
        nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
      };
    }),

  // Get user resources (public)
  getResources: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        status: z.enum(["draft", "pending", "approved", "rejected", "archived"]).optional(),
        limit: z.number().default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const conditions = [eq(resources.contributorId, input.userId)];

      // Only show non-approved resources to the owner
      if (input.status) {
        // If viewing own profile or specific status requested
        if (ctx.user?.id === input.userId || input.status === "approved") {
          conditions.push(eq(resources.status, input.status));
        } else {
          conditions.push(eq(resources.status, "approved"));
        }
      } else if (ctx.user?.id !== input.userId) {
        // If viewing another user's profile, only show approved
        conditions.push(eq(resources.status, "approved"));
      }

      const userResources = await db
        .select({
          id: resources.id,
          title: resources.title,
          summary: resources.summary,
          category: resources.category,
          subject: resources.subject,
          gradeLevel: resources.gradeLevel,
          thumbnailUrl: resources.thumbnailUrl,
          status: resources.status,
          netVotes: resources.netVotes,
          viewCount: resources.viewCount,
          downloadCount: resources.downloadCount,
          createdAt: resources.createdAt,
        })
        .from(resources)
        .where(sql`${conditions.map((c) => sql`${c}`).reduce((a, b) => sql`${a} AND ${b}`)}`)
        .orderBy(desc(resources.createdAt))
        .limit(input.limit);

      return userResources;
    }),

  // Get user collections (public)
  getCollections: publicProcedure
    .input(z.object({ userId: z.string(), limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const conditions = [eq(collections.ownerId, input.userId)];

      // Only show private collections to the owner
      if (ctx.user?.id !== input.userId) {
        conditions.push(eq(collections.visibility, "public"));
      }

      const userCollections = await db
        .select({
          id: collections.id,
          title: collections.title,
          description: collections.description,
          visibility: collections.visibility,
          thumbnailUrl: collections.thumbnailUrl,
          resourceCount: collections.resourceCount,
          followerCount: collections.followerCount,
          createdAt: collections.createdAt,
        })
        .from(collections)
        .where(sql`${conditions.map((c) => sql`${c}`).reduce((a, b) => sql`${a} AND ${b}`)}`)
        .orderBy(desc(collections.updatedAt))
        .limit(input.limit);

      return userCollections;
    }),

  // Leaderboard (public)
  getLeaderboard: publicProcedure
    .input(
      z.object({
        sortBy: z.enum(["rc", "resources", "upvotes", "downloads"]).default("rc"),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      let orderBy;
      switch (input.sortBy) {
        case "resources":
          orderBy = desc(users.totalResourcesApproved);
          break;
        case "upvotes":
          orderBy = desc(users.totalUpvotesReceived);
          break;
        case "downloads":
          orderBy = desc(users.totalDownloadsReceived);
          break;
        default:
          orderBy = desc(users.reputationCredits);
      }

      const leaderboard = await db
        .select({
          id: users.id,
          name: users.name,
          avatarUrl: users.avatarUrl,
          reputationCredits: users.reputationCredits,
          contributorLevel: users.contributorLevel,
          totalResourcesApproved: users.totalResourcesApproved,
          totalUpvotesReceived: users.totalUpvotesReceived,
          totalDownloadsReceived: users.totalDownloadsReceived,
        })
        .from(users)
        .orderBy(orderBy)
        .limit(input.limit);

      return leaderboard.map((user, index) => ({
        rank: index + 1,
        ...user,
        contributorLevelInfo: CONTRIBUTOR_LEVELS[user.contributorLevel],
      }));
    }),

  // Admin: Update user role
  updateRole: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        role: z.enum(["user", "teacher", "moderator", "admin"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [existing] = await db.select().from(users).where(eq(users.id, input.userId));
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      await db
        .update(users)
        .set({ role: input.role, updatedAt: new Date() })
        .where(eq(users.id, input.userId));

      return { success: true, previousRole: existing.role, newRole: input.role };
    }),

  // Admin: Adjust user RC
  adjustRc: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        amount: z.number(),
        reason: z.string().max(200),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [user] = await db.select().from(users).where(eq(users.id, input.userId));
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const newBalance = (user.reputationCredits ?? 0) + input.amount;
      const newLevel = getContributorLevel(newBalance);

      await db
        .update(users)
        .set({
          reputationCredits: newBalance,
          contributorLevel: newLevel,
          updatedAt: new Date(),
        })
        .where(eq(users.id, input.userId));

      // Log the transaction
      await db.insert(rcTransactions).values({
        id: `rc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: input.userId,
        amount: input.amount,
        reason: "manual_adjustment",
        meta: { adjustedBy: ctx.user.id, note: input.reason },
        balanceAfter: newBalance,
      });

      return { success: true, newBalance, newLevel };
    }),

  // Search users (public)
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().default(10),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const results = await db
        .select({
          id: users.id,
          name: users.name,
          avatarUrl: users.avatarUrl,
          contributorLevel: users.contributorLevel,
          reputationCredits: users.reputationCredits,
        })
        .from(users)
        .where(sql`${users.name} ILIKE ${"%" + input.query + "%"}`)
        .orderBy(desc(users.reputationCredits))
        .limit(input.limit);

      return results;
    }),
});

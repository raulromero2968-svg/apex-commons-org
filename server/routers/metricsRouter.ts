import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, sql, gte, lte, count } from "drizzle-orm";
import {
  router,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
} from "../_core/trpc";
import { getDb } from "../db";
import {
  resources,
  users,
  proposals,
  collections,
  resourceVotes,
  rcTransactions,
  moderationFlags,
  resourceViews,
  resourceDownloads,
} from "../../drizzle/schema";

export const metricsRouter = router({
  // Teacher dashboard metrics (authenticated)
  teacherDashboard: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const userId = ctx.user.id;

    // Resource counts by status
    const resourceCounts = await db
      .select({
        status: resources.status,
        count: sql<number>`count(*)`,
      })
      .from(resources)
      .where(eq(resources.contributorId, userId))
      .groupBy(resources.status);

    const countsByStatus = resourceCounts.reduce(
      (acc, row) => {
        acc[row.status] = row.count;
        return acc;
      },
      {} as Record<string, number>
    );

    // Aggregate stats
    const [aggregates] = await db
      .select({
        totalViews: sql<number>`COALESCE(SUM(${resources.viewCount}), 0)`,
        totalDownloads: sql<number>`COALESCE(SUM(${resources.downloadCount}), 0)`,
        totalUpvotes: sql<number>`COALESCE(SUM(${resources.upvoteCount}), 0)`,
        totalDownvotes: sql<number>`COALESCE(SUM(${resources.downvoteCount}), 0)`,
        totalComments: sql<number>`COALESCE(SUM(${resources.commentCount}), 0)`,
      })
      .from(resources)
      .where(eq(resources.contributorId, userId));

    // RC history (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const rcHistory = await db
      .select({
        amount: rcTransactions.amount,
        reason: rcTransactions.reason,
        createdAt: rcTransactions.createdAt,
      })
      .from(rcTransactions)
      .where(and(eq(rcTransactions.userId, userId), gte(rcTransactions.createdAt, thirtyDaysAgo)))
      .orderBy(desc(rcTransactions.createdAt))
      .limit(50);

    // Top performing resources
    const topResources = await db
      .select({
        id: resources.id,
        title: resources.title,
        viewCount: resources.viewCount,
        downloadCount: resources.downloadCount,
        netVotes: resources.netVotes,
      })
      .from(resources)
      .where(and(eq(resources.contributorId, userId), eq(resources.status, "approved")))
      .orderBy(desc(resources.netVotes))
      .limit(5);

    // Recent activity (views/downloads in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [recentViews] = await db
      .select({ count: sql<number>`count(*)` })
      .from(resourceViews)
      .innerJoin(resources, eq(resourceViews.resourceId, resources.id))
      .where(and(eq(resources.contributorId, userId), gte(resourceViews.createdAt, sevenDaysAgo)));

    const [recentDownloads] = await db
      .select({ count: sql<number>`count(*)` })
      .from(resourceDownloads)
      .innerJoin(resources, eq(resourceDownloads.resourceId, resources.id))
      .where(and(eq(resources.contributorId, userId), gte(resourceDownloads.createdAt, sevenDaysAgo)));

    return {
      resourceCounts: {
        draft: countsByStatus.draft ?? 0,
        pending: countsByStatus.pending ?? 0,
        approved: countsByStatus.approved ?? 0,
        rejected: countsByStatus.rejected ?? 0,
        archived: countsByStatus.archived ?? 0,
        total: Object.values(countsByStatus).reduce((a, b) => a + b, 0),
      },
      aggregates: {
        totalViews: aggregates?.totalViews ?? 0,
        totalDownloads: aggregates?.totalDownloads ?? 0,
        totalUpvotes: aggregates?.totalUpvotes ?? 0,
        totalDownvotes: aggregates?.totalDownvotes ?? 0,
        netVotes: (aggregates?.totalUpvotes ?? 0) - (aggregates?.totalDownvotes ?? 0),
        totalComments: aggregates?.totalComments ?? 0,
      },
      recentActivity: {
        viewsLast7Days: recentViews?.count ?? 0,
        downloadsLast7Days: recentDownloads?.count ?? 0,
      },
      rcHistory,
      topResources,
      user: {
        reputationCredits: ctx.user.reputationCredits,
        contributorLevel: ctx.user.contributorLevel,
        totalResourcesSubmitted: ctx.user.totalResourcesSubmitted,
        totalResourcesApproved: ctx.user.totalResourcesApproved,
        totalUpvotesReceived: ctx.user.totalUpvotesReceived,
        totalDownloadsReceived: ctx.user.totalDownloadsReceived,
      },
    };
  }),

  // Site-wide stats (public)
  siteStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const [totalUsers] = await db.select({ count: sql<number>`count(*)` }).from(users);

    const [totalResources] = await db
      .select({ count: sql<number>`count(*)` })
      .from(resources)
      .where(eq(resources.status, "approved"));

    const [totalCollections] = await db
      .select({ count: sql<number>`count(*)` })
      .from(collections)
      .where(eq(collections.visibility, "public"));

    const [totalProposals] = await db.select({ count: sql<number>`count(*)` }).from(proposals);

    const [activeProposals] = await db
      .select({ count: sql<number>`count(*)` })
      .from(proposals)
      .where(eq(proposals.status, "active"));

    const [totalViews] = await db
      .select({ sum: sql<number>`COALESCE(SUM(${resources.viewCount}), 0)` })
      .from(resources);

    const [totalDownloads] = await db
      .select({ sum: sql<number>`COALESCE(SUM(${resources.downloadCount}), 0)` })
      .from(resources);

    const [totalVotes] = await db.select({ count: sql<number>`count(*)` }).from(resourceVotes);

    return {
      totalUsers: totalUsers?.count ?? 0,
      totalResources: totalResources?.count ?? 0,
      totalCollections: totalCollections?.count ?? 0,
      totalProposals: totalProposals?.count ?? 0,
      activeProposals: activeProposals?.count ?? 0,
      totalViews: totalViews?.sum ?? 0,
      totalDownloads: totalDownloads?.sum ?? 0,
      totalVotes: totalVotes?.count ?? 0,
    };
  }),

  // Admin dashboard metrics
  adminDashboard: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    // Users by role
    const usersByRole = await db
      .select({
        role: users.role,
        count: sql<number>`count(*)`,
      })
      .from(users)
      .groupBy(users.role);

    // Resources by status
    const resourcesByStatus = await db
      .select({
        status: resources.status,
        count: sql<number>`count(*)`,
      })
      .from(resources)
      .groupBy(resources.status);

    // Pending moderation
    const [pendingResources] = await db
      .select({ count: sql<number>`count(*)` })
      .from(resources)
      .where(eq(resources.status, "pending"));

    const [openFlags] = await db
      .select({ count: sql<number>`count(*)` })
      .from(moderationFlags)
      .where(eq(moderationFlags.status, "open"));

    // New users this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const [newUsersThisWeek] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(gte(users.createdAt, oneWeekAgo));

    // New resources this week
    const [newResourcesThisWeek] = await db
      .select({ count: sql<number>`count(*)` })
      .from(resources)
      .where(gte(resources.createdAt, oneWeekAgo));

    // Total RC in circulation
    const [totalRc] = await db
      .select({ sum: sql<number>`COALESCE(SUM(${users.reputationCredits}), 0)` })
      .from(users);

    // Top contributors
    const topContributors = await db
      .select({
        id: users.id,
        name: users.name,
        reputationCredits: users.reputationCredits,
        contributorLevel: users.contributorLevel,
        totalResourcesApproved: users.totalResourcesApproved,
      })
      .from(users)
      .orderBy(desc(users.reputationCredits))
      .limit(10);

    return {
      usersByRole: usersByRole.reduce(
        (acc, row) => {
          acc[row.role] = row.count;
          return acc;
        },
        {} as Record<string, number>
      ),
      resourcesByStatus: resourcesByStatus.reduce(
        (acc, row) => {
          acc[row.status] = row.count;
          return acc;
        },
        {} as Record<string, number>
      ),
      moderation: {
        pendingResources: pendingResources?.count ?? 0,
        openFlags: openFlags?.count ?? 0,
      },
      growth: {
        newUsersThisWeek: newUsersThisWeek?.count ?? 0,
        newResourcesThisWeek: newResourcesThisWeek?.count ?? 0,
      },
      economy: {
        totalRcInCirculation: totalRc?.sum ?? 0,
      },
      topContributors,
    };
  }),

  // Resource analytics (for resource detail pages)
  resourceAnalytics: publicProcedure
    .input(z.object({ resourceId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [resource] = await db.select().from(resources).where(eq(resources.id, input.resourceId));
      if (!resource) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
      }

      // Views over time (last 30 days, grouped by day)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const viewsByDay = await db
        .select({
          date: sql<string>`DATE(${resourceViews.createdAt})`,
          count: sql<number>`count(*)`,
        })
        .from(resourceViews)
        .where(and(eq(resourceViews.resourceId, input.resourceId), gte(resourceViews.createdAt, thirtyDaysAgo)))
        .groupBy(sql`DATE(${resourceViews.createdAt})`)
        .orderBy(sql`DATE(${resourceViews.createdAt})`);

      const downloadsByDay = await db
        .select({
          date: sql<string>`DATE(${resourceDownloads.createdAt})`,
          count: sql<number>`count(*)`,
        })
        .from(resourceDownloads)
        .where(and(eq(resourceDownloads.resourceId, input.resourceId), gte(resourceDownloads.createdAt, thirtyDaysAgo)))
        .groupBy(sql`DATE(${resourceDownloads.createdAt})`)
        .orderBy(sql`DATE(${resourceDownloads.createdAt})`);

      return {
        totals: {
          views: resource.viewCount,
          downloads: resource.downloadCount,
          upvotes: resource.upvoteCount,
          downvotes: resource.downvoteCount,
          netVotes: resource.netVotes,
          comments: resource.commentCount,
        },
        viewsByDay,
        downloadsByDay,
      };
    }),

  // Subject/category breakdown (public)
  contentBreakdown: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const bySubject = await db
      .select({
        subject: resources.subject,
        count: sql<number>`count(*)`,
        totalViews: sql<number>`COALESCE(SUM(${resources.viewCount}), 0)`,
      })
      .from(resources)
      .where(eq(resources.status, "approved"))
      .groupBy(resources.subject)
      .orderBy(sql`count(*) DESC`);

    const byCategory = await db
      .select({
        category: resources.category,
        count: sql<number>`count(*)`,
        totalViews: sql<number>`COALESCE(SUM(${resources.viewCount}), 0)`,
      })
      .from(resources)
      .where(eq(resources.status, "approved"))
      .groupBy(resources.category)
      .orderBy(sql`count(*) DESC`);

    const byGradeLevel = await db
      .select({
        gradeLevel: resources.gradeLevel,
        count: sql<number>`count(*)`,
        totalViews: sql<number>`COALESCE(SUM(${resources.viewCount}), 0)`,
      })
      .from(resources)
      .where(eq(resources.status, "approved"))
      .groupBy(resources.gradeLevel)
      .orderBy(sql`count(*) DESC`);

    return {
      bySubject,
      byCategory,
      byGradeLevel,
    };
  }),

  // Trending resources (public)
  trending: publicProcedure
    .input(
      z.object({
        period: z.enum(["day", "week", "month"]).default("week"),
        limit: z.number().default(10),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const periodStart = new Date();
      switch (input.period) {
        case "day":
          periodStart.setDate(periodStart.getDate() - 1);
          break;
        case "week":
          periodStart.setDate(periodStart.getDate() - 7);
          break;
        case "month":
          periodStart.setMonth(periodStart.getMonth() - 1);
          break;
      }

      // Get resources with recent activity
      const trending = await db
        .select({
          resourceId: resourceViews.resourceId,
          viewCount: sql<number>`count(*)`,
        })
        .from(resourceViews)
        .where(gte(resourceViews.createdAt, periodStart))
        .groupBy(resourceViews.resourceId)
        .orderBy(sql`count(*) DESC`)
        .limit(input.limit);

      // Get resource details
      const resourceIds = trending.map((t) => t.resourceId);
      if (resourceIds.length === 0) return [];

      const resourceDetails = await db
        .select({
          id: resources.id,
          title: resources.title,
          summary: resources.summary,
          thumbnailUrl: resources.thumbnailUrl,
          subject: resources.subject,
          gradeLevel: resources.gradeLevel,
          netVotes: resources.netVotes,
          contributorName: users.name,
        })
        .from(resources)
        .leftJoin(users, eq(resources.contributorId, users.id))
        .where(sql`${resources.id} IN (${sql.join(resourceIds.map((id) => sql`${id}`), sql`, `)})`);

      // Combine with view counts
      return trending.map((t) => {
        const details = resourceDetails.find((r) => r.id === t.resourceId);
        return {
          ...details,
          recentViews: t.viewCount,
        };
      });
    }),

  // Governance metrics (public)
  governanceMetrics: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const [totalProposals] = await db.select({ count: sql<number>`count(*)` }).from(proposals);

    const proposalsByStatus = await db
      .select({
        status: proposals.status,
        count: sql<number>`count(*)`,
      })
      .from(proposals)
      .groupBy(proposals.status);

    const [totalVoters] = await db
      .select({ count: sql<number>`count(DISTINCT ${users.id})` })
      .from(users)
      .where(gte(users.reputationCredits, 10)); // Min RC to vote

    const [avgParticipation] = await db
      .select({
        avg: sql<number>`AVG(${proposals.votesFor} + ${proposals.votesAgainst} + ${proposals.votesAbstain})`,
      })
      .from(proposals)
      .where(sql`${proposals.status} IN ('accepted', 'rejected')`);

    return {
      totalProposals: totalProposals?.count ?? 0,
      proposalsByStatus: proposalsByStatus.reduce(
        (acc, row) => {
          acc[row.status] = row.count;
          return acc;
        },
        {} as Record<string, number>
      ),
      eligibleVoters: totalVoters?.count ?? 0,
      averageParticipation: Math.round(avgParticipation?.avg ?? 0),
    };
  }),
});

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  router,
  publicProcedure,
  protectedProcedure,
  moderatorProcedure,
  createMinRcProcedure,
} from "../_core/trpc";
import { getDb } from "../db";
import {
  resources,
  moderationFlags,
  users,
  rcTransactions,
} from "../../drizzle/schema";
import { RC_CONFIG, PAGINATION } from "@shared/const";

// Input schemas
const createFlagInput = z.object({
  targetType: z.enum(["resource", "comment", "collection"]),
  targetId: z.string(),
  reason: z.enum([
    "inappropriate_content",
    "copyright_violation",
    "inaccurate_information",
    "spam",
    "low_quality",
    "duplicate",
    "offensive_language",
    "other",
  ]),
  details: z.string().max(1000).optional(),
});

const reviewResourceInput = z.object({
  resourceId: z.string(),
  decision: z.enum(["approve", "reject"]),
  notes: z.string().max(1000).optional(),
});

const resolveFlagInput = z.object({
  flagId: z.string(),
  resolution: z.enum(["upheld", "dismissed"]),
  notes: z.string().max(1000).optional(),
});

// Helper: Award RC and log transaction
async function awardRc(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  userId: string,
  amount: number,
  reason: typeof rcTransactions.$inferInsert["reason"],
  referenceType?: string,
  referenceId?: string
) {
  const [user] = await db.select({ rc: users.reputationCredits }).from(users).where(eq(users.id, userId));
  const currentRc = user?.rc ?? 0;
  const newBalance = currentRc + amount;

  await db.update(users).set({ reputationCredits: newBalance, updatedAt: new Date() }).where(eq(users.id, userId));

  await db.insert(rcTransactions).values({
    id: nanoid(),
    userId,
    amount,
    reason,
    referenceType,
    referenceId,
    balanceAfter: newBalance,
  });

  return newBalance;
}

// Procedure requiring minimum RC to flag content
const flagProcedure = createMinRcProcedure(RC_CONFIG.MIN_RC_TO_FLAG);

export const moderationRouter = router({
  // Create a flag (requires minimum RC)
  createFlag: flagProcedure.input(createFlagInput).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    // Check if user has already flagged this item
    const [existingFlag] = await db
      .select()
      .from(moderationFlags)
      .where(
        and(
          eq(moderationFlags.targetType, input.targetType),
          eq(moderationFlags.targetId, input.targetId),
          eq(moderationFlags.reporterId, ctx.user.id)
        )
      );

    if (existingFlag) {
      throw new TRPCError({ code: "CONFLICT", message: "You have already flagged this content" });
    }

    const id = nanoid();

    await db.insert(moderationFlags).values({
      id,
      targetType: input.targetType,
      targetId: input.targetId,
      reporterId: ctx.user.id,
      reason: input.reason,
      details: input.details,
      status: "open",
    });

    // Award RC for submitting a flag
    await awardRc(db, ctx.user.id, RC_CONFIG.FLAG_SUBMITTED, "flag_submitted", "flag", id);

    return { id };
  }),

  // List pending resources for review (moderator+)
  listPendingResources: moderatorProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(PAGINATION.MAX_PAGE_SIZE).default(PAGINATION.DEFAULT_PAGE_SIZE),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const results = await db
        .select({
          id: resources.id,
          title: resources.title,
          description: resources.description,
          category: resources.category,
          subject: resources.subject,
          gradeLevel: resources.gradeLevel,
          resourceType: resources.resourceType,
          fileUrl: resources.fileUrl,
          externalUrl: resources.externalUrl,
          thumbnailUrl: resources.thumbnailUrl,
          createdAt: resources.createdAt,
          contributorId: resources.contributorId,
          contributorName: users.name,
          contributorRc: users.reputationCredits,
          contributorLevel: users.contributorLevel,
        })
        .from(resources)
        .leftJoin(users, eq(resources.contributorId, users.id))
        .where(eq(resources.status, "pending"))
        .orderBy(resources.createdAt)
        .limit(input.limit + 1);

      const hasMore = results.length > input.limit;
      const items = hasMore ? results.slice(0, -1) : results;

      return {
        items: items.map((item) => ({
          ...item,
          contributor: {
            id: item.contributorId,
            name: item.contributorName,
            reputationCredits: item.contributorRc,
            contributorLevel: item.contributorLevel,
          },
        })),
        nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
      };
    }),

  // Review a resource (moderator+)
  reviewResource: moderatorProcedure.input(reviewResourceInput).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const [resource] = await db.select().from(resources).where(eq(resources.id, input.resourceId));
    if (!resource) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
    }

    if (resource.status !== "pending") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Resource is not pending review" });
    }

    const newStatus = input.decision === "approve" ? "approved" : "rejected";
    const now = new Date();

    await db
      .update(resources)
      .set({
        status: newStatus,
        reviewedBy: ctx.user.id,
        reviewedAt: now,
        reviewNotes: input.notes,
        updatedAt: now,
        publishedAt: input.decision === "approve" ? now : null,
      })
      .where(eq(resources.id, input.resourceId));

    // Update contributor stats and award RC
    if (input.decision === "approve") {
      await db
        .update(users)
        .set({
          totalResourcesApproved: sql`${users.totalResourcesApproved} + 1`,
          updatedAt: now,
        })
        .where(eq(users.id, resource.contributorId));

      await awardRc(
        db,
        resource.contributorId,
        RC_CONFIG.RESOURCE_APPROVED,
        "resource_approved",
        "resource",
        input.resourceId
      );
    } else {
      await awardRc(
        db,
        resource.contributorId,
        -RC_CONFIG.RESOURCE_SUBMITTED, // Remove the submission bonus
        "resource_rejected",
        "resource",
        input.resourceId
      );
    }

    return { success: true, newStatus };
  }),

  // List flags (moderator+)
  listFlags: moderatorProcedure
    .input(
      z.object({
        status: z.enum(["open", "under_review", "resolved", "dismissed"]).optional(),
        targetType: z.enum(["resource", "comment", "collection"]).optional(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(PAGINATION.MAX_PAGE_SIZE).default(PAGINATION.DEFAULT_PAGE_SIZE),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const conditions = [];

      if (input.status) {
        conditions.push(eq(moderationFlags.status, input.status));
      }

      if (input.targetType) {
        conditions.push(eq(moderationFlags.targetType, input.targetType));
      }

      const results = await db
        .select({
          id: moderationFlags.id,
          targetType: moderationFlags.targetType,
          targetId: moderationFlags.targetId,
          reason: moderationFlags.reason,
          details: moderationFlags.details,
          status: moderationFlags.status,
          createdAt: moderationFlags.createdAt,
          resolvedAt: moderationFlags.resolvedAt,
          resolutionNotes: moderationFlags.resolutionNotes,
          reporterId: moderationFlags.reporterId,
          reporterName: users.name,
        })
        .from(moderationFlags)
        .leftJoin(users, eq(moderationFlags.reporterId, users.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(moderationFlags.createdAt))
        .limit(input.limit + 1);

      const hasMore = results.length > input.limit;
      const items = hasMore ? results.slice(0, -1) : results;

      return {
        items: items.map((item) => ({
          ...item,
          reporter: {
            id: item.reporterId,
            name: item.reporterName,
          },
        })),
        nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
      };
    }),

  // Get flag details (moderator+)
  getFlagById: moderatorProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const [flag] = await db
      .select({
        flag: moderationFlags,
        reporterName: users.name,
      })
      .from(moderationFlags)
      .leftJoin(users, eq(moderationFlags.reporterId, users.id))
      .where(eq(moderationFlags.id, input.id));

    if (!flag) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Flag not found" });
    }

    // Get target details based on type
    let targetDetails = null;
    if (flag.flag.targetType === "resource") {
      const [resource] = await db
        .select({
          id: resources.id,
          title: resources.title,
          status: resources.status,
          contributorId: resources.contributorId,
        })
        .from(resources)
        .where(eq(resources.id, flag.flag.targetId));
      targetDetails = resource;
    }

    return {
      ...flag.flag,
      reporter: {
        id: flag.flag.reporterId,
        name: flag.reporterName,
      },
      targetDetails,
    };
  }),

  // Claim flag for review (moderator+)
  claimFlag: moderatorProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const [flag] = await db.select().from(moderationFlags).where(eq(moderationFlags.id, input.id));
    if (!flag) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Flag not found" });
    }

    if (flag.status !== "open") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Flag is not open for review" });
    }

    await db
      .update(moderationFlags)
      .set({ status: "under_review" })
      .where(eq(moderationFlags.id, input.id));

    return { success: true };
  }),

  // Resolve flag (moderator+)
  resolveFlag: moderatorProcedure.input(resolveFlagInput).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const [flag] = await db.select().from(moderationFlags).where(eq(moderationFlags.id, input.flagId));
    if (!flag) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Flag not found" });
    }

    if (!["open", "under_review"].includes(flag.status)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Flag is already resolved" });
    }

    const newStatus = input.resolution === "upheld" ? "resolved" : "dismissed";
    const now = new Date();

    await db
      .update(moderationFlags)
      .set({
        status: newStatus,
        resolvedBy: ctx.user.id,
        resolvedAt: now,
        resolutionNotes: input.notes,
      })
      .where(eq(moderationFlags.id, input.flagId));

    // Award/deduct RC from reporter
    if (input.resolution === "upheld") {
      await awardRc(db, flag.reporterId, RC_CONFIG.FLAG_UPHELD, "flag_upheld", "flag", input.flagId);

      // If target is a resource, potentially take action
      if (flag.targetType === "resource") {
        const [resource] = await db.select().from(resources).where(eq(resources.id, flag.targetId));
        if (resource && resource.status === "approved") {
          // Archive the resource
          await db
            .update(resources)
            .set({ status: "archived", updatedAt: now })
            .where(eq(resources.id, flag.targetId));
        }
      }
    } else {
      await awardRc(db, flag.reporterId, RC_CONFIG.FLAG_DISMISSED, "flag_dismissed", "flag", input.flagId);
    }

    // Award RC to moderator for action
    await awardRc(db, ctx.user.id, RC_CONFIG.FLAG_SUBMITTED, "moderation_action", "flag", input.flagId);

    return { success: true, newStatus };
  }),

  // Get moderation stats (moderator+)
  getStats: moderatorProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const [pendingResources] = await db
      .select({ count: sql<number>`count(*)` })
      .from(resources)
      .where(eq(resources.status, "pending"));

    const [openFlags] = await db
      .select({ count: sql<number>`count(*)` })
      .from(moderationFlags)
      .where(eq(moderationFlags.status, "open"));

    const [underReviewFlags] = await db
      .select({ count: sql<number>`count(*)` })
      .from(moderationFlags)
      .where(eq(moderationFlags.status, "under_review"));

    const [resolvedToday] = await db
      .select({ count: sql<number>`count(*)` })
      .from(moderationFlags)
      .where(
        and(
          eq(moderationFlags.status, "resolved"),
          sql`${moderationFlags.resolvedAt} >= CURRENT_DATE`
        )
      );

    return {
      pendingResources: pendingResources?.count ?? 0,
      openFlags: openFlags?.count ?? 0,
      underReviewFlags: underReviewFlags?.count ?? 0,
      resolvedToday: resolvedToday?.count ?? 0,
    };
  }),

  // Bulk actions (moderator+)
  bulkReviewResources: moderatorProcedure
    .input(
      z.object({
        resourceIds: z.array(z.string()),
        decision: z.enum(["approve", "reject"]),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const now = new Date();
      const newStatus = input.decision === "approve" ? "approved" : "rejected";
      let processed = 0;

      for (const resourceId of input.resourceIds) {
        const [resource] = await db.select().from(resources).where(eq(resources.id, resourceId));
        if (!resource || resource.status !== "pending") continue;

        await db
          .update(resources)
          .set({
            status: newStatus,
            reviewedBy: ctx.user.id,
            reviewedAt: now,
            reviewNotes: input.notes,
            updatedAt: now,
            publishedAt: input.decision === "approve" ? now : null,
          })
          .where(eq(resources.id, resourceId));

        if (input.decision === "approve") {
          await db
            .update(users)
            .set({ totalResourcesApproved: sql`${users.totalResourcesApproved} + 1` })
            .where(eq(users.id, resource.contributorId));

          await awardRc(db, resource.contributorId, RC_CONFIG.RESOURCE_APPROVED, "resource_approved", "resource", resourceId);
        } else {
          await awardRc(db, resource.contributorId, -RC_CONFIG.RESOURCE_SUBMITTED, "resource_rejected", "resource", resourceId);
        }

        processed++;
      }

      return { success: true, processed };
    }),

  // Get flags for a specific target
  getFlagsForTarget: publicProcedure
    .input(z.object({ targetType: z.string(), targetId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [flagCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(moderationFlags)
        .where(
          and(
            eq(moderationFlags.targetType, input.targetType),
            eq(moderationFlags.targetId, input.targetId),
            eq(moderationFlags.status, "open")
          )
        );

      return { flagCount: flagCount?.count ?? 0 };
    }),
});

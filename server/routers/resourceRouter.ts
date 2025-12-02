import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, or, desc, asc, sql, ilike, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  router,
  publicProcedure,
  protectedProcedure,
  teacherProcedure,
} from "../_core/trpc";
import { getDb } from "../db";
import {
  resources,
  resourceVotes,
  resourceViews,
  resourceDownloads,
  resourceComments,
  users,
  rcTransactions,
  type Resource,
  type InsertResource,
} from "../../drizzle/schema";
import { RC_CONFIG, PAGINATION } from "@shared/const";

// Input schemas
const browseResourcesInput = z.object({
  search: z.string().optional(),
  subject: z.string().optional(),
  gradeLevel: z.string().optional(),
  category: z.string().optional(),
  resourceType: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["draft", "pending", "approved", "rejected", "archived"]).optional(),
  contributorId: z.string().optional(),
  sort: z.enum(["newest", "oldest", "popular", "highest_rated", "most_downloaded"]).default("newest"),
  cursor: z.string().optional(),
  limit: z.number().min(1).max(PAGINATION.MAX_PAGE_SIZE).default(PAGINATION.DEFAULT_PAGE_SIZE),
});

const createResourceInput = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  summary: z.string().max(500).optional(),
  category: z.enum([
    "lesson_plan",
    "worksheet",
    "assessment",
    "presentation",
    "video",
    "interactive",
    "reference",
    "template",
    "other",
  ]),
  resourceType: z.enum(["pdf", "doc", "ppt", "video", "image", "link", "html", "zip", "other"]),
  subject: z.enum([
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
  ]),
  gradeLevel: z.enum([
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
  ]),
  tags: z.array(z.string()).optional(),
  standards: z.array(z.string()).optional(),
  fileUrl: z.string().url().optional(),
  fileName: z.string().optional(),
  fileSize: z.number().optional(),
  thumbnailUrl: z.string().url().optional(),
  externalUrl: z.string().url().optional(),
});

const updateResourceInput = z.object({
  id: z.string(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  summary: z.string().max(500).optional(),
  category: z.enum([
    "lesson_plan",
    "worksheet",
    "assessment",
    "presentation",
    "video",
    "interactive",
    "reference",
    "template",
    "other",
  ]).optional(),
  resourceType: z.enum(["pdf", "doc", "ppt", "video", "image", "link", "html", "zip", "other"]).optional(),
  subject: z.enum([
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
  ]).optional(),
  gradeLevel: z.enum([
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
  ]).optional(),
  tags: z.array(z.string()).optional(),
  standards: z.array(z.string()).optional(),
  fileUrl: z.string().url().optional(),
  fileName: z.string().optional(),
  fileSize: z.number().optional(),
  thumbnailUrl: z.string().url().optional(),
  externalUrl: z.string().url().optional(),
});

const voteInput = z.object({
  resourceId: z.string(),
  value: z.enum(["up", "down", "remove"]),
});

const commentInput = z.object({
  resourceId: z.string(),
  content: z.string().min(1).max(2000),
  parentId: z.string().optional(),
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
  // Get current balance
  const [user] = await db.select({ rc: users.reputationCredits }).from(users).where(eq(users.id, userId));
  const currentRc = user?.rc ?? 0;
  const newBalance = currentRc + amount;

  // Update user RC
  await db.update(users).set({ reputationCredits: newBalance, updatedAt: new Date() }).where(eq(users.id, userId));

  // Log transaction
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

export const resourceRouter = router({
  // Browse resources (public)
  browse: publicProcedure.input(browseResourcesInput).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const conditions = [];

    // Default to approved resources for public browsing
    if (input.status) {
      conditions.push(eq(resources.status, input.status));
    } else {
      conditions.push(eq(resources.status, "approved"));
    }

    if (input.search) {
      conditions.push(
        or(
          ilike(resources.title, `%${input.search}%`),
          ilike(resources.description, `%${input.search}%`)
        )
      );
    }

    if (input.subject) {
      conditions.push(eq(resources.subject, input.subject as Resource["subject"]));
    }

    if (input.gradeLevel) {
      conditions.push(eq(resources.gradeLevel, input.gradeLevel as Resource["gradeLevel"]));
    }

    if (input.category) {
      conditions.push(eq(resources.category, input.category as Resource["category"]));
    }

    if (input.resourceType) {
      conditions.push(eq(resources.resourceType, input.resourceType as Resource["resourceType"]));
    }

    if (input.contributorId) {
      conditions.push(eq(resources.contributorId, input.contributorId));
    }

    // Sorting
    let orderBy;
    switch (input.sort) {
      case "oldest":
        orderBy = asc(resources.createdAt);
        break;
      case "popular":
        orderBy = desc(resources.viewCount);
        break;
      case "highest_rated":
        orderBy = desc(resources.netVotes);
        break;
      case "most_downloaded":
        orderBy = desc(resources.downloadCount);
        break;
      default:
        orderBy = desc(resources.createdAt);
    }

    const results = await db
      .select({
        id: resources.id,
        title: resources.title,
        summary: resources.summary,
        category: resources.category,
        resourceType: resources.resourceType,
        subject: resources.subject,
        gradeLevel: resources.gradeLevel,
        tags: resources.tags,
        thumbnailUrl: resources.thumbnailUrl,
        viewCount: resources.viewCount,
        downloadCount: resources.downloadCount,
        upvoteCount: resources.upvoteCount,
        downvoteCount: resources.downvoteCount,
        netVotes: resources.netVotes,
        commentCount: resources.commentCount,
        isFeatured: resources.isFeatured,
        isEditorPick: resources.isEditorPick,
        createdAt: resources.createdAt,
        contributorId: resources.contributorId,
        contributorName: users.name,
      })
      .from(resources)
      .leftJoin(users, eq(resources.contributorId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderBy)
      .limit(input.limit + 1);

    const hasMore = results.length > input.limit;
    const items = hasMore ? results.slice(0, -1) : results;

    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
    };
  }),

  // Get resource by ID (public)
  getById: publicProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const [resource] = await db
      .select({
        resource: resources,
        contributorName: users.name,
        contributorAvatar: users.avatarUrl,
      })
      .from(resources)
      .leftJoin(users, eq(resources.contributorId, users.id))
      .where(eq(resources.id, input.id));

    if (!resource) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
    }

    return {
      ...resource.resource,
      contributor: {
        id: resource.resource.contributorId,
        name: resource.contributorName,
        avatarUrl: resource.contributorAvatar,
      },
    };
  }),

  // Create resource (teacher+)
  create: teacherProcedure.input(createResourceInput).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const id = nanoid();
    const newResource: InsertResource = {
      id,
      ...input,
      contributorId: ctx.user.id,
      status: "pending",
      tags: input.tags ?? [],
      standards: input.standards ?? [],
    };

    await db.insert(resources).values(newResource);

    // Update user stats
    await db
      .update(users)
      .set({
        totalResourcesSubmitted: sql`${users.totalResourcesSubmitted} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, ctx.user.id));

    // Award RC for submission
    await awardRc(db, ctx.user.id, RC_CONFIG.RESOURCE_SUBMITTED, "resource_submitted", "resource", id);

    return { id, status: "pending" };
  }),

  // Update resource (owner or moderator)
  update: protectedProcedure.input(updateResourceInput).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const { id, ...updates } = input;

    // Fetch existing resource
    const [existing] = await db.select().from(resources).where(eq(resources.id, id));
    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
    }

    // Check permissions
    const isOwner = existing.contributorId === ctx.user.id;
    const isModerator = ["moderator", "admin"].includes(ctx.user.role);

    if (!isOwner && !isModerator) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to edit this resource" });
    }

    await db
      .update(resources)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(resources.id, id));

    return { success: true };
  }),

  // Submit for review (teacher+)
  submitForReview: teacherProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const [existing] = await db.select().from(resources).where(eq(resources.id, input.id));
    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
    }

    if (existing.contributorId !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You can only submit your own resources" });
    }

    if (existing.status !== "draft") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft resources can be submitted for review" });
    }

    await db
      .update(resources)
      .set({ status: "pending", updatedAt: new Date() })
      .where(eq(resources.id, input.id));

    return { success: true };
  }),

  // Track view (public)
  trackView: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    // Record the view
    await db.insert(resourceViews).values({
      id: nanoid(),
      resourceId: input.id,
      userId: ctx.user?.id ?? null,
    });

    // Increment view count
    await db
      .update(resources)
      .set({ viewCount: sql`${resources.viewCount} + 1` })
      .where(eq(resources.id, input.id));

    return { success: true };
  }),

  // Track download (public)
  trackDownload: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    // Get resource to find contributor
    const [resource] = await db.select().from(resources).where(eq(resources.id, input.id));
    if (!resource) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
    }

    // Record the download
    await db.insert(resourceDownloads).values({
      id: nanoid(),
      resourceId: input.id,
      userId: ctx.user?.id ?? null,
    });

    // Increment download count
    await db
      .update(resources)
      .set({ downloadCount: sql`${resources.downloadCount} + 1` })
      .where(eq(resources.id, input.id));

    // Update contributor stats
    await db
      .update(users)
      .set({
        totalDownloadsReceived: sql`${users.totalDownloadsReceived} + 1`,
      })
      .where(eq(users.id, resource.contributorId));

    // Award RC to resource owner
    await awardRc(
      db,
      resource.contributorId,
      RC_CONFIG.RESOURCE_DOWNLOAD,
      "resource_upvoted", // Using upvoted as closest match
      "resource",
      input.id
    );

    return { fileUrl: resource.fileUrl, externalUrl: resource.externalUrl };
  }),

  // Vote on resource (authenticated)
  vote: protectedProcedure.input(voteInput).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const [resource] = await db.select().from(resources).where(eq(resources.id, input.resourceId));
    if (!resource) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
    }

    // Prevent voting on own resources
    if (resource.contributorId === ctx.user.id) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot vote on your own resources" });
    }

    // Check existing vote
    const [existingVote] = await db
      .select()
      .from(resourceVotes)
      .where(and(eq(resourceVotes.resourceId, input.resourceId), eq(resourceVotes.userId, ctx.user.id)));

    if (input.value === "remove") {
      if (existingVote) {
        // Remove vote
        await db
          .delete(resourceVotes)
          .where(and(eq(resourceVotes.resourceId, input.resourceId), eq(resourceVotes.userId, ctx.user.id)));

        // Update resource counts
        if (existingVote.value > 0) {
          await db
            .update(resources)
            .set({
              upvoteCount: sql`${resources.upvoteCount} - 1`,
              netVotes: sql`${resources.netVotes} - 1`,
            })
            .where(eq(resources.id, input.resourceId));
        } else {
          await db
            .update(resources)
            .set({
              downvoteCount: sql`${resources.downvoteCount} - 1`,
              netVotes: sql`${resources.netVotes} + 1`,
            })
            .where(eq(resources.id, input.resourceId));
        }
      }
      return { success: true, vote: null };
    }

    const newValue = input.value === "up" ? 1 : -1;

    if (existingVote) {
      if (existingVote.value === newValue) {
        return { success: true, vote: newValue };
      }

      // Change vote
      await db
        .update(resourceVotes)
        .set({ value: newValue, updatedAt: new Date() })
        .where(eq(resourceVotes.id, existingVote.id));

      // Update counts (changing vote = +-2 net change)
      if (newValue > 0) {
        await db
          .update(resources)
          .set({
            upvoteCount: sql`${resources.upvoteCount} + 1`,
            downvoteCount: sql`${resources.downvoteCount} - 1`,
            netVotes: sql`${resources.netVotes} + 2`,
          })
          .where(eq(resources.id, input.resourceId));

        // Award/deduct RC
        await awardRc(
          db,
          resource.contributorId,
          RC_CONFIG.RESOURCE_UPVOTE_RECEIVED - RC_CONFIG.RESOURCE_DOWNVOTE_RECEIVED,
          "resource_upvoted",
          "resource",
          input.resourceId
        );
      } else {
        await db
          .update(resources)
          .set({
            upvoteCount: sql`${resources.upvoteCount} - 1`,
            downvoteCount: sql`${resources.downvoteCount} + 1`,
            netVotes: sql`${resources.netVotes} - 2`,
          })
          .where(eq(resources.id, input.resourceId));

        await awardRc(
          db,
          resource.contributorId,
          RC_CONFIG.RESOURCE_DOWNVOTE_RECEIVED - RC_CONFIG.RESOURCE_UPVOTE_RECEIVED,
          "resource_downvoted",
          "resource",
          input.resourceId
        );
      }
    } else {
      // New vote
      await db.insert(resourceVotes).values({
        id: nanoid(),
        resourceId: input.resourceId,
        userId: ctx.user.id,
        value: newValue,
      });

      if (newValue > 0) {
        await db
          .update(resources)
          .set({
            upvoteCount: sql`${resources.upvoteCount} + 1`,
            netVotes: sql`${resources.netVotes} + 1`,
          })
          .where(eq(resources.id, input.resourceId));

        // Update contributor stats
        await db
          .update(users)
          .set({ totalUpvotesReceived: sql`${users.totalUpvotesReceived} + 1` })
          .where(eq(users.id, resource.contributorId));

        await awardRc(db, resource.contributorId, RC_CONFIG.RESOURCE_UPVOTE_RECEIVED, "resource_upvoted", "resource", input.resourceId);
      } else {
        await db
          .update(resources)
          .set({
            downvoteCount: sql`${resources.downvoteCount} + 1`,
            netVotes: sql`${resources.netVotes} - 1`,
          })
          .where(eq(resources.id, input.resourceId));

        await awardRc(db, resource.contributorId, RC_CONFIG.RESOURCE_DOWNVOTE_RECEIVED, "resource_downvoted", "resource", input.resourceId);
      }
    }

    return { success: true, vote: newValue };
  }),

  // Get user's vote on a resource
  getUserVote: protectedProcedure.input(z.object({ resourceId: z.string() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const [vote] = await db
      .select()
      .from(resourceVotes)
      .where(and(eq(resourceVotes.resourceId, input.resourceId), eq(resourceVotes.userId, ctx.user.id)));

    return vote?.value ?? null;
  }),

  // Get comments for a resource
  getComments: publicProcedure.input(z.object({ resourceId: z.string() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const comments = await db
      .select({
        id: resourceComments.id,
        content: resourceComments.content,
        parentId: resourceComments.parentId,
        isEdited: resourceComments.isEdited,
        createdAt: resourceComments.createdAt,
        userId: resourceComments.userId,
        userName: users.name,
        userAvatar: users.avatarUrl,
      })
      .from(resourceComments)
      .leftJoin(users, eq(resourceComments.userId, users.id))
      .where(eq(resourceComments.resourceId, input.resourceId))
      .orderBy(asc(resourceComments.createdAt));

    return comments;
  }),

  // Add comment (authenticated)
  addComment: protectedProcedure.input(commentInput).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const id = nanoid();

    await db.insert(resourceComments).values({
      id,
      resourceId: input.resourceId,
      userId: ctx.user.id,
      content: input.content,
      parentId: input.parentId,
    });

    // Update comment count
    await db
      .update(resources)
      .set({ commentCount: sql`${resources.commentCount} + 1` })
      .where(eq(resources.id, input.resourceId));

    return { id };
  }),

  // List related resources
  listRelated: publicProcedure.input(z.object({ resourceId: z.string(), limit: z.number().default(5) })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    // Get the source resource
    const [source] = await db.select().from(resources).where(eq(resources.id, input.resourceId));
    if (!source) {
      return [];
    }

    // Find related by subject and grade level
    const related = await db
      .select({
        id: resources.id,
        title: resources.title,
        summary: resources.summary,
        thumbnailUrl: resources.thumbnailUrl,
        subject: resources.subject,
        gradeLevel: resources.gradeLevel,
        netVotes: resources.netVotes,
      })
      .from(resources)
      .where(
        and(
          eq(resources.status, "approved"),
          sql`${resources.id} != ${input.resourceId}`,
          or(eq(resources.subject, source.subject), eq(resources.gradeLevel, source.gradeLevel))
        )
      )
      .orderBy(desc(resources.netVotes))
      .limit(input.limit);

    return related;
  }),

  // Get featured resources
  getFeatured: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const featured = await db
      .select({
        id: resources.id,
        title: resources.title,
        summary: resources.summary,
        thumbnailUrl: resources.thumbnailUrl,
        category: resources.category,
        subject: resources.subject,
        gradeLevel: resources.gradeLevel,
        netVotes: resources.netVotes,
        viewCount: resources.viewCount,
      })
      .from(resources)
      .where(and(eq(resources.status, "approved"), eq(resources.isFeatured, true)))
      .orderBy(desc(resources.netVotes))
      .limit(10);

    return featured;
  }),

  // Get editor picks
  getEditorPicks: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const picks = await db
      .select({
        id: resources.id,
        title: resources.title,
        summary: resources.summary,
        thumbnailUrl: resources.thumbnailUrl,
        category: resources.category,
        subject: resources.subject,
        gradeLevel: resources.gradeLevel,
        netVotes: resources.netVotes,
      })
      .from(resources)
      .where(and(eq(resources.status, "approved"), eq(resources.isEditorPick, true)))
      .orderBy(desc(resources.createdAt))
      .limit(10);

    return picks;
  }),

  /**
   * GET MY RESOURCES (Protected)
   * Fetches all resources uploaded by the logged-in user, regardless of status.
   * Required for the Dashboard to show pending/rejected items.
   */
  getMyResources: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    return await db
      .select({
        id: resources.id,
        title: resources.title,
        summary: resources.summary,
        category: resources.category,
        resourceType: resources.resourceType,
        subject: resources.subject,
        gradeLevel: resources.gradeLevel,
        status: resources.status,
        viewCount: resources.viewCount,
        downloadCount: resources.downloadCount,
        upvoteCount: resources.upvoteCount,
        downvoteCount: resources.downvoteCount,
        netVotes: resources.netVotes,
        createdAt: resources.createdAt,
      })
      .from(resources)
      .where(eq(resources.contributorId, ctx.user.id))
      .orderBy(desc(resources.createdAt));
  }),
});

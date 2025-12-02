import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../_core/trpc';
import { resources, users, resourceVotes, rcTransactions } from '../../drizzle/schema';
import { eq, desc, and, like, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { getDb } from '../db';

export const resourcesRouter = router({
  /**
   * GET ALL RESOURCES (Public)
   * Powers the main /browse grid.
   * Includes search, filtering by category/grade, and sorting.
   */
  getAll: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.number().nullish(), // For infinite scrolling
        search: z.string().optional(),
        category: z.string().optional(),
        gradeLevel: z.string().optional(),
        sortBy: z.enum(['newest', 'popular', 'highest_rated']).default('newest'),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
      }

      // Dynamic Where Clause Construction
      const whereConditions = [];

      // Only show approved resources
      whereConditions.push(eq(resources.status, 'approved'));

      if (input.search) {
        // PostgreSQL ILIKE for case-insensitive search
        whereConditions.push(like(resources.title, `%${input.search}%`));
      }
      if (input.category && input.category !== 'All') {
        whereConditions.push(eq(resources.category, input.category));
      }
      if (input.gradeLevel && input.gradeLevel !== 'All') {
        whereConditions.push(eq(resources.gradeLevel, input.gradeLevel));
      }

      // Cursor-based pagination
      if (input.cursor) {
        whereConditions.push(sql`${resources.id} < ${input.cursor}`);
      }

      // Dynamic Sorting
      let orderBy;
      switch (input.sortBy) {
        case 'popular':
          orderBy = desc(resources.views);
          break;
        case 'highest_rated':
          orderBy = desc(resources.upvotes); // Simplified; ideally uses a weighted score
          break;
        case 'newest':
        default:
          orderBy = desc(resources.createdAt);
      }

      const items = await db.select({
        id: resources.id,
        title: resources.title,
        description: resources.description,
        category: resources.category,
        gradeLevel: resources.gradeLevel,
        resourceType: resources.resourceType,
        thumbnailUrl: resources.thumbnailUrl,
        upvotes: resources.upvotes,
        downvotes: resources.downvotes,
        views: resources.views,
        createdAt: resources.createdAt,
        contributor: {
          id: users.id,
          name: users.name,
          level: users.contributorLevel,
        }
      })
        .from(resources)
        .leftJoin(users, eq(resources.contributorId, users.id))
        .where(and(...whereConditions))
        .limit(input.limit + 1) // Fetch one extra to determine if there's a next page
        .orderBy(orderBy);

      let nextCursor: typeof input.cursor | undefined = undefined;
      if (items.length > input.limit) {
        const nextItem = items.pop();
        nextCursor = nextItem!.id;
      }

      return {
        items,
        nextCursor,
      };
    }),

  /**
   * GET SINGLE RESOURCE (Public)
   * Fetches full details + increments view count side-effect.
   */
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
      }

      const resource = await db.query.resources.findFirst({
        where: eq(resources.id, input.id),
        with: {
          contributor: true,
        }
      });

      if (!resource) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Resource not found' });
      }

      // Side Effect: Increment View Count (Fire and Forget)
      // In a high-scale environment, this would go to a Redis queue.
      db.update(resources)
        .set({ views: sql`${resources.views} + 1` })
        .where(eq(resources.id, input.id))
        .execute()
        .catch(err => console.error('[Resources] Failed to increment view count:', err));

      return resource;
    }),

  /**
   * GET USER'S VOTE STATUS (Protected)
   * Returns the user's current vote on a resource for UI state
   */
  getUserVote: protectedProcedure
    .input(z.object({ resourceId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
      }

      const vote = await db.select()
        .from(resourceVotes)
        .where(and(
          eq(resourceVotes.userId, ctx.user.id),
          eq(resourceVotes.resourceId, input.resourceId)
        ))
        .limit(1);

      return vote.length > 0 ? { voteType: vote[0].voteType } : null;
    }),

  /**
   * VOTE ON RESOURCE (Protected)
   * Handles the logic for Upvoting/Downvoting and preventing duplicates.
   * Also triggers the Reputation Engine (Transaction).
   * Returns updated state immediately for Optimistic UI.
   */
  vote: protectedProcedure
    .input(z.object({
      resourceId: z.number(),
      voteType: z.enum(['up', 'down']),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
      }

      const voteVal = input.voteType === 'up' ? 1 : -1;

      // 1. Check if user already voted
      const existingVotes = await db.select()
        .from(resourceVotes)
        .where(and(
          eq(resourceVotes.userId, ctx.user.id),
          eq(resourceVotes.resourceId, input.resourceId)
        ))
        .limit(1);

      const existingVote = existingVotes[0];

      if (existingVote) {
        if (existingVote.voteType === voteVal) {
          // Toggle off (remove vote)
          await db.delete(resourceVotes)
            .where(and(
              eq(resourceVotes.userId, ctx.user.id),
              eq(resourceVotes.resourceId, input.resourceId)
            ));

          // Revert resource count
          await db.update(resources)
            .set({
              upvotes: input.voteType === 'up' ? sql`${resources.upvotes} - 1` : resources.upvotes,
              downvotes: input.voteType === 'down' ? sql`${resources.downvotes} - 1` : resources.downvotes
            })
            .where(eq(resources.id, input.resourceId));

          // Get updated counts for optimistic UI
          const updated = await db.select({
            upvotes: resources.upvotes,
            downvotes: resources.downvotes
          })
            .from(resources)
            .where(eq(resources.id, input.resourceId))
            .limit(1);

          return {
            status: 'removed' as const,
            upvotes: updated[0]?.upvotes ?? 0,
            downvotes: updated[0]?.downvotes ?? 0,
            userVote: null
          };
        }

        // Changing vote (up to down or vice versa)
        // For MVP/Equilibrium, block this scenario
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'You have already voted on this resource. Remove your vote first to change it.'
        });
      }

      // 2. Insert new vote
      await db.insert(resourceVotes).values({
        userId: ctx.user.id,
        resourceId: input.resourceId,
        voteType: voteVal,
      });

      // 3. Update Resource Counts
      await db.update(resources)
        .set({
          upvotes: input.voteType === 'up' ? sql`${resources.upvotes} + 1` : resources.upvotes,
          downvotes: input.voteType === 'down' ? sql`${resources.downvotes} + 1` : resources.downvotes
        })
        .where(eq(resources.id, input.resourceId));

      // 4. REPUTATION TRANSACTION (The "Moral Engine")
      // Only award RC for Upvotes
      if (input.voteType === 'up') {
        const resourceData = await db.select()
          .from(resources)
          .where(eq(resources.id, input.resourceId))
          .limit(1);

        if (resourceData[0]) {
          await db.insert(rcTransactions).values({
            userId: resourceData[0].contributorId, // Credit the AUTHOR
            amount: 5, // 5 RC for an upvote
            type: 'upvote_received',
            referenceId: input.resourceId,
            description: `Received upvote on resource: ${resourceData[0].title}`,
          });

          // Update User Total
          await db.update(users)
            .set({ reputationCredits: sql`${users.reputationCredits} + 5` })
            .where(eq(users.id, resourceData[0].contributorId));
        }
      }

      // Get updated counts for optimistic UI
      const updated = await db.select({
        upvotes: resources.upvotes,
        downvotes: resources.downvotes
      })
        .from(resources)
        .where(eq(resources.id, input.resourceId))
        .limit(1);

      return {
        status: 'success' as const,
        upvotes: updated[0]?.upvotes ?? 0,
        downvotes: updated[0]?.downvotes ?? 0,
        userVote: voteVal
      };
    }),

  /**
   * CREATE RESOURCE (Protected - Teacher Only)
   */
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(5, 'Title must be at least 5 characters'),
      description: z.string().min(20, 'Description must be at least 20 characters'),
      category: z.string().min(1, 'Category is required'),
      gradeLevel: z.string().min(1, 'Grade level is required'),
      resourceType: z.string().min(1, 'Resource type is required'),
      thumbnailUrl: z.string().url().optional(),
      files: z.array(z.object({
        url: z.string().url(),
        name: z.string(),
        size: z.number(),
        type: z.string()
      })).min(1, 'At least one file is required'),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
      }

      // Role Guard
      if (ctx.user.role !== 'teacher' && ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only Verified Teachers can contribute resources.'
        });
      }

      const result = await db.insert(resources).values({
        contributorId: ctx.user.id,
        title: input.title,
        description: input.description,
        category: input.category,
        gradeLevel: input.gradeLevel,
        resourceType: input.resourceType,
        thumbnailUrl: input.thumbnailUrl ?? null,
        files: input.files,
        status: 'pending', // Always pending by default for moderation
      }).returning();

      // Award RC for submission
      await db.insert(rcTransactions).values({
        userId: ctx.user.id,
        amount: 10,
        type: 'resource_submitted',
        referenceId: result[0].id,
        description: `Submitted resource: ${input.title}`,
      });

      await db.update(users)
        .set({ reputationCredits: sql`${users.reputationCredits} + 10` })
        .where(eq(users.id, ctx.user.id));

      return { resource: result[0], rcEarned: 10 };
    }),

  /**
   * GET USER'S CONTRIBUTED RESOURCES (Protected)
   * For the user's profile/dashboard
   */
  getMyResources: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(10),
      cursor: z.number().nullish(),
      status: z.enum(['pending', 'approved', 'rejected']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
      }

      const whereConditions = [eq(resources.contributorId, ctx.user.id)];

      if (input.status) {
        whereConditions.push(eq(resources.status, input.status));
      }

      if (input.cursor) {
        whereConditions.push(sql`${resources.id} < ${input.cursor}`);
      }

      const items = await db.select()
        .from(resources)
        .where(and(...whereConditions))
        .orderBy(desc(resources.createdAt))
        .limit(input.limit + 1);

      let nextCursor: typeof input.cursor | undefined = undefined;
      if (items.length > input.limit) {
        const nextItem = items.pop();
        nextCursor = nextItem!.id;
      }

      return { items, nextCursor };
    }),
});

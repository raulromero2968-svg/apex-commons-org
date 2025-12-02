import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../_core/trpc';
import { resources, resourceVotes, users, rcTransactions } from '../../drizzle/schema';
import { eq, desc, and, sql, asc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { getDb } from '../db';

// RC rewards for resource actions
const RC_REWARDS = {
  SUBMIT: 10,
  APPROVED: 50,
  UPVOTE_RECEIVED: 5,
};

export const resourcesRouter = router({
  /**
   * GET ALL RESOURCES (Public)
   * Browse approved resources with filtering and sorting.
   */
  getAll: publicProcedure
    .input(z.object({
      category: z.enum(['tutorial', 'tool', 'library', 'article', 'video', 'course', 'template', 'other', 'all']).default('all'),
      sortBy: z.enum(['newest', 'popular', 'title']).default('newest'),
      limit: z.number().min(1).max(50).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      // Determine sort order
      const orderByClause = input.sortBy === 'newest'
        ? desc(resources.createdAt)
        : input.sortBy === 'popular'
          ? desc(resources.upvotes)
          : asc(resources.title);

      return await db.select({
        id: resources.id,
        title: resources.title,
        description: resources.description,
        url: resources.url,
        category: resources.category,
        tags: resources.tags,
        upvotes: resources.upvotes,
        downvotes: resources.downvotes,
        createdAt: resources.createdAt,
        submitterName: users.name,
      })
        .from(resources)
        .leftJoin(users, eq(resources.submitterId, users.id))
        .where(eq(resources.status, 'approved'))
        .orderBy(orderByClause)
        .limit(input.limit)
        .offset(input.offset);
    }),

  /**
   * GET SINGLE RESOURCE (Public)
   */
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      const result = await db.select({
        id: resources.id,
        title: resources.title,
        description: resources.description,
        url: resources.url,
        category: resources.category,
        tags: resources.tags,
        upvotes: resources.upvotes,
        downvotes: resources.downvotes,
        status: resources.status,
        createdAt: resources.createdAt,
        approvedAt: resources.approvedAt,
        submitterName: users.name,
        submitterId: resources.submitterId,
      })
        .from(resources)
        .leftJoin(users, eq(resources.submitterId, users.id))
        .where(eq(resources.id, input.id))
        .limit(1);

      if (result.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Resource not found' });
      }

      return result[0];
    }),

  /**
   * SUBMIT RESOURCE (Protected)
   * Users earn RC for submissions. Resources start as pending.
   */
  submit: protectedProcedure
    .input(z.object({
      title: z.string().min(5).max(200),
      description: z.string().min(20).max(2000),
      url: z.string().url().max(2048),
      category: z.enum(['tutorial', 'tool', 'library', 'article', 'video', 'course', 'template', 'other']),
      tags: z.array(z.string().max(30)).max(5).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      const user = ctx.user;

      // Insert the resource
      const result = await db.insert(resources).values({
        title: input.title,
        description: input.description,
        url: input.url,
        category: input.category,
        tags: input.tags ? JSON.stringify(input.tags) : null,
        submitterId: user.id,
        status: 'pending',
      }).returning();

      // Award RC for submission
      await db.update(users)
        .set({ reputationCredits: sql`${users.reputationCredits} + ${RC_REWARDS.SUBMIT}` })
        .where(eq(users.id, user.id));

      await db.insert(rcTransactions).values({
        userId: user.id,
        amount: RC_REWARDS.SUBMIT,
        type: 'resource_submitted',
        referenceId: String(result[0].id),
        description: `Submitted resource: ${input.title}`,
      });

      return { resource: result[0], rcEarned: RC_REWARDS.SUBMIT };
    }),

  /**
   * VOTE ON RESOURCE (Protected)
   * Upvote or downvote a resource. Changes are tracked.
   */
  vote: protectedProcedure
    .input(z.object({
      resourceId: z.number(),
      vote: z.enum(['up', 'down']),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      const user = ctx.user;
      const voteValue = input.vote === 'up' ? 1 : -1;

      // Check existing vote
      const existing = await db.select()
        .from(resourceVotes)
        .where(and(
          eq(resourceVotes.resourceId, input.resourceId),
          eq(resourceVotes.userId, user.id)
        ))
        .limit(1);

      if (existing.length > 0) {
        const existingVote = existing[0];

        if (existingVote.vote === voteValue) {
          throw new TRPCError({ code: 'CONFLICT', message: 'You have already cast this vote' });
        }

        // Change vote - update counts accordingly
        await db.update(resourceVotes)
          .set({ vote: voteValue })
          .where(eq(resourceVotes.id, existingVote.id));

        // Adjust both counters
        if (voteValue === 1) {
          await db.update(resources)
            .set({
              upvotes: sql`${resources.upvotes} + 1`,
              downvotes: sql`${resources.downvotes} - 1`,
            })
            .where(eq(resources.id, input.resourceId));
        } else {
          await db.update(resources)
            .set({
              upvotes: sql`${resources.upvotes} - 1`,
              downvotes: sql`${resources.downvotes} + 1`,
            })
            .where(eq(resources.id, input.resourceId));
        }

        return { changed: true, newVote: input.vote };
      }

      // New vote
      await db.insert(resourceVotes).values({
        resourceId: input.resourceId,
        userId: user.id,
        vote: voteValue,
      });

      // Update resource counts
      if (voteValue === 1) {
        await db.update(resources)
          .set({ upvotes: sql`${resources.upvotes} + 1` })
          .where(eq(resources.id, input.resourceId));

        // Award RC to resource submitter for upvote
        const resource = await db.select({ submitterId: resources.submitterId, title: resources.title })
          .from(resources)
          .where(eq(resources.id, input.resourceId))
          .limit(1);

        if (resource.length > 0 && resource[0].submitterId !== user.id) {
          await db.update(users)
            .set({ reputationCredits: sql`${users.reputationCredits} + ${RC_REWARDS.UPVOTE_RECEIVED}` })
            .where(eq(users.id, resource[0].submitterId));

          await db.insert(rcTransactions).values({
            userId: resource[0].submitterId,
            amount: RC_REWARDS.UPVOTE_RECEIVED,
            type: 'resource_upvoted',
            referenceId: String(input.resourceId),
            description: `Your resource "${resource[0].title}" received an upvote`,
          });
        }
      } else {
        await db.update(resources)
          .set({ downvotes: sql`${resources.downvotes} + 1` })
          .where(eq(resources.id, input.resourceId));
      }

      return { changed: false, newVote: input.vote };
    }),

  /**
   * GET MY SUBMISSIONS (Protected)
   * View user's own submitted resources.
   */
  getMySubmissions: protectedProcedure
    .input(z.object({
      status: z.enum(['pending', 'approved', 'rejected', 'all']).default('all'),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      let query = db.select()
        .from(resources)
        .where(eq(resources.submitterId, ctx.user.id))
        .orderBy(desc(resources.createdAt));

      return await query;
    }),

  /**
   * GET USER'S VOTE ON RESOURCE (Protected)
   * Check if user has voted on a specific resource.
   */
  getMyVote: protectedProcedure
    .input(z.object({ resourceId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      const result = await db.select()
        .from(resourceVotes)
        .where(and(
          eq(resourceVotes.resourceId, input.resourceId),
          eq(resourceVotes.userId, ctx.user.id)
        ))
        .limit(1);

      if (result.length === 0) {
        return { hasVoted: false, vote: null };
      }

      return { hasVoted: true, vote: result[0].vote === 1 ? 'up' : 'down' };
    }),
});

import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../_core/trpc';
import { proposals, proposalVotes, users, rcTransactions } from '../../drizzle/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { getDb } from '../db';

// Cost to create a proposal (RC threshold to prevent spam)
const PROPOSAL_COST = 500;

export const governanceRouter = router({
  /**
   * GET ALL PROPOSALS (Public)
   * List proposals with optional status filter.
   */
  getAll: publicProcedure
    .input(z.object({
      filter: z.enum(['active', 'passed', 'rejected', 'expired', 'all']).default('active'),
      limit: z.number().min(1).max(50).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      const baseSelect = db.select({
        id: proposals.id,
        title: proposals.title,
        content: proposals.content,
        status: proposals.status,
        yesVotes: proposals.yesVotes,
        noVotes: proposals.noVotes,
        abstainVotes: proposals.abstainVotes,
        startDate: proposals.startDate,
        endDate: proposals.endDate,
        authorName: users.name,
        authorId: proposals.authorId,
      })
        .from(proposals)
        .leftJoin(users, eq(proposals.authorId, users.id));

      // Build query with optional filter
      if (input.filter !== 'all') {
        return await baseSelect
          .where(eq(proposals.status, input.filter))
          .orderBy(desc(proposals.startDate))
          .limit(input.limit)
          .offset(input.offset);
      }

      return await baseSelect
        .orderBy(desc(proposals.startDate))
        .limit(input.limit)
        .offset(input.offset);
    }),

  /**
   * GET SINGLE PROPOSAL (Public)
   */
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      const result = await db.select({
        id: proposals.id,
        title: proposals.title,
        content: proposals.content,
        status: proposals.status,
        yesVotes: proposals.yesVotes,
        noVotes: proposals.noVotes,
        abstainVotes: proposals.abstainVotes,
        startDate: proposals.startDate,
        endDate: proposals.endDate,
        authorName: users.name,
        authorId: proposals.authorId,
      })
        .from(proposals)
        .leftJoin(users, eq(proposals.authorId, users.id))
        .where(eq(proposals.id, input.id))
        .limit(1);

      if (result.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' });
      }

      return result[0];
    }),

  /**
   * CREATE PROPOSAL (Protected)
   * Requires 500 RC. Deducts cost automatically.
   * Only invested community members can create proposals.
   */
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(10).max(100),
      content: z.string().min(50).max(5000),
      durationDays: z.number().min(3).max(14).default(7),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      const user = ctx.user;

      // 1. Check Balance
      const userData = await db.select()
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);

      if (userData.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      if (userData[0].reputationCredits < PROPOSAL_COST) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `Insufficient Reputation Credits. You need ${PROPOSAL_COST} RC to submit a proposal. Current balance: ${userData[0].reputationCredits} RC.`,
        });
      }

      // 2. Deduct RC
      await db.update(users)
        .set({ reputationCredits: sql`${users.reputationCredits} - ${PROPOSAL_COST}` })
        .where(eq(users.id, user.id));

      await db.insert(rcTransactions).values({
        userId: user.id,
        amount: -PROPOSAL_COST,
        type: 'proposal_created',
        description: `Created proposal: ${input.title}`,
      });

      // 3. Create Proposal
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + input.durationDays);

      const result = await db.insert(proposals).values({
        authorId: user.id,
        title: input.title,
        content: input.content,
        endDate: endDate,
        status: 'active',
      }).returning();

      // Update transaction with reference ID
      await db.update(rcTransactions)
        .set({ referenceId: result[0].id })
        .where(and(
          eq(rcTransactions.userId, user.id),
          eq(rcTransactions.type, 'proposal_created'),
          sql`${rcTransactions.referenceId} IS NULL`
        ));

      return {
        proposal: result[0],
        rcDeducted: PROPOSAL_COST,
        message: 'Proposal created successfully. Voting is now open!',
      };
    }),

  /**
   * VOTE ON PROPOSAL (Protected)
   * Cast a vote on an active proposal.
   */
  vote: protectedProcedure
    .input(z.object({
      proposalId: z.number(),
      vote: z.enum(['yes', 'no', 'abstain']),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      const user = ctx.user;

      // Check if proposal exists and is active
      const proposal = await db.select()
        .from(proposals)
        .where(eq(proposals.id, input.proposalId))
        .limit(1);

      if (proposal.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' });
      }

      if (proposal[0].status !== 'active') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'This proposal is no longer accepting votes' });
      }

      // Check if voting period has ended
      if (new Date() > new Date(proposal[0].endDate)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Voting period has ended for this proposal' });
      }

      // Check existing vote
      const existing = await db.select()
        .from(proposalVotes)
        .where(and(
          eq(proposalVotes.proposalId, input.proposalId),
          eq(proposalVotes.userId, user.id)
        ))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({ code: 'CONFLICT', message: 'You have already voted on this proposal' });
      }

      // Cast Vote
      await db.insert(proposalVotes).values({
        proposalId: input.proposalId,
        userId: user.id,
        vote: input.vote,
      });

      // Update Vote Counts
      const updateData: Record<string, unknown> = {};
      if (input.vote === 'yes') {
        updateData.yesVotes = sql`${proposals.yesVotes} + 1`;
      } else if (input.vote === 'no') {
        updateData.noVotes = sql`${proposals.noVotes} + 1`;
      } else {
        updateData.abstainVotes = sql`${proposals.abstainVotes} + 1`;
      }

      await db.update(proposals)
        .set(updateData)
        .where(eq(proposals.id, input.proposalId));

      // Record vote transaction
      await db.insert(rcTransactions).values({
        userId: user.id,
        amount: 0,
        type: 'vote_cast',
        referenceId: input.proposalId,
        description: `Voted "${input.vote}" on proposal: ${proposal[0].title}`,
      });

      return { success: true, vote: input.vote };
    }),

  /**
   * GET MY VOTE (Protected)
   * Check if user has voted on a specific proposal.
   */
  getMyVote: protectedProcedure
    .input(z.object({ proposalId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      const result = await db.select()
        .from(proposalVotes)
        .where(and(
          eq(proposalVotes.proposalId, input.proposalId),
          eq(proposalVotes.userId, ctx.user.id)
        ))
        .limit(1);

      if (result.length === 0) {
        return { hasVoted: false, vote: null };
      }

      return { hasVoted: true, vote: result[0].vote };
    }),

  /**
   * GET PROPOSAL COST (Public)
   * Returns the RC cost to create a proposal.
   */
  getProposalCost: publicProcedure
    .query(() => {
      return { cost: PROPOSAL_COST };
    }),

  /**
   * CHECK PROPOSAL STATUS (Utility)
   * Finalize expired proposals based on votes.
   * This could be called by a cron job or admin.
   */
  finalizeExpired: protectedProcedure
    .mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      // Only allow admins to finalize
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can finalize proposals' });
      }

      const now = new Date();

      // Get all active proposals past their end date
      const expiredProposals = await db.select()
        .from(proposals)
        .where(and(
          eq(proposals.status, 'active'),
          sql`${proposals.endDate} < ${now}`
        ));

      const results = [];

      for (const proposal of expiredProposals) {
        let newStatus: 'passed' | 'rejected' | 'expired';

        const totalVotes = proposal.yesVotes + proposal.noVotes;

        if (totalVotes === 0) {
          newStatus = 'expired';
        } else if (proposal.yesVotes > proposal.noVotes) {
          newStatus = 'passed';
        } else {
          newStatus = 'rejected';
        }

        await db.update(proposals)
          .set({ status: newStatus })
          .where(eq(proposals.id, proposal.id));

        results.push({ id: proposal.id, title: proposal.title, newStatus });
      }

      return { finalized: results.length, proposals: results };
    }),
});

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, asc, sql, lte, gte } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  router,
  publicProcedure,
  protectedProcedure,
  createMinRcProcedure,
  adminProcedure,
} from "../_core/trpc";
import { getDb } from "../db";
import {
  proposals,
  proposalVotes,
  users,
  rcTransactions,
} from "../../drizzle/schema";
import { RC_CONFIG, PAGINATION } from "@shared/const";

// Input schemas
const createProposalInput = z.object({
  title: z.string().min(5).max(150),
  summary: z.string().min(20).max(500),
  body: z.string().min(100).max(10000),
  tags: z.array(z.string()).optional(),
  votingDurationDays: z.number().min(3).max(30).default(7),
});

const updateProposalInput = z.object({
  id: z.string(),
  title: z.string().min(5).max(150).optional(),
  summary: z.string().min(20).max(500).optional(),
  body: z.string().min(100).max(10000).optional(),
  tags: z.array(z.string()).optional(),
});

const voteInput = z.object({
  proposalId: z.string(),
  choice: z.enum(["for", "against", "abstain"]),
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

// Procedure requiring minimum RC to create proposals
const proposalCreateProcedure = createMinRcProcedure(RC_CONFIG.MIN_RC_TO_CREATE_PROPOSAL);
const proposalVoteProcedure = createMinRcProcedure(RC_CONFIG.MIN_RC_TO_VOTE_ON_PROPOSAL);

export const governanceRouter = router({
  // List active proposals (public)
  listActive: publicProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(PAGINATION.MAX_PAGE_SIZE).default(PAGINATION.DEFAULT_PAGE_SIZE),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const now = new Date();

      const results = await db
        .select({
          id: proposals.id,
          title: proposals.title,
          summary: proposals.summary,
          status: proposals.status,
          votesFor: proposals.votesFor,
          votesAgainst: proposals.votesAgainst,
          votesAbstain: proposals.votesAbstain,
          totalRcWeight: proposals.totalRcWeight,
          tags: proposals.tags,
          createdAt: proposals.createdAt,
          activatedAt: proposals.activatedAt,
          votingEndsAt: proposals.votingEndsAt,
          authorId: proposals.authorId,
          authorName: users.name,
          authorAvatar: users.avatarUrl,
        })
        .from(proposals)
        .leftJoin(users, eq(proposals.authorId, users.id))
        .where(
          and(
            eq(proposals.status, "active"),
            gte(proposals.votingEndsAt, now)
          )
        )
        .orderBy(asc(proposals.votingEndsAt))
        .limit(input.limit + 1);

      const hasMore = results.length > input.limit;
      const items = hasMore ? results.slice(0, -1) : results;

      return {
        items: items.map((item) => ({
          ...item,
          author: {
            id: item.authorId,
            name: item.authorName,
            avatarUrl: item.authorAvatar,
          },
        })),
        nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
      };
    }),

  // List proposal history (public)
  listHistory: publicProcedure
    .input(
      z.object({
        status: z.enum(["accepted", "rejected", "withdrawn"]).optional(),
        authorId: z.string().optional(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(PAGINATION.MAX_PAGE_SIZE).default(PAGINATION.DEFAULT_PAGE_SIZE),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const conditions = [];

      if (input.status) {
        conditions.push(eq(proposals.status, input.status));
      } else {
        conditions.push(
          sql`${proposals.status} IN ('accepted', 'rejected', 'withdrawn')`
        );
      }

      if (input.authorId) {
        conditions.push(eq(proposals.authorId, input.authorId));
      }

      const results = await db
        .select({
          id: proposals.id,
          title: proposals.title,
          summary: proposals.summary,
          status: proposals.status,
          votesFor: proposals.votesFor,
          votesAgainst: proposals.votesAgainst,
          votesAbstain: proposals.votesAbstain,
          totalRcWeight: proposals.totalRcWeight,
          tags: proposals.tags,
          createdAt: proposals.createdAt,
          closedAt: proposals.closedAt,
          authorName: users.name,
        })
        .from(proposals)
        .leftJoin(users, eq(proposals.authorId, users.id))
        .where(and(...conditions))
        .orderBy(desc(proposals.closedAt))
        .limit(input.limit + 1);

      const hasMore = results.length > input.limit;
      const items = hasMore ? results.slice(0, -1) : results;

      return {
        items,
        nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
      };
    }),

  // Get proposal by ID (public)
  getById: publicProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const [proposal] = await db
      .select({
        proposal: proposals,
        authorName: users.name,
        authorAvatar: users.avatarUrl,
        authorRc: users.reputationCredits,
      })
      .from(proposals)
      .leftJoin(users, eq(proposals.authorId, users.id))
      .where(eq(proposals.id, input.id));

    if (!proposal) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found" });
    }

    return {
      ...proposal.proposal,
      author: {
        id: proposal.proposal.authorId,
        name: proposal.authorName,
        avatarUrl: proposal.authorAvatar,
        reputationCredits: proposal.authorRc,
      },
    };
  }),

  // Get votes for a proposal
  getVotes: publicProcedure
    .input(z.object({ proposalId: z.string(), limit: z.number().default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const votes = await db
        .select({
          id: proposalVotes.id,
          choice: proposalVotes.choice,
          weightRc: proposalVotes.weightRc,
          createdAt: proposalVotes.createdAt,
          voterName: users.name,
          voterAvatar: users.avatarUrl,
        })
        .from(proposalVotes)
        .leftJoin(users, eq(proposalVotes.voterId, users.id))
        .where(eq(proposalVotes.proposalId, input.proposalId))
        .orderBy(desc(proposalVotes.weightRc))
        .limit(input.limit);

      return votes;
    }),

  // Create proposal (requires minimum RC)
  create: proposalCreateProcedure.input(createProposalInput).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const id = nanoid();
    const now = new Date();
    const votingEndsAt = new Date(now.getTime() + input.votingDurationDays * 24 * 60 * 60 * 1000);

    await db.insert(proposals).values({
      id,
      authorId: ctx.user.id,
      title: input.title,
      summary: input.summary,
      body: input.body,
      tags: input.tags ?? [],
      status: "active",
      snapshotRc: ctx.user.reputationCredits ?? 0,
      minRcToCreate: RC_CONFIG.MIN_RC_TO_CREATE_PROPOSAL,
      minRcToVote: RC_CONFIG.MIN_RC_TO_VOTE_ON_PROPOSAL,
      activatedAt: now,
      votingEndsAt,
    });

    // Deduct RC for creating proposal
    await awardRc(
      db,
      ctx.user.id,
      RC_CONFIG.PROPOSAL_CREATED,
      "proposal_created",
      "proposal",
      id
    );

    return { id };
  }),

  // Update draft proposal (author only)
  update: protectedProcedure.input(updateProposalInput).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const { id, ...updates } = input;

    const [existing] = await db.select().from(proposals).where(eq(proposals.id, id));
    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found" });
    }

    if (existing.authorId !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own proposals" });
    }

    if (existing.status !== "draft") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft proposals can be edited" });
    }

    await db
      .update(proposals)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(proposals.id, id));

    return { success: true };
  }),

  // Withdraw proposal (author only)
  withdraw: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const [existing] = await db.select().from(proposals).where(eq(proposals.id, input.id));
    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found" });
    }

    if (existing.authorId !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You can only withdraw your own proposals" });
    }

    if (!["draft", "active"].includes(existing.status)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft or active proposals can be withdrawn" });
    }

    await db
      .update(proposals)
      .set({ status: "withdrawn", closedAt: new Date(), updatedAt: new Date() })
      .where(eq(proposals.id, input.id));

    return { success: true };
  }),

  // Vote on proposal (requires minimum RC)
  vote: proposalVoteProcedure.input(voteInput).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const [proposal] = await db.select().from(proposals).where(eq(proposals.id, input.proposalId));
    if (!proposal) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found" });
    }

    if (proposal.status !== "active") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Voting is not open for this proposal" });
    }

    if (proposal.votingEndsAt && new Date() > proposal.votingEndsAt) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Voting period has ended" });
    }

    // Check existing vote
    const [existingVote] = await db
      .select()
      .from(proposalVotes)
      .where(and(eq(proposalVotes.proposalId, input.proposalId), eq(proposalVotes.voterId, ctx.user.id)));

    if (existingVote) {
      throw new TRPCError({ code: "CONFLICT", message: "You have already voted on this proposal" });
    }

    const voterRc = ctx.user.reputationCredits ?? 0;

    // Record vote
    await db.insert(proposalVotes).values({
      id: nanoid(),
      proposalId: input.proposalId,
      voterId: ctx.user.id,
      choice: input.choice,
      weightRc: voterRc,
    });

    // Update proposal vote counts
    const updateData: Record<string, unknown> = {
      totalRcWeight: sql`${proposals.totalRcWeight} + ${voterRc}`,
      updatedAt: new Date(),
    };

    if (input.choice === "for") {
      updateData.votesFor = sql`${proposals.votesFor} + 1`;
    } else if (input.choice === "against") {
      updateData.votesAgainst = sql`${proposals.votesAgainst} + 1`;
    } else {
      updateData.votesAbstain = sql`${proposals.votesAbstain} + 1`;
    }

    await db.update(proposals).set(updateData).where(eq(proposals.id, input.proposalId));

    // Award RC for voting
    await awardRc(db, ctx.user.id, RC_CONFIG.PROPOSAL_VOTE_CAST, "proposal_vote_cast", "proposal", input.proposalId);

    return { success: true, choice: input.choice, weightRc: voterRc };
  }),

  // Get user's vote on a proposal
  getUserVote: protectedProcedure.input(z.object({ proposalId: z.string() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const [vote] = await db
      .select()
      .from(proposalVotes)
      .where(and(eq(proposalVotes.proposalId, input.proposalId), eq(proposalVotes.voterId, ctx.user.id)));

    return vote ?? null;
  }),

  // Close voting and determine result (admin only, or automated)
  closeVoting: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const [proposal] = await db.select().from(proposals).where(eq(proposals.id, input.id));
    if (!proposal) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found" });
    }

    if (proposal.status !== "active") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Proposal is not active" });
    }

    // Determine outcome
    const forVotes = proposal.votesFor ?? 0;
    const againstVotes = proposal.votesAgainst ?? 0;

    const passed = forVotes > againstVotes;
    const newStatus = passed ? "accepted" : "rejected";

    await db
      .update(proposals)
      .set({
        status: newStatus,
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(proposals.id, input.id));

    // Award RC to author if passed
    if (passed) {
      await awardRc(db, proposal.authorId, RC_CONFIG.PROPOSAL_PASSED, "proposal_passed", "proposal", input.id);
    }

    return { success: true, status: newStatus, passed };
  }),

  // Get governance stats
  getStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const [activeCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(proposals)
      .where(eq(proposals.status, "active"));

    const [acceptedCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(proposals)
      .where(eq(proposals.status, "accepted"));

    const [rejectedCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(proposals)
      .where(eq(proposals.status, "rejected"));

    const [totalVotes] = await db.select({ count: sql<number>`count(*)` }).from(proposalVotes);

    const [totalRcVoted] = await db
      .select({ sum: sql<number>`COALESCE(SUM(${proposalVotes.weightRc}), 0)` })
      .from(proposalVotes);

    return {
      activeProposals: activeCount?.count ?? 0,
      acceptedProposals: acceptedCount?.count ?? 0,
      rejectedProposals: rejectedCount?.count ?? 0,
      totalVotesCast: totalVotes?.count ?? 0,
      totalRcWeightVoted: totalRcVoted?.sum ?? 0,
    };
  }),

  // List user's proposals
  listUserProposals: publicProcedure
    .input(z.object({ userId: z.string(), limit: z.number().default(20) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const userProposals = await db
        .select({
          id: proposals.id,
          title: proposals.title,
          summary: proposals.summary,
          status: proposals.status,
          votesFor: proposals.votesFor,
          votesAgainst: proposals.votesAgainst,
          createdAt: proposals.createdAt,
          closedAt: proposals.closedAt,
        })
        .from(proposals)
        .where(eq(proposals.authorId, input.userId))
        .orderBy(desc(proposals.createdAt))
        .limit(input.limit);

      return userProposals;
    }),
});

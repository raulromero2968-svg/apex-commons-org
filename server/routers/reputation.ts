import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../_core/trpc';
import { users, rcTransactions } from '../../drizzle/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { getDb } from '../db';

// Level Thresholds (Configurable constants)
const LEVEL_THRESHOLDS = {
  SILVER: 1000,
  GOLD: 5000,
  PLATINUM: 10000,
};

export const reputationRouter = router({
  /**
   * GET MY HISTORY (Protected)
   * Returns the user's transaction ledger for the dashboard.
   */
  getHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(10) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      return await db.select()
        .from(rcTransactions)
        .where(eq(rcTransactions.userId, ctx.user.id))
        .orderBy(desc(rcTransactions.createdAt))
        .limit(input.limit);
    }),

  /**
   * GET MY STATS (Protected)
   * Returns the user's current reputation stats.
   */
  getMyStats: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      const result = await db.select({
        reputationCredits: users.reputationCredits,
        contributorLevel: users.contributorLevel,
      })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (result.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      const userStats = result[0];

      // Calculate progress to next level
      let nextLevel: string | null = null;
      let progressToNext = 0;
      let rcToNext = 0;

      if (userStats.contributorLevel === 'bronze') {
        nextLevel = 'silver';
        rcToNext = LEVEL_THRESHOLDS.SILVER - userStats.reputationCredits;
        progressToNext = (userStats.reputationCredits / LEVEL_THRESHOLDS.SILVER) * 100;
      } else if (userStats.contributorLevel === 'silver') {
        nextLevel = 'gold';
        rcToNext = LEVEL_THRESHOLDS.GOLD - userStats.reputationCredits;
        progressToNext = ((userStats.reputationCredits - LEVEL_THRESHOLDS.SILVER) / (LEVEL_THRESHOLDS.GOLD - LEVEL_THRESHOLDS.SILVER)) * 100;
      } else if (userStats.contributorLevel === 'gold') {
        nextLevel = 'platinum';
        rcToNext = LEVEL_THRESHOLDS.PLATINUM - userStats.reputationCredits;
        progressToNext = ((userStats.reputationCredits - LEVEL_THRESHOLDS.GOLD) / (LEVEL_THRESHOLDS.PLATINUM - LEVEL_THRESHOLDS.GOLD)) * 100;
      } else {
        nextLevel = null;
        progressToNext = 100;
        rcToNext = 0;
      }

      return {
        ...userStats,
        nextLevel,
        progressToNext: Math.min(100, Math.max(0, progressToNext)),
        rcToNext: Math.max(0, rcToNext),
        thresholds: LEVEL_THRESHOLDS,
      };
    }),

  /**
   * GET LEADERBOARD (Public)
   * Shows the top contributors. Fosters healthy competition.
   */
  getLeaderboard: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      return await db.select({
        id: users.id,
        name: users.name,
        reputationCredits: users.reputationCredits,
        contributorLevel: users.contributorLevel,
      })
        .from(users)
        .orderBy(desc(users.reputationCredits))
        .limit(input.limit);
    }),

  /**
   * CHECK AND UPDATE LEVEL (Protected)
   * A utility procedure to sync a user's level with their RC.
   * This ensures that if a user crosses a threshold, their badge updates.
   */
  syncLevel: protectedProcedure
    .mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      // Fetch fresh user data
      const freshUser = await db.select()
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (freshUser.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      const userData = freshUser[0];
      const rc = userData.reputationCredits;
      let newLevel: 'bronze' | 'silver' | 'gold' | 'platinum' = 'bronze';

      if (rc >= LEVEL_THRESHOLDS.PLATINUM) {
        newLevel = 'platinum';
      } else if (rc >= LEVEL_THRESHOLDS.GOLD) {
        newLevel = 'gold';
      } else if (rc >= LEVEL_THRESHOLDS.SILVER) {
        newLevel = 'silver';
      }

      // Only update if changed to avoid unnecessary writes
      if (newLevel !== userData.contributorLevel) {
        await db.update(users)
          .set({ contributorLevel: newLevel })
          .where(eq(users.id, ctx.user.id));

        return { leveledUp: true, newLevel, previousLevel: userData.contributorLevel };
      }

      return { leveledUp: false, currentLevel: userData.contributorLevel };
    }),

  /**
   * GET LEVEL THRESHOLDS (Public)
   * Returns the RC thresholds for each level.
   */
  getLevelThresholds: publicProcedure
    .query(() => {
      return {
        bronze: 0,
        silver: LEVEL_THRESHOLDS.SILVER,
        gold: LEVEL_THRESHOLDS.GOLD,
        platinum: LEVEL_THRESHOLDS.PLATINUM,
      };
    }),
});

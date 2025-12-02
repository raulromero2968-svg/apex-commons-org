import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { waitlist } from "../drizzle/schema";
import { getDb } from "./db";
import { resourcesRouter } from "./routers/resources";

export const appRouter = router({
  system: systemRouter,

  // Resources Router - Powers Discovery (/browse) and Consumption (/resource/:id)
  resources: resourcesRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  waitlist: router({
    join: publicProcedure
      .input(z.object({
        name: z.string().min(1),
        email: z.string().email(),
        message: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const id = `wl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await db.insert(waitlist).values({
          id,
          name: input.name,
          email: input.email,
          message: input.message || null,
        });

        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;

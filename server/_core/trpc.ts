import {
  NOT_ADMIN_ERR_MSG,
  UNAUTHED_ERR_MSG,
  NOT_TEACHER_ERR_MSG,
  NOT_MODERATOR_ERR_MSG,
  INSUFFICIENT_RC_ERR_MSG,
} from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import type { User } from "../../drizzle/schema";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Middleware: Require authenticated user
const requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user as User,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

// Middleware: Require admin role
export const adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user as User,
      },
    });
  })
);

// Middleware: Require teacher role (or higher)
export const teacherProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    const allowedRoles = ["teacher", "moderator", "admin"];
    if (!allowedRoles.includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_TEACHER_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user as User,
      },
    });
  })
);

// Middleware: Require moderator role (or admin)
export const moderatorProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    const allowedRoles = ["moderator", "admin"];
    if (!allowedRoles.includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_MODERATOR_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user as User,
      },
    });
  })
);

// Factory: Create procedure requiring minimum RC
export function createMinRcProcedure(minRc: number) {
  return t.procedure.use(
    t.middleware(async (opts) => {
      const { ctx, next } = opts;

      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
      }

      if ((ctx.user.reputationCredits ?? 0) < minRc) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `${INSUFFICIENT_RC_ERR_MSG}. Required: ${minRc}, Current: ${ctx.user.reputationCredits ?? 0}`,
        });
      }

      return next({
        ctx: {
          ...ctx,
          user: ctx.user as User,
        },
      });
    })
  );
}

// Export the t instance for creating custom middleware
export { t };

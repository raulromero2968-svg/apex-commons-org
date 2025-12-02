import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../server/routers";
import type { inferRouterOutputs, inferRouterInputs } from "@trpc/server";

export const trpc = createTRPCReact<AppRouter>();

// Type inference helpers for perfect type safety
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;

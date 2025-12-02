import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, or, desc, asc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  router,
  publicProcedure,
  protectedProcedure,
} from "../_core/trpc";
import { getDb } from "../db";
import {
  collections,
  collectionResources,
  collectionFollowers,
  resources,
  users,
} from "../../drizzle/schema";
import { PAGINATION } from "@shared/const";

// Input schemas
const createCollectionInput = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  visibility: z.enum(["public", "private", "unlisted"]).default("private"),
  tags: z.array(z.string()).optional(),
  thumbnailUrl: z.string().url().optional(),
});

const updateCollectionInput = z.object({
  id: z.string(),
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  visibility: z.enum(["public", "private", "unlisted"]).optional(),
  tags: z.array(z.string()).optional(),
  thumbnailUrl: z.string().url().optional(),
});

const addResourceInput = z.object({
  collectionId: z.string(),
  resourceId: z.string(),
  orderIndex: z.number().optional(),
});

const reorderResourcesInput = z.object({
  collectionId: z.string(),
  resourceIds: z.array(z.string()),
});

export const collectionRouter = router({
  // List user's collections
  listUserCollections: publicProcedure
    .input(
      z.object({
        userId: z.string().optional(),
        includePrivate: z.boolean().default(false),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(PAGINATION.MAX_PAGE_SIZE).default(PAGINATION.DEFAULT_PAGE_SIZE),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const targetUserId = input.userId ?? ctx.user?.id;
      if (!targetUserId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "User ID required" });
      }

      const conditions = [eq(collections.ownerId, targetUserId)];

      // Only show private collections if viewing own and authenticated
      if (!input.includePrivate || targetUserId !== ctx.user?.id) {
        conditions.push(or(eq(collections.visibility, "public"), eq(collections.visibility, "unlisted"))!);
      }

      const results = await db
        .select({
          id: collections.id,
          title: collections.title,
          description: collections.description,
          visibility: collections.visibility,
          tags: collections.tags,
          thumbnailUrl: collections.thumbnailUrl,
          resourceCount: collections.resourceCount,
          followerCount: collections.followerCount,
          createdAt: collections.createdAt,
          updatedAt: collections.updatedAt,
        })
        .from(collections)
        .where(and(...conditions))
        .orderBy(desc(collections.updatedAt))
        .limit(input.limit + 1);

      const hasMore = results.length > input.limit;
      const items = hasMore ? results.slice(0, -1) : results;

      return {
        items,
        nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
      };
    }),

  // Get collection by ID
  getById: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const [collection] = await db
      .select({
        collection: collections,
        ownerName: users.name,
        ownerAvatar: users.avatarUrl,
      })
      .from(collections)
      .leftJoin(users, eq(collections.ownerId, users.id))
      .where(eq(collections.id, input.id));

    if (!collection) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Collection not found" });
    }

    // Check visibility
    if (collection.collection.visibility === "private" && collection.collection.ownerId !== ctx.user?.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "This collection is private" });
    }

    return {
      ...collection.collection,
      owner: {
        id: collection.collection.ownerId,
        name: collection.ownerName,
        avatarUrl: collection.ownerAvatar,
      },
    };
  }),

  // Get resources in a collection
  getResources: publicProcedure
    .input(z.object({ collectionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Check collection visibility
      const [collection] = await db.select().from(collections).where(eq(collections.id, input.collectionId));
      if (!collection) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Collection not found" });
      }

      if (collection.visibility === "private" && collection.ownerId !== ctx.user?.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This collection is private" });
      }

      const items = await db
        .select({
          id: resources.id,
          title: resources.title,
          summary: resources.summary,
          category: resources.category,
          subject: resources.subject,
          gradeLevel: resources.gradeLevel,
          thumbnailUrl: resources.thumbnailUrl,
          netVotes: resources.netVotes,
          orderIndex: collectionResources.orderIndex,
          addedAt: collectionResources.addedAt,
        })
        .from(collectionResources)
        .innerJoin(resources, eq(collectionResources.resourceId, resources.id))
        .where(eq(collectionResources.collectionId, input.collectionId))
        .orderBy(asc(collectionResources.orderIndex));

      return items;
    }),

  // Create collection (authenticated)
  create: protectedProcedure.input(createCollectionInput).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const id = nanoid();

    await db.insert(collections).values({
      id,
      ownerId: ctx.user.id,
      title: input.title,
      description: input.description,
      visibility: input.visibility,
      tags: input.tags ?? [],
      thumbnailUrl: input.thumbnailUrl,
    });

    return { id };
  }),

  // Update collection (owner only)
  update: protectedProcedure.input(updateCollectionInput).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const { id, ...updates } = input;

    // Check ownership
    const [existing] = await db.select().from(collections).where(eq(collections.id, id));
    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Collection not found" });
    }

    if (existing.ownerId !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own collections" });
    }

    await db
      .update(collections)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(collections.id, id));

    return { success: true };
  }),

  // Delete collection (owner only)
  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const [existing] = await db.select().from(collections).where(eq(collections.id, input.id));
    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Collection not found" });
    }

    if (existing.ownerId !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You can only delete your own collections" });
    }

    await db.delete(collections).where(eq(collections.id, input.id));

    return { success: true };
  }),

  // Add resource to collection (owner only)
  addResource: protectedProcedure.input(addResourceInput).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    // Check ownership
    const [collection] = await db.select().from(collections).where(eq(collections.id, input.collectionId));
    if (!collection) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Collection not found" });
    }

    if (collection.ownerId !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You can only add to your own collections" });
    }

    // Check resource exists
    const [resource] = await db.select().from(resources).where(eq(resources.id, input.resourceId));
    if (!resource) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
    }

    // Check if already in collection
    const [existing] = await db
      .select()
      .from(collectionResources)
      .where(and(eq(collectionResources.collectionId, input.collectionId), eq(collectionResources.resourceId, input.resourceId)));

    if (existing) {
      throw new TRPCError({ code: "CONFLICT", message: "Resource already in collection" });
    }

    // Get next order index if not provided
    let orderIndex = input.orderIndex;
    if (orderIndex === undefined) {
      const [maxOrder] = await db
        .select({ max: sql<number>`COALESCE(MAX(${collectionResources.orderIndex}), -1)` })
        .from(collectionResources)
        .where(eq(collectionResources.collectionId, input.collectionId));
      orderIndex = (maxOrder?.max ?? -1) + 1;
    }

    await db.insert(collectionResources).values({
      id: nanoid(),
      collectionId: input.collectionId,
      resourceId: input.resourceId,
      orderIndex,
    });

    // Update resource count
    await db
      .update(collections)
      .set({
        resourceCount: sql`${collections.resourceCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(collections.id, input.collectionId));

    return { success: true };
  }),

  // Remove resource from collection (owner only)
  removeResource: protectedProcedure
    .input(z.object({ collectionId: z.string(), resourceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Check ownership
      const [collection] = await db.select().from(collections).where(eq(collections.id, input.collectionId));
      if (!collection) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Collection not found" });
      }

      if (collection.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only modify your own collections" });
      }

      await db
        .delete(collectionResources)
        .where(and(eq(collectionResources.collectionId, input.collectionId), eq(collectionResources.resourceId, input.resourceId)));

      // Update resource count
      await db
        .update(collections)
        .set({
          resourceCount: sql`${collections.resourceCount} - 1`,
          updatedAt: new Date(),
        })
        .where(eq(collections.id, input.collectionId));

      return { success: true };
    }),

  // Reorder resources in collection (owner only)
  reorderResources: protectedProcedure.input(reorderResourcesInput).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    // Check ownership
    const [collection] = await db.select().from(collections).where(eq(collections.id, input.collectionId));
    if (!collection) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Collection not found" });
    }

    if (collection.ownerId !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You can only modify your own collections" });
    }

    // Update order indexes
    for (let i = 0; i < input.resourceIds.length; i++) {
      await db
        .update(collectionResources)
        .set({ orderIndex: i })
        .where(and(eq(collectionResources.collectionId, input.collectionId), eq(collectionResources.resourceId, input.resourceIds[i])));
    }

    await db.update(collections).set({ updatedAt: new Date() }).where(eq(collections.id, input.collectionId));

    return { success: true };
  }),

  // Follow collection (authenticated)
  follow: protectedProcedure.input(z.object({ collectionId: z.string() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    // Check collection exists and is accessible
    const [collection] = await db.select().from(collections).where(eq(collections.id, input.collectionId));
    if (!collection) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Collection not found" });
    }

    if (collection.visibility === "private" && collection.ownerId !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Cannot follow private collections" });
    }

    // Check if already following
    const [existing] = await db
      .select()
      .from(collectionFollowers)
      .where(and(eq(collectionFollowers.collectionId, input.collectionId), eq(collectionFollowers.userId, ctx.user.id)));

    if (existing) {
      return { success: true, alreadyFollowing: true };
    }

    await db.insert(collectionFollowers).values({
      id: nanoid(),
      collectionId: input.collectionId,
      userId: ctx.user.id,
    });

    // Update follower count
    await db
      .update(collections)
      .set({ followerCount: sql`${collections.followerCount} + 1` })
      .where(eq(collections.id, input.collectionId));

    return { success: true, alreadyFollowing: false };
  }),

  // Unfollow collection (authenticated)
  unfollow: protectedProcedure.input(z.object({ collectionId: z.string() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    await db
      .delete(collectionFollowers)
      .where(and(eq(collectionFollowers.collectionId, input.collectionId), eq(collectionFollowers.userId, ctx.user.id)));

    // Update follower count
    await db
      .update(collections)
      .set({ followerCount: sql`GREATEST(${collections.followerCount} - 1, 0)` })
      .where(eq(collections.id, input.collectionId));

    return { success: true };
  }),

  // Check if user follows a collection
  isFollowing: protectedProcedure.input(z.object({ collectionId: z.string() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const [existing] = await db
      .select()
      .from(collectionFollowers)
      .where(and(eq(collectionFollowers.collectionId, input.collectionId), eq(collectionFollowers.userId, ctx.user.id)));

    return !!existing;
  }),

  // List followed collections
  listFollowed: protectedProcedure
    .input(z.object({ limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const followed = await db
        .select({
          id: collections.id,
          title: collections.title,
          description: collections.description,
          thumbnailUrl: collections.thumbnailUrl,
          resourceCount: collections.resourceCount,
          ownerName: users.name,
        })
        .from(collectionFollowers)
        .innerJoin(collections, eq(collectionFollowers.collectionId, collections.id))
        .leftJoin(users, eq(collections.ownerId, users.id))
        .where(eq(collectionFollowers.userId, ctx.user.id))
        .orderBy(desc(collectionFollowers.createdAt))
        .limit(input.limit);

      return followed;
    }),

  // Browse public collections
  browsePublic: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        sort: z.enum(["newest", "popular", "most_resources"]).default("newest"),
        limit: z.number().default(20),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      let orderBy;
      switch (input.sort) {
        case "popular":
          orderBy = desc(collections.followerCount);
          break;
        case "most_resources":
          orderBy = desc(collections.resourceCount);
          break;
        default:
          orderBy = desc(collections.createdAt);
      }

      const results = await db
        .select({
          id: collections.id,
          title: collections.title,
          description: collections.description,
          thumbnailUrl: collections.thumbnailUrl,
          tags: collections.tags,
          resourceCount: collections.resourceCount,
          followerCount: collections.followerCount,
          ownerName: users.name,
          ownerAvatar: users.avatarUrl,
          createdAt: collections.createdAt,
        })
        .from(collections)
        .leftJoin(users, eq(collections.ownerId, users.id))
        .where(eq(collections.visibility, "public"))
        .orderBy(orderBy)
        .limit(input.limit);

      return results;
    }),
});

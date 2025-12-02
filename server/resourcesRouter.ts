import { z } from "zod";
import { eq, desc, asc, like, or, and, sql } from "drizzle-orm";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { resources, contributors, type Resource, type Contributor } from "../drizzle/schema";
import { storagePut, storageGet } from "./storage";

// Validation schemas (exported for client-side reuse)
export const CATEGORIES = [
  "Mathematics",
  "Science",
  "History",
  "Computer Science",
  "Language Arts",
  "Social Studies",
  "Arts",
  "Physical Education",
  "Other",
] as const;

export const GRADE_LEVELS = [
  "Elementary",
  "Middle School",
  "High School",
  "University",
  "Professional",
] as const;

export const RESOURCE_TYPES = [
  "Lesson Plan",
  "Worksheet",
  "Video",
  "Interactive",
  "Assessment",
  "Presentation",
  "Article",
  "Other",
] as const;

// Create resource input schema
const createResourceInput = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200, "Title too long"),
  description: z.string().min(10, "Description must be at least 10 characters").max(2000, "Description too long"),
  category: z.enum(CATEGORIES),
  gradeLevel: z.enum(GRADE_LEVELS),
  resourceType: z.enum(RESOURCE_TYPES),
  tags: z.string().optional(),
  fileData: z.string().optional(), // Base64 encoded file for small files
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
  fileSize: z.string().optional(),
});

// Input schema for resource listing
const getResourcesInput = z.object({
  limit: z.number().min(1).max(50).default(12),
  cursor: z.string().nullish(),
  search: z.string().optional(),
  category: z.string().optional(),
  gradeLevel: z.string().optional(),
  resourceType: z.string().optional(),
  sortBy: z.enum(["newest", "popular", "highest_rated"]).default("newest"),
});

// Output type with contributor info
export type ResourceWithContributor = Resource & {
  contributor: Pick<Contributor, "id" | "name" | "level">;
};

export const resourcesRouter = router({
  // Infinite query for browsing resources
  getAll: publicProcedure
    .input(getResourcesInput)
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        // Return mock data for development/demo without DB
        return getMockResources(input);
      }

      const { limit, cursor, search, category, gradeLevel, resourceType, sortBy } = input;

      // Build where conditions
      const conditions = [];

      // Only published resources
      conditions.push(eq(resources.isPublished, "true"));

      // Category filter
      if (category && category !== "All") {
        conditions.push(eq(resources.category, category as any));
      }

      // Grade level filter
      if (gradeLevel && gradeLevel !== "All") {
        conditions.push(eq(resources.gradeLevel, gradeLevel as any));
      }

      // Resource type filter
      if (resourceType && resourceType !== "All") {
        conditions.push(eq(resources.resourceType, resourceType as any));
      }

      // Search filter (title and description)
      if (search && search.trim()) {
        const searchTerm = `%${search.trim()}%`;
        conditions.push(
          or(
            like(resources.title, searchTerm),
            like(resources.description, searchTerm),
            like(resources.tags, searchTerm)
          )
        );
      }

      // Cursor-based pagination
      if (cursor) {
        conditions.push(sql`${resources.id} < ${cursor}`);
      }

      // Build order by clause based on sortBy
      let orderBy;
      switch (sortBy) {
        case "popular":
          orderBy = [desc(resources.views), desc(resources.createdAt)];
          break;
        case "highest_rated":
          orderBy = [desc(resources.upvotes), desc(resources.createdAt)];
          break;
        case "newest":
        default:
          orderBy = [desc(resources.createdAt)];
      }

      // Execute query with join to contributors
      const results = await db
        .select({
          resource: resources,
          contributor: {
            id: contributors.id,
            name: contributors.name,
            level: contributors.level,
          },
        })
        .from(resources)
        .leftJoin(contributors, eq(resources.contributorId, contributors.id))
        .where(and(...conditions))
        .orderBy(...orderBy)
        .limit(limit + 1);

      // Determine if there are more results
      const hasMore = results.length > limit;
      const items = hasMore ? results.slice(0, limit) : results;

      // Transform results
      const transformedItems: ResourceWithContributor[] = items.map((row) => ({
        ...row.resource,
        contributor: row.contributor || { id: "", name: "Anonymous", level: "bronze" as const },
      }));

      return {
        items: transformedItems,
        nextCursor: hasMore ? items[items.length - 1]?.resource.id : undefined,
      };
    }),

  // Get a single resource by ID
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        return getMockResourceById(input.id);
      }

      const result = await db
        .select({
          resource: resources,
          contributor: {
            id: contributors.id,
            name: contributors.name,
            level: contributors.level,
          },
        })
        .from(resources)
        .leftJoin(contributors, eq(resources.contributorId, contributors.id))
        .where(eq(resources.id, input.id))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      // Increment view count
      await db
        .update(resources)
        .set({ views: sql`CAST(${resources.views} AS INTEGER) + 1` })
        .where(eq(resources.id, input.id));

      return {
        ...result[0].resource,
        contributor: result[0].contributor || { id: "", name: "Anonymous", level: "bronze" as const },
      } as ResourceWithContributor;
    }),

  // Vote on a resource
  vote: protectedProcedure
    .input(
      z.object({
        resourceId: z.string(),
        voteType: z.enum(["up", "down"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        return { success: true, newUpvotes: 1, newDownvotes: 0 };
      }

      const { resourceId, voteType } = input;

      // Update vote count
      if (voteType === "up") {
        await db
          .update(resources)
          .set({ upvotes: sql`CAST(${resources.upvotes} AS INTEGER) + 1` })
          .where(eq(resources.id, resourceId));
      } else {
        await db
          .update(resources)
          .set({ downvotes: sql`CAST(${resources.downvotes} AS INTEGER) + 1` })
          .where(eq(resources.id, resourceId));
      }

      // Get updated resource
      const updated = await db
        .select({ upvotes: resources.upvotes, downvotes: resources.downvotes })
        .from(resources)
        .where(eq(resources.id, resourceId))
        .limit(1);

      return {
        success: true,
        newUpvotes: parseInt(updated[0]?.upvotes || "0", 10),
        newDownvotes: parseInt(updated[0]?.downvotes || "0", 10),
      };
    }),

  // Increment download count
  trackDownload: publicProcedure
    .input(z.object({ resourceId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        return { success: true };
      }

      await db
        .update(resources)
        .set({ downloads: sql`CAST(${resources.downloads} AS INTEGER) + 1` })
        .where(eq(resources.id, input.resourceId));

      return { success: true };
    }),

  // Create a new resource
  create: protectedProcedure
    .input(createResourceInput)
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();

      // Generate unique ID
      const resourceId = `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Handle file upload if provided
      let fileUrl: string | null = null;
      if (input.fileData && input.fileName) {
        try {
          // Decode base64 and upload to storage
          const fileBuffer = Buffer.from(input.fileData, "base64");
          const storageKey = `resources/${resourceId}/${input.fileName}`;
          const uploadResult = await storagePut(
            storageKey,
            fileBuffer,
            input.mimeType || "application/octet-stream"
          );
          fileUrl = uploadResult.url;
        } catch (error) {
          console.error("File upload failed:", error);
          // Continue without file - don't fail the entire operation
        }
      }

      if (!db) {
        // Return mock success for demo mode
        return {
          success: true,
          resourceId,
          message: "Resource created successfully (demo mode)",
        };
      }

      // Find or create contributor for the user
      let contributorId: string;
      const existingContributor = await db
        .select()
        .from(contributors)
        .where(eq(contributors.userId, ctx.user.id))
        .limit(1);

      if (existingContributor.length > 0) {
        contributorId = existingContributor[0].id;
        // Update contribution count
        await db
          .update(contributors)
          .set({
            totalContributions: sql`CAST(${contributors.totalContributions} AS INTEGER) + 1`,
          })
          .where(eq(contributors.id, contributorId));
      } else {
        // Create new contributor
        contributorId = `cont_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await db.insert(contributors).values({
          id: contributorId,
          userId: ctx.user.id,
          name: ctx.user.name || "Anonymous Contributor",
          level: "bronze",
          totalContributions: "1",
          reputation: "0",
        });
      }

      // Insert the resource
      await db.insert(resources).values({
        id: resourceId,
        title: input.title,
        description: input.description,
        category: input.category,
        gradeLevel: input.gradeLevel,
        resourceType: input.resourceType,
        tags: input.tags || null,
        fileUrl,
        thumbnailUrl: null,
        fileSize: input.fileSize || null,
        mimeType: input.mimeType || null,
        contributorId,
        upvotes: "0",
        downvotes: "0",
        views: "0",
        downloads: "0",
        isPublished: "true",
        isFeatured: "false",
      });

      return {
        success: true,
        resourceId,
        message: "Resource created successfully",
      };
    }),

  // Get file download URL
  getDownloadUrl: publicProcedure
    .input(z.object({ resourceId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        return { url: null };
      }

      const resource = await db
        .select({ fileUrl: resources.fileUrl })
        .from(resources)
        .where(eq(resources.id, input.resourceId))
        .limit(1);

      if (resource.length === 0 || !resource[0].fileUrl) {
        return { url: null };
      }

      return { url: resource[0].fileUrl };
    }),
});

// Mock data for development/demo without database
function getMockResources(input: z.infer<typeof getResourcesInput>) {
  const mockContributors = [
    { id: "c1", name: "Dr. Sarah Chen", level: "platinum" as const },
    { id: "c2", name: "Prof. James Miller", level: "gold" as const },
    { id: "c3", name: "Emma Thompson", level: "silver" as const },
    { id: "c4", name: "Michael Rodriguez", level: "bronze" as const },
  ];

  const mockResources: ResourceWithContributor[] = [
    {
      id: "r1",
      title: "Introduction to Calculus: Limits and Continuity",
      description: "A comprehensive lesson plan covering the fundamentals of limits, continuity, and their applications in real-world scenarios.",
      category: "Mathematics",
      gradeLevel: "High School",
      resourceType: "Lesson Plan",
      fileUrl: null,
      thumbnailUrl: null,
      fileSize: "2.4 MB",
      mimeType: "application/pdf",
      contributorId: "c1",
      upvotes: "142",
      downvotes: "3",
      views: "1847",
      downloads: "523",
      tags: "calculus,limits,continuity,math",
      isPublished: "true",
      isFeatured: "true",
      createdAt: new Date("2024-11-15"),
      updatedAt: new Date("2024-11-15"),
      contributor: mockContributors[0],
    },
    {
      id: "r2",
      title: "The Scientific Method: Interactive Lab Guide",
      description: "Hands-on experiments and activities teaching students the principles of scientific inquiry and experimentation.",
      category: "Science",
      gradeLevel: "Middle School",
      resourceType: "Interactive",
      fileUrl: null,
      thumbnailUrl: null,
      fileSize: "5.1 MB",
      mimeType: "application/pdf",
      contributorId: "c2",
      upvotes: "98",
      downvotes: "2",
      views: "1234",
      downloads: "312",
      tags: "science,lab,experiments,scientific method",
      isPublished: "true",
      isFeatured: "false",
      createdAt: new Date("2024-11-10"),
      updatedAt: new Date("2024-11-10"),
      contributor: mockContributors[1],
    },
    {
      id: "r3",
      title: "World War II: Causes and Consequences",
      description: "An in-depth exploration of the events leading to WWII and its lasting impact on global politics and society.",
      category: "History",
      gradeLevel: "High School",
      resourceType: "Presentation",
      fileUrl: null,
      thumbnailUrl: null,
      fileSize: "12.3 MB",
      mimeType: "application/vnd.ms-powerpoint",
      contributorId: "c3",
      upvotes: "76",
      downvotes: "1",
      views: "892",
      downloads: "234",
      tags: "history,wwii,world war,politics",
      isPublished: "true",
      isFeatured: "false",
      createdAt: new Date("2024-11-05"),
      updatedAt: new Date("2024-11-05"),
      contributor: mockContributors[2],
    },
    {
      id: "r4",
      title: "Python Programming for Beginners",
      description: "Start your coding journey with this beginner-friendly introduction to Python programming concepts.",
      category: "Computer Science",
      gradeLevel: "High School",
      resourceType: "Video",
      fileUrl: null,
      thumbnailUrl: null,
      fileSize: "156 MB",
      mimeType: "video/mp4",
      contributorId: "c1",
      upvotes: "203",
      downvotes: "5",
      views: "3421",
      downloads: "1102",
      tags: "programming,python,coding,beginner",
      isPublished: "true",
      isFeatured: "true",
      createdAt: new Date("2024-11-01"),
      updatedAt: new Date("2024-11-01"),
      contributor: mockContributors[0],
    },
    {
      id: "r5",
      title: "Algebra Basics: Equations and Inequalities",
      description: "Master the fundamentals of algebraic equations and inequalities with practice problems and solutions.",
      category: "Mathematics",
      gradeLevel: "Middle School",
      resourceType: "Worksheet",
      fileUrl: null,
      thumbnailUrl: null,
      fileSize: "1.2 MB",
      mimeType: "application/pdf",
      contributorId: "c4",
      upvotes: "54",
      downvotes: "2",
      views: "678",
      downloads: "189",
      tags: "algebra,equations,math,practice",
      isPublished: "true",
      isFeatured: "false",
      createdAt: new Date("2024-10-28"),
      updatedAt: new Date("2024-10-28"),
      contributor: mockContributors[3],
    },
    {
      id: "r6",
      title: "Climate Change: Understanding Our Impact",
      description: "Explore the science behind climate change and what we can do to create a sustainable future.",
      category: "Science",
      gradeLevel: "High School",
      resourceType: "Article",
      fileUrl: null,
      thumbnailUrl: null,
      fileSize: "3.4 MB",
      mimeType: "application/pdf",
      contributorId: "c2",
      upvotes: "167",
      downvotes: "8",
      views: "2156",
      downloads: "567",
      tags: "climate,environment,science,sustainability",
      isPublished: "true",
      isFeatured: "true",
      createdAt: new Date("2024-10-25"),
      updatedAt: new Date("2024-10-25"),
      contributor: mockContributors[1],
    },
    {
      id: "r7",
      title: "Ancient Civilizations: Egypt and Mesopotamia",
      description: "Journey through time to discover the wonders of ancient Egypt and Mesopotamia.",
      category: "History",
      gradeLevel: "Elementary",
      resourceType: "Interactive",
      fileUrl: null,
      thumbnailUrl: null,
      fileSize: "8.7 MB",
      mimeType: "application/pdf",
      contributorId: "c3",
      upvotes: "89",
      downvotes: "1",
      views: "1023",
      downloads: "298",
      tags: "history,ancient,egypt,mesopotamia",
      isPublished: "true",
      isFeatured: "false",
      createdAt: new Date("2024-10-20"),
      updatedAt: new Date("2024-10-20"),
      contributor: mockContributors[2],
    },
    {
      id: "r8",
      title: "Data Structures and Algorithms",
      description: "Advanced computer science concepts for university students preparing for technical interviews.",
      category: "Computer Science",
      gradeLevel: "University",
      resourceType: "Lesson Plan",
      fileUrl: null,
      thumbnailUrl: null,
      fileSize: "4.5 MB",
      mimeType: "application/pdf",
      contributorId: "c1",
      upvotes: "234",
      downvotes: "4",
      views: "4521",
      downloads: "1876",
      tags: "algorithms,data structures,cs,interview",
      isPublished: "true",
      isFeatured: "true",
      createdAt: new Date("2024-10-15"),
      updatedAt: new Date("2024-10-15"),
      contributor: mockContributors[0],
    },
  ];

  // Apply filters
  let filtered = [...mockResources];

  if (input.category && input.category !== "All") {
    filtered = filtered.filter((r) => r.category === input.category);
  }

  if (input.gradeLevel && input.gradeLevel !== "All") {
    filtered = filtered.filter((r) => r.gradeLevel === input.gradeLevel);
  }

  if (input.search) {
    const searchLower = input.search.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.title.toLowerCase().includes(searchLower) ||
        r.description?.toLowerCase().includes(searchLower) ||
        r.tags?.toLowerCase().includes(searchLower)
    );
  }

  // Apply sorting
  switch (input.sortBy) {
    case "popular":
      filtered.sort((a, b) => parseInt(b.views || "0") - parseInt(a.views || "0"));
      break;
    case "highest_rated":
      filtered.sort((a, b) => parseInt(b.upvotes || "0") - parseInt(a.upvotes || "0"));
      break;
    case "newest":
    default:
      filtered.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  // Apply pagination
  const startIndex = input.cursor
    ? filtered.findIndex((r) => r.id === input.cursor) + 1
    : 0;
  const items = filtered.slice(startIndex, startIndex + input.limit);
  const hasMore = startIndex + input.limit < filtered.length;

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
  };
}

function getMockResourceById(id: string) {
  const result = getMockResources({ limit: 50, sortBy: "newest" });
  return result.items.find((r) => r.id === id) || null;
}

import { Link } from "wouter";
import type { RouterOutputs } from "../lib/trpc";

// Infer the type from the router directly for perfect type safety
type Resource = RouterOutputs["resources"]["getAll"]["items"][number];

// Resource type icons mapping
const resourceTypeIcons: Record<string, string> = {
  "Lesson Plan": "📝",
  "Worksheet": "📋",
  "Video": "🎬",
  "Interactive": "🎮",
  "Assessment": "✅",
  "Presentation": "📊",
  "Article": "📰",
  "Other": "📚",
};

export function ResourceCard({ resource }: { resource: Resource }) {
  const upvotes = parseInt(resource.upvotes || "0", 10);
  const views = parseInt(resource.views || "0", 10);

  return (
    <Link
      href={`/resource/${resource.id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-black/40 backdrop-blur-md transition-all duration-300 hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]"
    >
      {/* Thumbnail / Gradient Placeholder */}
      <div className="aspect-video w-full overflow-hidden bg-slate-800">
        {resource.thumbnailUrl ? (
          <img
            src={resource.thumbnailUrl}
            alt={resource.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
            <span className="text-5xl opacity-50">
              {resourceTypeIcons[resource.resourceType] || "📚"}
            </span>
          </div>
        )}

        {/* Overlay Badges */}
        <div className="absolute top-2 right-2 flex gap-1">
          <span className="rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-cyan-400 backdrop-blur">
            {resource.category}
          </span>
        </div>

        {/* Grade Level Badge */}
        <div className="absolute top-2 left-2">
          <span className="rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-slate-300 backdrop-blur">
            {resource.gradeLevel}
          </span>
        </div>

        {/* Resource Type Badge */}
        <div className="absolute bottom-2 left-2">
          <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-xs font-medium text-cyan-300 backdrop-blur border border-cyan-500/30">
            {resource.resourceType}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-lg font-bold text-white transition-colors group-hover:text-cyan-400">
          {resource.title}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm text-slate-400">
          {resource.description}
        </p>

        {/* Footer Metadata */}
        <div className="mt-auto flex items-center justify-between pt-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                resource.contributor.level === "platinum"
                  ? "bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.5)]"
                  : resource.contributor.level === "gold"
                  ? "bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.5)]"
                  : resource.contributor.level === "silver"
                  ? "bg-slate-300"
                  : "bg-amber-600"
              }`}
            />
            <span className="truncate max-w-[120px]">{resource.contributor.name}</span>
          </div>
          <div className="flex gap-3">
            <span className="flex items-center gap-1" title="Upvotes">
              <svg
                className="h-3.5 w-3.5 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 15l7-7 7 7"
                />
              </svg>
              {formatNumber(upvotes)}
            </span>
            <span className="flex items-center gap-1" title="Views">
              <svg
                className="h-3.5 w-3.5 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              {formatNumber(views)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// Helper to format large numbers (e.g., 1500 -> 1.5K)
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return num.toString();
}

// Skeleton component for loading state
export function ResourceCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-black/40 backdrop-blur-md">
      {/* Thumbnail skeleton */}
      <div className="aspect-video w-full animate-pulse bg-white/5" />

      {/* Content skeleton */}
      <div className="flex flex-1 flex-col p-4">
        {/* Title skeleton */}
        <div className="h-6 w-3/4 animate-pulse rounded bg-white/5" />
        {/* Description skeleton */}
        <div className="mt-2 space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-white/5" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-white/5" />
        </div>

        {/* Footer skeleton */}
        <div className="mt-auto flex items-center justify-between pt-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-white/5" />
            <div className="h-3 w-20 animate-pulse rounded bg-white/5" />
          </div>
          <div className="flex gap-3">
            <div className="h-3 w-8 animate-pulse rounded bg-white/5" />
            <div className="h-3 w-8 animate-pulse rounded bg-white/5" />
          </div>
        </div>
      </div>
    </div>
  );
}

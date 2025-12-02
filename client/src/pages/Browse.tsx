import { useState, useEffect, Fragment } from "react";
import { Link } from "wouter";
import { Menu, X, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useDebounce } from "@/hooks/useDebounce";
import { useSearchParams } from "@/hooks/useSearchParams";
import { ResourceCard, ResourceCardSkeleton } from "@/components/ResourceCard";
import { Starfield } from "@/components/Starfield";

// Filter categories
const CATEGORIES = [
  "All",
  "Mathematics",
  "Science",
  "History",
  "Computer Science",
  "Language Arts",
  "Social Studies",
  "Arts",
  "Physical Education",
];

const GRADE_LEVELS = [
  "All",
  "Elementary",
  "Middle School",
  "High School",
  "University",
  "Professional",
];

const RESOURCE_TYPES = [
  "All",
  "Lesson Plan",
  "Worksheet",
  "Video",
  "Interactive",
  "Assessment",
  "Presentation",
  "Article",
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Most Popular" },
  { value: "highest_rated", label: "Highest Rated" },
] as const;

export default function Browse() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Extract Filters from URL or Default
  const search = searchParams.get("q") || "";
  const category = searchParams.get("category") || "All";
  const gradeLevel = searchParams.get("grade") || "All";
  const resourceType = searchParams.get("type") || "All";
  const sortBy = (searchParams.get("sort") as "newest" | "popular" | "highest_rated") || "newest";

  // Local state for search input to allow debouncing
  const [localSearch, setLocalSearch] = useState(search);
  const debouncedSearch = useDebounce(localSearch, 500);

  // Sync Debounced Search to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (debouncedSearch) {
      params.set("q", debouncedSearch);
    } else {
      params.delete("q");
    }
    setSearchParams(params, { replace: true });
  }, [debouncedSearch]);

  // tRPC Infinite Query
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.resources.getAll.useInfiniteQuery(
    {
      limit: 12,
      search: debouncedSearch || undefined,
      category: category !== "All" ? category : undefined,
      gradeLevel: gradeLevel !== "All" ? gradeLevel : undefined,
      resourceType: resourceType !== "All" ? resourceType : undefined,
      sortBy,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      refetchOnWindowFocus: false,
    }
  );

  // Filter Handlers
  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === "All") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    setSearchParams(params);
  };

  // Clear all filters
  const clearFilters = () => {
    setLocalSearch("");
    setSearchParams(new URLSearchParams());
  };

  // Check if any filters are active
  const hasActiveFilters =
    search || category !== "All" || gradeLevel !== "All" || resourceType !== "All";

  // Flatten pages into items
  const items = data?.pages.flatMap((page) => page.items) || [];

  return (
    <div className="min-h-screen flex flex-col relative bg-slate-950">
      <Starfield />

      {/* Navigation */}
      <nav className="border-b border-white/10 backdrop-blur-md sticky top-0 z-50 bg-slate-950/80">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 sm:gap-3">
            <img
              src="/astro-ai-logo.png"
              alt="Apex Commons"
              className="h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0"
            />
            <div className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent whitespace-nowrap">
              Apex Commons
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="desktop-nav items-center gap-6">
            <Link
              href="/browse"
              className="text-sm font-medium text-cyan-400 transition-colors"
            >
              Browse
            </Link>
            <Link
              href="/features"
              className="text-sm font-medium text-slate-300 hover:text-cyan-400 transition-colors"
            >
              Technical Specs
            </Link>
            <Link
              href="/pricing"
              className="text-sm font-medium text-slate-300 hover:text-cyan-400 transition-colors"
            >
              Roadmap
            </Link>
            <Link
              href="/about"
              className="text-sm font-medium text-slate-300 hover:text-cyan-400 transition-colors"
            >
              Mission
            </Link>
            <a href="/#waitlist">
              <Button
                size="sm"
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500"
              >
                Join Waitlist
              </Button>
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="mobile-menu-btn p-2 hover:bg-white/10 rounded-md transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            type="button"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6 text-cyan-400" />
            ) : (
              <Menu className="w-6 h-6 text-cyan-400" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="mobile-nav border-t border-white/10 bg-slate-950/95 backdrop-blur-md w-full">
            <div className="container py-4 flex flex-col gap-4">
              <Link
                href="/browse"
                className="text-sm font-medium text-cyan-400 py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Browse
              </Link>
              <Link
                href="/features"
                className="text-sm font-medium text-slate-300 hover:text-cyan-400 py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Technical Specs
              </Link>
              <Link
                href="/pricing"
                className="text-sm font-medium text-slate-300 hover:text-cyan-400 py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Roadmap
              </Link>
              <Link
                href="/about"
                className="text-sm font-medium text-slate-300 hover:text-cyan-400 py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Mission
              </Link>
              <a href="/#waitlist" onClick={() => setMobileMenuOpen(false)}>
                <Button
                  size="sm"
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600"
                >
                  Join Waitlist
                </Button>
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-1 pt-8 pb-20">
        <div className="container mx-auto px-4">
          {/* Header & Search */}
          <div className="mb-12 text-center">
            <h1 className="mb-4 text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
              Public Knowledge Library
            </h1>
            <p className="text-slate-400 mb-8 max-w-2xl mx-auto">
              Open educational resources curated by the community. Discover
              lesson plans, worksheets, videos, and more.
            </p>

            {/* Search Bar */}
            <div className="relative mx-auto max-w-2xl">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Search resources..."
                className="w-full rounded-full border border-white/10 bg-white/5 pl-14 pr-6 py-4 text-white placeholder-slate-500 backdrop-blur focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all"
              />
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="mb-8 rounded-xl border border-white/5 bg-white/5 p-4 backdrop-blur">
            {/* Desktop Filters */}
            <div className="hidden md:flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-4">
                {/* Category Filter */}
                <select
                  value={category}
                  onChange={(e) => updateFilter("category", e.target.value)}
                  className="rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none cursor-pointer"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat === "All" ? "All Categories" : cat}
                    </option>
                  ))}
                </select>

                {/* Grade Level Filter */}
                <select
                  value={gradeLevel}
                  onChange={(e) => updateFilter("grade", e.target.value)}
                  className="rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none cursor-pointer"
                >
                  {GRADE_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level === "All" ? "All Levels" : level}
                    </option>
                  ))}
                </select>

                {/* Resource Type Filter */}
                <select
                  value={resourceType}
                  onChange={(e) => updateFilter("type", e.target.value)}
                  className="rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none cursor-pointer"
                >
                  {RESOURCE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type === "All" ? "All Types" : type}
                    </option>
                  ))}
                </select>

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-slate-400 hover:text-cyan-400 transition-colors"
                  >
                    Clear filters
                  </button>
                )}
              </div>

              {/* Sort */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => updateFilter("sort", e.target.value)}
                  className="rounded-lg border-none bg-transparent py-2 text-sm font-medium text-cyan-400 focus:ring-0 cursor-pointer"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Mobile Filter Toggle */}
            <div className="md:hidden">
              <button
                onClick={() => setFiltersOpen(!filtersOpen)}
                className="flex items-center gap-2 text-sm text-slate-300"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {hasActiveFilters && (
                  <span className="ml-1 h-2 w-2 rounded-full bg-cyan-400" />
                )}
              </button>

              {/* Mobile Filters Expanded */}
              {filtersOpen && (
                <div className="mt-4 space-y-4">
                  <select
                    value={category}
                    onChange={(e) => updateFilter("category", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-sm text-white"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat === "All" ? "All Categories" : cat}
                      </option>
                    ))}
                  </select>

                  <select
                    value={gradeLevel}
                    onChange={(e) => updateFilter("grade", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-sm text-white"
                  >
                    {GRADE_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level === "All" ? "All Levels" : level}
                      </option>
                    ))}
                  </select>

                  <select
                    value={resourceType}
                    onChange={(e) => updateFilter("type", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-sm text-white"
                  >
                    {RESOURCE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type === "All" ? "All Types" : type}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center justify-between">
                    <select
                      value={sortBy}
                      onChange={(e) => updateFilter("sort", e.target.value)}
                      className="rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-sm text-white"
                    >
                      {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>

                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="text-sm text-slate-400 hover:text-cyan-400"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Results Count */}
          {!isLoading && (
            <p className="mb-6 text-sm text-slate-400">
              {items.length === 0
                ? "No resources found"
                : `Showing ${items.length} resource${items.length !== 1 ? "s" : ""}`}
              {hasNextPage && " (more available)"}
            </p>
          )}

          {/* Resource Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {isLoading ? (
              // Skeleton Loading State
              [...Array(8)].map((_, i) => <ResourceCardSkeleton key={i} />)
            ) : items.length === 0 ? (
              // Empty State
              <div className="col-span-full py-20 text-center">
                <div className="mb-4 text-6xl opacity-50">
                  <Search className="mx-auto h-16 w-16 text-slate-600" />
                </div>
                <h3 className="text-xl font-bold text-white">No resources found</h3>
                <p className="text-slate-400 mt-2">
                  Try adjusting your filters or search query.
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="mt-4 text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              // Data Render
              data?.pages.map((page, pageIndex) => (
                <Fragment key={pageIndex}>
                  {page.items.map((resource) => (
                    <ResourceCard key={resource.id} resource={resource} />
                  ))}
                </Fragment>
              ))
            )}
          </div>

          {/* Load More Trigger */}
          {hasNextPage && (
            <div className="mt-12 text-center">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-3 font-bold text-white transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] disabled:opacity-50 disabled:hover:scale-100"
              >
                {isFetchingNextPage ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Loading...
                  </span>
                ) : (
                  "Load More Resources"
                )}
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 mt-auto bg-slate-950/80 backdrop-blur">
        <div className="container">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <img
                  src="/astro-ai-logo.png"
                  alt="Apex Commons"
                  className="h-6 w-6"
                />
                <div className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
                  Apex Commons
                </div>
              </div>
              <p className="text-sm text-slate-400">
                Open educational resources for everyone.
              </p>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold text-white">Library</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <Link
                    href="/browse"
                    className="hover:text-cyan-400 transition-colors"
                  >
                    Browse Resources
                  </Link>
                </li>
                <li>
                  <Link
                    href="/contribute"
                    className="hover:text-cyan-400 transition-colors"
                  >
                    Contribute
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold text-white">Company</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <Link
                    href="/about"
                    className="hover:text-cyan-400 transition-colors"
                  >
                    About
                  </Link>
                </li>
                <li>
                  <Link
                    href="/contact"
                    className="hover:text-cyan-400 transition-colors"
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold text-white">Legal</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <Link
                    href="/privacy"
                    className="hover:text-cyan-400 transition-colors"
                  >
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms"
                    className="hover:text-cyan-400 transition-colors"
                  >
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-white/10 text-center text-sm text-slate-400">
            <p>&copy; 2025 Apex Commons. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

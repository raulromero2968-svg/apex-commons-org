import { useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import {
  Menu,
  X,
  Download,
  ThumbsUp,
  ThumbsDown,
  Eye,
  Calendar,
  FileText,
  ArrowLeft,
  Share2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Starfield } from "@/components/Starfield";
import { formatDistanceToNow } from "date-fns";

// Resource type icons mapping
const resourceTypeIcons: Record<string, string> = {
  "Lesson Plan": "📝",
  Worksheet: "📋",
  Video: "🎬",
  Interactive: "🎮",
  Assessment: "✅",
  Presentation: "📊",
  Article: "📰",
  Other: "📚",
};

export default function ResourceDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [voteState, setVoteState] = useState<"up" | "down" | null>(null);

  const resourceId = params.id || "";

  // Fetch resource details
  const {
    data: resource,
    isLoading,
    error,
  } = trpc.resources.getById.useQuery(
    { id: resourceId },
    { enabled: !!resourceId }
  );

  // Vote mutation
  const voteMutation = trpc.resources.vote.useMutation({
    onSuccess: () => {
      // Refetch resource to get updated counts
    },
  });

  // Download tracking mutation
  const trackDownload = trpc.resources.trackDownload.useMutation();

  // Handle vote
  const handleVote = (type: "up" | "down") => {
    if (!isAuthenticated) {
      // Redirect to login or show message
      return;
    }
    if (voteState === type) return; // Already voted this way

    setVoteState(type);
    voteMutation.mutate({ resourceId, voteType: type });
  };

  // Handle download
  const handleDownload = () => {
    if (resource?.fileUrl) {
      trackDownload.mutate({ resourceId });
      window.open(resource.fileUrl, "_blank");
    }
  };

  // Handle share
  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: resource?.title,
          text: resource?.description || "",
          url,
        });
      } catch {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(url);
      // Could show a toast here
    }
  };

  // Format numbers
  const formatNumber = (num: string | number | null | undefined): string => {
    const n = typeof num === "string" ? parseInt(num, 10) : num || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    return n.toString();
  };

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
              className="text-sm font-medium text-slate-300 hover:text-cyan-400 transition-colors"
            >
              Browse
            </Link>
            <Link
              href="/contribute"
              className="text-sm font-medium text-slate-300 hover:text-cyan-400 transition-colors"
            >
              Contribute
            </Link>
            <Link
              href="/about"
              className="text-sm font-medium text-slate-300 hover:text-cyan-400 transition-colors"
            >
              Mission
            </Link>
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
                className="text-sm font-medium text-slate-300 hover:text-cyan-400 py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Browse
              </Link>
              <Link
                href="/contribute"
                className="text-sm font-medium text-slate-300 hover:text-cyan-400 py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Contribute
              </Link>
              <Link
                href="/about"
                className="text-sm font-medium text-slate-300 hover:text-cyan-400 py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Mission
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-1 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Back Button */}
          <button
            onClick={() => navigate("/browse")}
            className="mb-6 flex items-center gap-2 text-slate-400 hover:text-cyan-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Library
          </button>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-8 text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Resource Not Found</h2>
              <p className="text-slate-400 mb-4">
                This resource may have been removed or doesn't exist.
              </p>
              <Link href="/browse">
                <Button className="bg-gradient-to-r from-cyan-500 to-blue-600">
                  Browse Library
                </Button>
              </Link>
            </div>
          )}

          {/* Resource Content */}
          {resource && (
            <div className="space-y-8">
              {/* Header Section */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                {/* Badges */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-sm font-medium text-cyan-400 border border-cyan-500/30">
                    {resource.category}
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-slate-300">
                    {resource.gradeLevel}
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-slate-300">
                    {resource.resourceType}
                  </span>
                </div>

                {/* Title */}
                <h1 className="text-3xl font-bold text-white mb-4">{resource.title}</h1>

                {/* Description */}
                <p className="text-slate-400 text-lg leading-relaxed mb-6">
                  {resource.description}
                </p>

                {/* Tags */}
                {resource.tags && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {resource.tags.split(",").map((tag, i) => (
                      <span
                        key={i}
                        className="rounded bg-white/5 px-2 py-1 text-xs text-slate-400"
                      >
                        #{tag.trim()}
                      </span>
                    ))}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-4">
                  {resource.fileUrl && (
                    <Button
                      onClick={handleDownload}
                      className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download Resource
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={handleShare}
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    <Share2 className="mr-2 h-4 w-4" />
                    Share
                  </Button>
                </div>
              </div>

              {/* Stats & Voting Section */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Engagement Stats */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                  <h2 className="text-lg font-semibold text-white mb-4">Engagement</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-cyan-500/20 p-2">
                        <Eye className="h-5 w-5 text-cyan-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">
                          {formatNumber(resource.views)}
                        </p>
                        <p className="text-sm text-slate-400">Views</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-green-500/20 p-2">
                        <Download className="h-5 w-5 text-green-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">
                          {formatNumber(resource.downloads)}
                        </p>
                        <p className="text-sm text-slate-400">Downloads</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-purple-500/20 p-2">
                        <ThumbsUp className="h-5 w-5 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">
                          {formatNumber(resource.upvotes)}
                        </p>
                        <p className="text-sm text-slate-400">Upvotes</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-white/10 p-2">
                        <Calendar className="h-5 w-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {resource.createdAt
                            ? formatDistanceToNow(new Date(resource.createdAt), {
                                addSuffix: true,
                              })
                            : "Unknown"}
                        </p>
                        <p className="text-sm text-slate-400">Published</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Voting Section */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                  <h2 className="text-lg font-semibold text-white mb-4">Rate this Resource</h2>
                  <p className="text-slate-400 text-sm mb-4">
                    Help others find quality resources by voting.
                  </p>
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleVote("up")}
                      disabled={!isAuthenticated || voteMutation.isPending}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-3 font-medium transition-all ${
                        voteState === "up"
                          ? "bg-green-500/20 text-green-400 border border-green-500/50"
                          : "bg-white/5 text-slate-300 hover:bg-green-500/10 hover:text-green-400 border border-white/10"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <ThumbsUp className="h-5 w-5" />
                      Upvote
                    </button>
                    <button
                      onClick={() => handleVote("down")}
                      disabled={!isAuthenticated || voteMutation.isPending}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-3 font-medium transition-all ${
                        voteState === "down"
                          ? "bg-red-500/20 text-red-400 border border-red-500/50"
                          : "bg-white/5 text-slate-300 hover:bg-red-500/10 hover:text-red-400 border border-white/10"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <ThumbsDown className="h-5 w-5" />
                      Downvote
                    </button>
                  </div>
                  {!isAuthenticated && (
                    <p className="mt-3 text-xs text-slate-500 text-center">
                      Sign in to vote on resources
                    </p>
                  )}
                </div>
              </div>

              {/* Contributor Section */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <h2 className="text-lg font-semibold text-white mb-4">Contributor</h2>
                <div className="flex items-center gap-4">
                  <div
                    className={`h-12 w-12 rounded-full flex items-center justify-center text-2xl ${
                      resource.contributor.level === "platinum"
                        ? "bg-purple-500/20 ring-2 ring-purple-400"
                        : resource.contributor.level === "gold"
                        ? "bg-yellow-500/20 ring-2 ring-yellow-400"
                        : resource.contributor.level === "silver"
                        ? "bg-slate-400/20 ring-2 ring-slate-400"
                        : "bg-amber-600/20 ring-2 ring-amber-600"
                    }`}
                  >
                    {resourceTypeIcons[resource.resourceType] || "📚"}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{resource.contributor.name}</p>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-medium capitalize ${
                          resource.contributor.level === "platinum"
                            ? "text-purple-400"
                            : resource.contributor.level === "gold"
                            ? "text-yellow-400"
                            : resource.contributor.level === "silver"
                            ? "text-slate-300"
                            : "text-amber-600"
                        }`}
                      >
                        {resource.contributor.level} Contributor
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* File Info Section */}
              {(resource.fileSize || resource.mimeType) && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                  <h2 className="text-lg font-semibold text-white mb-4">File Information</h2>
                  <div className="flex items-center gap-4">
                    <div className="rounded-lg bg-white/10 p-3">
                      <FileText className="h-6 w-6 text-slate-400" />
                    </div>
                    <div>
                      {resource.fileSize && (
                        <p className="text-white font-medium">{resource.fileSize}</p>
                      )}
                      {resource.mimeType && (
                        <p className="text-sm text-slate-400">{resource.mimeType}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 mt-auto bg-slate-950/80 backdrop-blur">
        <div className="container text-center text-sm text-slate-400">
          <p>&copy; 2025 Apex Commons. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

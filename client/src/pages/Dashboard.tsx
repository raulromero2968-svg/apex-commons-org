import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Starfield } from "@/components/Starfield";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function Dashboard() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: myResources, isLoading: loadingResources } = trpc.resource.getMyResources.useQuery();
  const { data: history, isLoading: loadingHistory } = trpc.reputation.getHistory.useQuery({ limit: 5 });
  const { data: stats, isLoading: loadingStats } = trpc.reputation.getMyStats.useQuery();

  if (loadingResources || loadingHistory || loadingStats) {
    return (
      <div className="min-h-screen bg-slate-950 relative">
        <Starfield />
        <div className="pt-24 flex justify-center">
          <div className="animate-spin text-4xl">&#128160;</div>
        </div>
      </div>
    );
  }

  // Calculate Aggregates for the "Stats-First" Layout
  const totalViews = myResources?.reduce((acc, curr) => acc + (curr.viewCount ?? 0), 0) || 0;
  const totalDownloads = myResources?.reduce((acc, curr) => acc + (curr.downloadCount ?? 0), 0) || 0;
  const pendingCount = myResources?.filter(r => r.status === "pending").length || 0;

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
              href="/dashboard"
              className="text-sm font-medium text-cyan-400 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/contribute"
              className="text-sm font-medium text-slate-300 hover:text-cyan-400 transition-colors"
            >
              Contribute
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
                className="text-sm font-medium text-slate-300 hover:text-cyan-400 py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Browse
              </Link>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-cyan-400 py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                href="/contribute"
                className="text-sm font-medium text-slate-300 hover:text-cyan-400 py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Contribute
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
        <div className="container mx-auto max-w-6xl px-4">
          {/* Header & Identity */}
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h1 className="text-3xl font-bold text-white">Teacher Dashboard</h1>
              <p className="text-slate-400">Manage your contributions and track your impact.</p>
            </div>
            <Link href="/contribute">
              <Button className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2 font-bold text-white shadow-lg transition-transform hover:scale-105">
                + New Contribution
              </Button>
            </Link>
          </div>

          {/* Stats Grid */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Reputation Card */}
            <div className="rounded-xl border border-white/10 bg-gradient-to-br from-purple-900/40 to-black p-6 backdrop-blur">
              <div className="text-sm font-bold text-purple-400 uppercase tracking-wider">Reputation</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white">{stats?.reputationCredits ?? 0}</span>
                <span className="text-xs text-slate-400">RC</span>
              </div>
              <div className="mt-2 text-xs text-purple-300">
                Level: {(stats?.contributorLevel ?? "bronze").toUpperCase()}
              </div>
            </div>

            {/* Impact Card */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="text-sm font-bold text-cyan-400 uppercase tracking-wider">Total Views</div>
              <div className="mt-2 text-3xl font-bold text-white">{totalViews.toLocaleString()}</div>
              <div className="mt-2 text-xs text-slate-400">Across all uploads</div>
            </div>

            {/* Downloads Card */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="text-sm font-bold text-green-400 uppercase tracking-wider">Downloads</div>
              <div className="mt-2 text-3xl font-bold text-white">{totalDownloads.toLocaleString()}</div>
              <div className="mt-2 text-xs text-slate-400">Total materials saved</div>
            </div>

            {/* Pending Card */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="text-sm font-bold text-orange-400 uppercase tracking-wider">Pending Review</div>
              <div className="mt-2 text-3xl font-bold text-white">{pendingCount}</div>
              <div className="mt-2 text-xs text-slate-400">Awaiting moderation</div>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_350px]">
            {/* Main Column: My Resources */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <h3 className="mb-6 text-xl font-bold text-white">My Contributions</h3>

              {myResources?.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-slate-400">You haven't uploaded any resources yet.</p>
                  <Link href="/contribute" className="mt-4 inline-block text-cyan-400 hover:underline">
                    Get started today
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-white/10 text-slate-500">
                      <tr>
                        <th className="pb-3 font-medium">Title</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium">Stats</th>
                        <th className="pb-3 font-medium text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {myResources?.map((resource) => (
                        <tr key={resource.id} className="group transition-colors hover:bg-white/5">
                          <td className="py-4 pr-4">
                            <Link href={`/resource/${resource.id}`} className="font-medium text-white hover:text-cyan-400">
                              {resource.title}
                            </Link>
                            <div className="text-xs text-slate-500">{resource.category} - {resource.resourceType}</div>
                          </td>
                          <td className="py-4">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
                              ${resource.status === 'approved' ? 'bg-green-500/10 text-green-400' :
                                resource.status === 'pending' ? 'bg-orange-500/10 text-orange-400' :
                                'bg-red-500/10 text-red-400'}`}>
                              {resource.status.charAt(0).toUpperCase() + resource.status.slice(1)}
                            </span>
                          </td>
                          <td className="py-4">
                            <div className="flex gap-3 text-slate-400">
                              <span className="flex items-center gap-1">&#128065; {resource.viewCount}</span>
                              <span className="flex items-center gap-1">&#11015; {resource.downloadCount}</span>
                            </div>
                          </td>
                          <td className="py-4 text-right text-slate-500">
                            {resource.createdAt ? new Date(resource.createdAt).toLocaleDateString() : "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Sidebar: Reputation History */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <h3 className="mb-6 text-xl font-bold text-white">Recent Activity</h3>
              <div className="space-y-6">
                {history?.map((tx) => (
                  <div key={tx.id} className="flex gap-4">
                    <div className={`mt-1 flex h-8 w-8 flex-none items-center justify-center rounded-full border
                      ${tx.amount > 0 ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white capitalize">
                        {tx.reason.replace(/_/g, ' ')}
                      </div>
                      <div className="text-xs text-slate-500">
                        {tx.createdAt ? formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true }) : 'Just now'}
                      </div>
                    </div>
                  </div>
                ))}

                {history?.length === 0 && (
                  <p className="text-sm text-slate-500">No activity recorded yet.</p>
                )}
              </div>

              <div className="mt-8 border-t border-white/10 pt-6">
                <h4 className="mb-2 text-xs font-bold uppercase text-slate-500">Next Milestone</h4>
                <div className="mb-1 flex justify-between text-sm text-white">
                  <span>{stats?.nextLevel ? stats.nextLevel.charAt(0).toUpperCase() + stats.nextLevel.slice(1) : "Max"} Level</span>
                  <span>{stats?.rcToNext ?? 0} RC to go</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-purple-500 transition-all"
                    style={{ width: `${stats?.progressToNext ?? 100}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {stats?.nextLevel
                    ? `Earn ${stats.rcToNext} more RC to level up.`
                    : "You've reached the highest level!"}
                </p>
              </div>
            </div>
          </div>
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
                  <Link href="/browse" className="hover:text-cyan-400 transition-colors">
                    Browse Resources
                  </Link>
                </li>
                <li>
                  <Link href="/contribute" className="hover:text-cyan-400 transition-colors">
                    Contribute
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold text-white">Company</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <Link href="/about" className="hover:text-cyan-400 transition-colors">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-cyan-400 transition-colors">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold text-white">Legal</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <Link href="/privacy" className="hover:text-cyan-400 transition-colors">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-cyan-400 transition-colors">
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

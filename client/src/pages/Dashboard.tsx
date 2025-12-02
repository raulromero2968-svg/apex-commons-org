import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { Link } from 'wouter';
import { formatDistanceToNow } from 'date-fns';

export function Dashboard() {
  const { user, loading: authLoading, isAuthenticated } = useAuth({ redirectOnUnauthenticated: true });
  const { data: myResources, isLoading: loadingResources } = trpc.resource.getMyResources.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  const { data: history, isLoading: loadingHistory } = trpc.reputation.getHistory.useQuery(
    { limit: 5 },
    { enabled: isAuthenticated }
  );
  const { data: stats, isLoading: loadingStats } = trpc.reputation.getMyStats.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  if (authLoading || loadingResources || loadingHistory || loadingStats) {
    return (
      <div className="min-h-screen pt-24 flex justify-center">
        <div className="animate-spin text-4xl">&#128160;</div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null; // Will redirect via useAuth
  }

  // Calculate Aggregates
  const totalViews = myResources?.reduce((acc, curr) => acc + curr.viewCount, 0) || 0;
  const totalDownloads = myResources?.reduce((acc, curr) => acc + curr.downloadCount, 0) || 0;
  const pendingCount = myResources?.filter(r => r.status === 'pending').length || 0;

  // User reputation info from stats
  const rc = stats?.reputationCredits ?? 0;
  const level = stats?.contributorLevel ?? 'newcomer';

  return (
    <div className="min-h-screen bg-slate-950 pt-24 pb-20">
      <div className="container mx-auto max-w-6xl px-4">

        {/* Header & Identity */}
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">Teacher Dashboard</h1>
            <p className="text-slate-400">Manage your contributions and track your impact.</p>
          </div>
          <Link
            href="/contribute"
            className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2 font-bold text-white shadow-lg transition-transform hover:scale-105 text-center"
          >
            + New Contribution
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Reputation Card */}
          <div className="rounded-xl border border-white/10 bg-gradient-to-br from-purple-900/40 to-black p-6 backdrop-blur">
            <div className="text-sm font-bold text-purple-400 uppercase tracking-wider">Reputation</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">{rc.toLocaleString()}</span>
              <span className="text-xs text-slate-400">RC</span>
            </div>
            <div className="mt-2 text-xs text-purple-300">
              Level: {level.toUpperCase()}
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
                <Link href="/contribute" className="mt-4 inline-block text-cyan-400 hover:underline">Get started today</Link>
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
                          <div className="text-xs text-slate-500">{resource.category} &bull; {resource.resourceType}</div>
                        </td>
                        <td className="py-4">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
                            ${resource.status === 'approved' ? 'bg-green-500/10 text-green-400' :
                              resource.status === 'pending' ? 'bg-orange-500/10 text-orange-400' :
                              resource.status === 'draft' ? 'bg-slate-500/10 text-slate-400' :
                              'bg-red-500/10 text-red-400'}`}>
                            {resource.status.charAt(0).toUpperCase() + resource.status.slice(1)}
                          </span>
                        </td>
                        <td className="py-4">
                          <div className="flex gap-3 text-slate-400">
                            <span className="flex items-center gap-1">&#128065; {resource.viewCount}</span>
                            <span className="flex items-center gap-1">&#11015;&#65039; {resource.downloadCount}</span>
                          </div>
                        </td>
                        <td className="py-4 text-right text-slate-500">
                          {new Date(resource.createdAt).toLocaleDateString()}
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

              {(!history || history.length === 0) && (
                <p className="text-sm text-slate-500">No activity recorded yet.</p>
              )}
            </div>

            {/* Progress to Next Level */}
            {stats?.nextLevel && (
              <div className="mt-8 border-t border-white/10 pt-6">
                <h4 className="mb-2 text-xs font-bold uppercase text-slate-500">Next Milestone</h4>
                <div className="mb-1 flex justify-between text-sm text-white">
                  <span>{stats.nextLevel.charAt(0).toUpperCase() + stats.nextLevel.slice(1)} Level</span>
                  <span>{stats.thresholds[stats.nextLevel as keyof typeof stats.thresholds]?.toLocaleString() ?? 0} RC</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-purple-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, stats.progressToNext)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {stats.rcToNext > 0
                    ? `Earn ${stats.rcToNext.toLocaleString()} more RC to level up.`
                    : 'Almost there!'}
                </p>
              </div>
            )}

            {/* Max level reached */}
            {!stats?.nextLevel && stats?.contributorLevel && (
              <div className="mt-8 border-t border-white/10 pt-6">
                <h4 className="mb-2 text-xs font-bold uppercase text-slate-500">Achievement</h4>
                <div className="flex items-center gap-2 text-sm text-white">
                  <span className="text-yellow-400">&#9733;</span>
                  <span>Maximum level achieved!</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  You've reached {stats.contributorLevel} status. Congratulations!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

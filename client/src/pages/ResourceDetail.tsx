import { Link, useParams } from 'wouter';
import { trpc } from '@/lib/trpc';
import { VoteButton } from '@/components/VoteButton';
import { ArrowLeft, Download, Eye, FileText, Video, FolderOpen } from 'lucide-react';

export default function ResourceDetail() {
  const params = useParams<{ id: string }>();
  const resourceId = parseInt(params.id || '0');

  const { data: resource, isLoading, error } = trpc.resources.getById.useQuery(
    { id: resourceId },
    { enabled: !!resourceId }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 pt-24 flex justify-center">
        <div className="animate-spin text-4xl text-cyan-400">
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
      </div>
    );
  }

  if (error || !resource) {
    return (
      <div className="min-h-screen bg-slate-950 pt-24 flex flex-col items-center justify-center gap-4">
        <div className="text-6xl">404</div>
        <h1 className="text-2xl font-bold text-white">Resource not found</h1>
        <p className="text-slate-400">The resource you're looking for doesn't exist or has been removed.</p>
        <Link href="/" className="mt-4 text-cyan-400 hover:text-cyan-300 flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </div>
    );
  }

  // Safe parsing of JSON fields if they come as strings
  const fileList = typeof resource.files === 'string' ? JSON.parse(resource.files) : resource.files;

  const getFileIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'pdf':
        return <FileText className="w-5 h-5 text-red-400" />;
      case 'video':
      case 'mp4':
      case 'mov':
        return <Video className="w-5 h-5 text-purple-400" />;
      default:
        return <FolderOpen className="w-5 h-5 text-cyan-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 pt-24 pb-20">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Back Navigation */}
        <Link href="/" className="mb-6 inline-flex items-center text-sm text-slate-400 hover:text-cyan-400 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Library
        </Link>

        <div className="grid gap-8 lg:grid-cols-[1fr_350px]">

          {/* Main Content Column */}
          <div className="space-y-8">
            {/* Header */}
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-400 border border-cyan-500/20">
                  {resource.category}
                </span>
                <span className="rounded-full bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-400 border border-purple-500/20">
                  {resource.gradeLevel}
                </span>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/20">
                  {resource.resourceType}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">{resource.title}</h1>
              <div className="flex flex-wrap items-center gap-2 text-slate-400 text-sm">
                <span>Contributed by</span>
                <span className="font-medium text-white">{resource.contributor?.name || 'Anonymous'}</span>
                <span className="px-2 hidden sm:inline">•</span>
                <span>{new Date(resource.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</span>
              </div>
            </div>

            {/* Thumbnail/Preview */}
            <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
              {resource.thumbnailUrl ? (
                <img
                  src={resource.thumbnailUrl}
                  alt={resource.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 to-black">
                  <div className="text-center">
                    <FileText className="w-16 h-16 text-slate-600 mx-auto mb-3" />
                    <span className="text-slate-500 text-sm">No preview available</span>
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8 backdrop-blur">
              <h3 className="text-xl font-bold text-white mb-4">About this Resource</h3>
              <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{resource.description}</p>
            </div>

            {/* Files Section */}
            {Array.isArray(fileList) && fileList.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8 backdrop-blur">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <Download className="w-5 h-5 text-cyan-400" />
                  Files & Downloads
                </h3>
                <div className="space-y-3">
                  {fileList.map((file: { name: string; url: string; size: number; type: string }, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 p-4 transition-all hover:border-cyan-500/30 hover:bg-black/40 group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-800">
                          {getFileIcon(file.type)}
                        </div>
                        <div>
                          <div className="font-medium text-white group-hover:text-cyan-400 transition-colors">
                            {file.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {formatFileSize(file.size)} • {file.type.toUpperCase()}
                          </div>
                        </div>
                      </div>
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-cyan-500/10 px-4 py-2 text-sm font-bold text-cyan-400 hover:bg-cyan-500/20 hover:scale-105 transition-all flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">Download</span>
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Voting Panel */}
            <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900 to-black p-6 text-center sticky top-28">
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">
                Community Rating
              </h3>
              <VoteButton
                resourceId={resource.id}
                initialUpvotes={resource.upvotes}
                initialDownvotes={resource.downvotes}
              />
              <div className="mt-6 border-t border-white/10 pt-6">
                <div className="flex items-center justify-center gap-2">
                  <Eye className="w-5 h-5 text-slate-400" />
                  <span className="text-2xl font-bold text-white">{formatCount(resource.views)}</span>
                  <span className="text-xs text-slate-500">Views</span>
                </div>
              </div>
            </div>

            {/* Metadata Card */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <h3 className="mb-4 text-lg font-bold text-white">Details</h3>
              <dl className="space-y-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Category</dt>
                  <dd className="text-white font-medium">{resource.category}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Grade Level</dt>
                  <dd className="text-white font-medium">{resource.gradeLevel}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Resource Type</dt>
                  <dd className="text-white font-medium">{resource.resourceType}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Status</dt>
                  <dd className="text-white font-medium capitalize">{resource.status}</dd>
                </div>
              </dl>
            </div>

            {/* Contributor Card */}
            {resource.contributor && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <h3 className="mb-4 text-lg font-bold text-white">Contributor</h3>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                    {resource.contributor.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <div className="font-medium text-white">{resource.contributor.name || 'Anonymous'}</div>
                    {resource.contributor.contributorLevel && (
                      <div className="text-xs text-slate-400 capitalize">
                        {resource.contributor.contributorLevel} Contributor
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Utility functions
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatCount(count: number): string {
  if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
  if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
  return count.toString();
}

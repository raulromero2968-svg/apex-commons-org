import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import clsx from 'clsx';

interface VoteButtonProps {
  resourceId: number;
  initialUpvotes: number;
  initialDownvotes: number;
  initialUserVote?: 'up' | 'down' | null;
}

export function VoteButton({
  resourceId,
  initialUpvotes,
  initialDownvotes,
  initialUserVote = null
}: VoteButtonProps) {
  // Local state for optimistic UI
  const [votes, setVotes] = useState({ up: initialUpvotes, down: initialDownvotes });
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(initialUserVote);

  const utils = trpc.useUtils();

  const mutation = trpc.resources.vote.useMutation({
    onMutate: async ({ voteType }) => {
      // 1. Cancel outgoing refetches
      await utils.resources.getById.cancel({ id: resourceId });

      // 2. Snapshot previous value
      const previousVote = userVote;
      const previousVotes = { ...votes };

      // 3. Optimistically update local state
      const isRemoving = previousVote === voteType;

      if (isRemoving) {
        // Clicking same button removes vote
        setUserVote(null);
        setVotes(prev => ({
          ...prev,
          [voteType === 'up' ? 'up' : 'down']: prev[voteType === 'up' ? 'up' : 'down'] - 1
        }));
      } else {
        // New vote (switching is blocked by backend)
        setUserVote(voteType);
        setVotes(prev => ({
          ...prev,
          [voteType === 'up' ? 'up' : 'down']: prev[voteType === 'up' ? 'up' : 'down'] + 1
        }));
      }

      return { previousVote, previousVotes };
    },
    onError: (err, _newVote, context) => {
      // Rollback on error
      if (context) {
        setUserVote(context.previousVote);
        setVotes(context.previousVotes);
      }
      console.error("Vote failed:", err.message);
    },
    onSettled: () => {
      // Sync with server truth
      utils.resources.getById.invalidate({ id: resourceId });
    }
  });

  const handleVote = (type: 'up' | 'down') => {
    // Prevent voting if already have opposite vote (backend restriction)
    if (userVote && userVote !== type) {
      console.warn("Remove your current vote first to change it.");
      return;
    }
    mutation.mutate({ resourceId, voteType: type });
  };

  const score = votes.up - votes.down;

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-white/5 p-3 backdrop-blur-sm border border-white/10">
      <button
        onClick={() => handleVote('up')}
        disabled={mutation.isPending}
        className={clsx(
          "rounded-lg p-2 transition-all hover:bg-cyan-500/20 disabled:opacity-50",
          userVote === 'up' ? "text-cyan-400 bg-cyan-500/10" : "text-slate-400"
        )}
        aria-label="Upvote"
      >
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>

      <span className={clsx(
        "text-xl font-bold",
        score > 0 ? "text-cyan-400" : score < 0 ? "text-red-400" : "text-white"
      )}>
        {score}
      </span>

      <button
        onClick={() => handleVote('down')}
        disabled={mutation.isPending}
        className={clsx(
          "rounded-lg p-2 transition-all hover:bg-red-500/20 disabled:opacity-50",
          userVote === 'down' ? "text-red-400 bg-red-500/10" : "text-slate-400"
        )}
        aria-label="Downvote"
      >
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
}

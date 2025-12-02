export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;

// Auth error messages
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
export const NOT_TEACHER_ERR_MSG = 'Teacher role required (10003)';
export const NOT_MODERATOR_ERR_MSG = 'Moderator role required (10004)';
export const INSUFFICIENT_RC_ERR_MSG = 'Insufficient Reputation Credits (10005)';

// RC (Reputation Credits) configuration
export const RC_CONFIG = {
  // Earning RC
  RESOURCE_SUBMITTED: 5,
  RESOURCE_APPROVED: 25,
  RESOURCE_UPVOTE_RECEIVED: 2,
  RESOURCE_DOWNVOTE_RECEIVED: -1,
  RESOURCE_DOWNLOAD: 1,
  PROPOSAL_CREATED: -50, // costs RC
  PROPOSAL_PASSED: 100,
  PROPOSAL_VOTE_CAST: 1,
  FLAG_SUBMITTED: 1,
  FLAG_UPHELD: 10,
  FLAG_DISMISSED: -5,
  DAILY_LOGIN: 1,

  // Requirements
  MIN_RC_TO_CREATE_PROPOSAL: 100,
  MIN_RC_TO_VOTE_ON_PROPOSAL: 10,
  MIN_RC_TO_FLAG: 5,
} as const;

// Contributor level thresholds
export const CONTRIBUTOR_LEVELS = {
  newcomer: { min: 0, max: 49 },
  contributor: { min: 50, max: 199 },
  trusted: { min: 200, max: 499 },
  expert: { min: 500, max: 999 },
  master: { min: 1000, max: Infinity },
} as const;

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

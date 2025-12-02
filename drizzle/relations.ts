import { relations } from "drizzle-orm";
import { users, resources, resourceVotes, rcTransactions, proposals, proposalVotes } from "./schema";

// User relations
export const usersRelations = relations(users, ({ many }) => ({
  resources: many(resources),
  votes: many(resourceVotes),
  rcTransactions: many(rcTransactions),
  proposals: many(proposals),
  proposalVotes: many(proposalVotes),
}));

// Resource relations
export const resourcesRelations = relations(resources, ({ one, many }) => ({
  contributor: one(users, {
    fields: [resources.contributorId],
    references: [users.id],
  }),
  votes: many(resourceVotes),
}));

// Resource Vote relations
export const resourceVotesRelations = relations(resourceVotes, ({ one }) => ({
  user: one(users, {
    fields: [resourceVotes.userId],
    references: [users.id],
  }),
  resource: one(resources, {
    fields: [resourceVotes.resourceId],
    references: [resources.id],
  }),
}));

// RC Transaction relations
export const rcTransactionsRelations = relations(rcTransactions, ({ one }) => ({
  user: one(users, {
    fields: [rcTransactions.userId],
    references: [users.id],
  }),
}));

// Proposal relations
export const proposalsRelations = relations(proposals, ({ one, many }) => ({
  author: one(users, {
    fields: [proposals.authorId],
    references: [users.id],
  }),
  votes: many(proposalVotes),
}));

// Proposal Vote relations
export const proposalVotesRelations = relations(proposalVotes, ({ one }) => ({
  user: one(users, {
    fields: [proposalVotes.userId],
    references: [users.id],
  }),
  proposal: one(proposals, {
    fields: [proposalVotes.proposalId],
    references: [proposals.id],
  }),
}));

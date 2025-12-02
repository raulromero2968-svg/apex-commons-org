import { relations } from "drizzle-orm";
import { users, resources, resourceVotes, rcTransactions } from "./schema";

// User relations
export const usersRelations = relations(users, ({ many }) => ({
  resources: many(resources),
  votes: many(resourceVotes),
  rcTransactions: many(rcTransactions),
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

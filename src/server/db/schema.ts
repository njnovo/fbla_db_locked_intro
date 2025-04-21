import { relations, sql } from "drizzle-orm";
// Use only mysql-core imports for everything
// import {
//   index,
//   int,
//   primaryKey,
//   text,
//   uniqueIndex,
//   varchar,
//   foreignKey,
//   mysqlTableCreator
// } from "drizzle-orm/mysql-core";

import { type AdapterAccount } from "next-auth/adapters";

// Import necessary functions from singlestore-core
import {
  int,
  text,
  varchar,
  // index, // Assuming not available/compatible
  // primaryKey, // Assuming not available/compatible for compound keys
  // uniqueIndex, // Assuming not available/compatible
  // foreignKey, // Assuming not available/compatible
  singlestoreTableCreator
} from "drizzle-orm/singlestore-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = singlestoreTableCreator((name) => `fbla_db_locked_intro_${name}`); 


// Uncommented original tables
export const randomTestTable = createTable("random_test_table", {
  id: varchar("id", { length: 255 })
    .notNull()
    .primaryKey(),
  name: varchar("name", { length: 255 }),
});

export const posts = createTable("post", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 256 }),
  createdById: varchar("created_by", { length: 255 })
    .notNull(), 
  createdAt: int("created_at")
    .notNull(),
  updatedAt: int("updatedAt"),
});

export const users = createTable("user", {
  id: varchar("id", { length: 255 })
    .notNull()
    .primaryKey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull(),
  emailVerified: int("email_verified"),
  image: varchar("image", { length: 255 }),
});

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  gameSaves: many(gameSaves),
}));

export const accounts = createTable("account", {
  userId: varchar("user_id", { length: 255 })
    .notNull(), 
  type: varchar("type", { length: 255 })
    .notNull(),
  provider: varchar("provider", { length: 255 }).notNull(),
  providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: int("expires_at"),
  token_type: varchar("token_type", { length: 255 }),
  scope: varchar("scope", { length: 255 }),
  id_token: text("id_token"),
  session_state: varchar("session_state", { length: 255 }),
});

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable("session", {
  sessionToken: varchar("session_token", { length: 255 }).notNull().primaryKey(),
  userId: varchar("userId", { length: 255 })
    .notNull(), 
  expires: int("expires").notNull(),
});

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable("verification_token", {
  identifier: varchar("identifier", { length: 255 }).notNull(),
  token: varchar("token", { length: 255 }).notNull(),
  expires: int("expires").notNull(),
});

export const gameSaves = createTable("game_save", {
  id: int("id").primaryKey().autoincrement(),
  userId: varchar("user_id", { length: 255 })
    .notNull(), 
  createdAt: int("created_at")
    .notNull(),
  updatedAt: int("updated_at")
    .notNull(),
  gamePhase: varchar("game_phase", { length: 50 }).notNull(),
  spriteDescription: text("sprite_description"),
  spriteUrl: text("sprite_url"),
  gameTheme: text("game_theme"),
  currentStory: text("current_story"),
  currentChoices: text("current_choices"),
  currentBackgroundDescription: text("current_background_description"),
  currentBackgroundImageUrl: text("current_background_image_url"),
});

export const gameSavesRelations = relations(gameSaves, ({ one }) => ({
  user: one(users, { fields: [gameSaves.userId], references: [users.id] }),
}));


import { relations, sql } from "drizzle-orm";
import {
  index,
  int,
  mysqlTableCreator,
  primaryKey,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { type AdapterAccount } from "next-auth/adapters";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = mysqlTableCreator((name) => `fbla_db_locked_intro_${name}`);

export const posts = createTable("post", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 256 }),
  createdById: varchar("created_by", { length: 255 })
    .notNull()
    .references(() => users.id),
  createdAt: int("created_at")
    .default(sql`(UNIX_TIMESTAMP())`)
    .notNull(),
  updatedAt: int("updatedAt")
    .default(sql`(UNIX_TIMESTAMP())`)
    .$onUpdate(() => sql`(UNIX_TIMESTAMP())`),
});

export const postsIndexes = {
  createdByIdIdx: index("created_by_idx").on(posts.createdById),
  nameIndex: index("name_idx").on(posts.name),
};

export const users = createTable("user", {
  id: varchar("id", { length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull(),
  emailVerified: int("email_verified")
    .default(sql`(UNIX_TIMESTAMP())`),
  image: varchar("image", { length: 255 }),
});

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  gameSaves: many(gameSaves),
}));

export const accounts = createTable("account", {
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .references(() => users.id),
  type: varchar("type", { length: 255 })
    .$type<AdapterAccount["type"]>()
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

export const accountsIndexes = {
  compoundKey: primaryKey({
    columns: [accounts.provider, accounts.providerAccountId],
  }),
  userIdIdx: index("account_user_id_idx").on(accounts.userId),
};

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable("session", {
  sessionToken: varchar("session_token", { length: 255 }).notNull().primaryKey(),
  userId: varchar("userId", { length: 255 })
    .notNull()
    .references(() => users.id),
  expires: int("expires").notNull(),
});

export const sessionsIndexes = {
  userIdIdx: index("session_userId_idx").on(sessions.userId),
};

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable("verification_token", {
  identifier: varchar("identifier", { length: 255 }).notNull(),
  token: varchar("token", { length: 255 }).notNull(),
  expires: int("expires").notNull(),
});

export const verificationTokensIndexes = {
  compoundKey: primaryKey({ columns: [verificationTokens.identifier, verificationTokens.token] }),
};

export const gameSaves = createTable("game_save", {
  id: int("id").primaryKey().autoincrement(),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .references(() => users.id),
  createdAt: int("created_at")
    .default(sql`(UNIX_TIMESTAMP())`)
    .notNull(),
  updatedAt: int("updated_at")
    .default(sql`(UNIX_TIMESTAMP())`)
    .notNull(),
  gamePhase: varchar("game_phase", { length: 50 }).notNull().default("sprite"),
  spriteDescription: text("sprite_description"),
  spriteUrl: text("sprite_url"),
  gameTheme: text("game_theme"),
  currentStory: text("current_story"),
  currentChoices: text("current_choices"),
  currentBackgroundDescription: text("current_background_description"),
  currentBackgroundImageUrl: text("current_background_image_url"),
});

export const gameSavesIndexes = {
  userIdx: index("gameSave_userId_idx").on(gameSaves.userId),
  userUniqueIdx: uniqueIndex("gameSave_user_unique_idx").on(gameSaves.userId),
};

export const gameSavesRelations = relations(gameSaves, ({ one }) => ({
  user: one(users, { fields: [gameSaves.userId], references: [users.id] }),
}));

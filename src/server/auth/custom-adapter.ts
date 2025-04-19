import { and, eq } from "drizzle-orm";
import type { Adapter } from "next-auth/adapters";
import * as schema from "~/server/db/schema";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "~/server/db/schema";

export function MySqlDrizzleAdapter(
  client: any,
): Adapter {
  return {
    async createUser(data) {
      const id = crypto.randomUUID();
      await client.insert(users).values({
        id,
        name: data.name,
        email: data.email,
        emailVerified: data.emailVerified ? Math.floor(data.emailVerified.getTime() / 1000) : null,
        image: data.image,
      });

      const user = await client.query.users.findFirst({
        where: eq(users.id, id),
      });

      return user!;
    },
    async getUser(userId) {
      const user = await client.query.users.findFirst({
        where: eq(users.id, userId),
      });
      return user ?? null;
    },
    async getUserByEmail(email) {
      const user = await client.query.users.findFirst({
        where: eq(users.email, email),
      });
      return user ?? null;
    },
    async createSession(data) {
      await client.insert(sessions).values({
        expires: Math.floor(data.expires.getTime() / 1000),
        sessionToken: data.sessionToken,
        userId: data.userId,
      });

      const session = await client.query.sessions.findFirst({
        where: eq(sessions.sessionToken, data.sessionToken),
      });

      return session!;
    },
    async getSessionAndUser(sessionToken) {
      const sessionAndUser = await client.query.sessions.findFirst({
        where: eq(sessions.sessionToken, sessionToken),
        with: {
          user: true,
        },
      });

      if (!sessionAndUser) return null;

      const { user, ...session } = sessionAndUser;
      return {
        session,
        user,
      };
    },
    async updateUser(data) {
      if (!data.id) {
        throw new Error("No user id.");
      }

      await client
        .update(users)
        .set({
          name: data.name,
          email: data.email,
          emailVerified: data.emailVerified
            ? Math.floor(data.emailVerified.getTime() / 1000)
            : null,
          image: data.image,
        })
        .where(eq(users.id, data.id));

      const user = await client.query.users.findFirst({
        where: eq(users.id, data.id),
      });

      return user!;
    },
    async updateSession(data) {
      if (!data.expires) {
        throw new Error("No expires date.");
      }
      
      await client
        .update(sessions)
        .set({
          expires: Math.floor(data.expires.getTime() / 1000),
        })
        .where(eq(sessions.sessionToken, data.sessionToken));

      return await client.query.sessions.findFirst({
        where: eq(sessions.sessionToken, data.sessionToken),
      });
    },
    async linkAccount(data) {
      await client.insert(accounts).values({
        access_token: data.access_token,
        expires_at: data.expires_at,
        id_token: data.id_token,
        provider: data.provider,
        providerAccountId: data.providerAccountId,
        refresh_token: data.refresh_token,
        scope: data.scope,
        session_state: data.session_state,
        token_type: data.token_type,
        type: data.type,
        userId: data.userId,
      });
    },
    async getUserByAccount(account) {
      const dbAccount = await client.query.accounts.findFirst({
        where: and(
          eq(accounts.providerAccountId, account.providerAccountId),
          eq(accounts.provider, account.provider)
        ),
        with: {
          user: true,
        },
      });

      return dbAccount?.user ?? null;
    },
    async deleteSession(sessionToken) {
      await client
        .delete(sessions)
        .where(eq(sessions.sessionToken, sessionToken));
    },
    async createVerificationToken(data) {
      await client.insert(verificationTokens).values({
        expires: Math.floor(data.expires.getTime() / 1000),
        identifier: data.identifier,
        token: data.token,
      });

      const verificationToken = await client.query.verificationTokens.findFirst({
        where: and(
          eq(verificationTokens.identifier, data.identifier),
          eq(verificationTokens.token, data.token)
        ),
      });

      return verificationToken!;
    },
    async useVerificationToken(data) {
      const verificationToken = await client.query.verificationTokens.findFirst({
        where: and(
          eq(verificationTokens.identifier, data.identifier),
          eq(verificationTokens.token, data.token)
        ),
      });

      if (!verificationToken) return null;

      await client
        .delete(verificationTokens)
        .where(
          and(
            eq(verificationTokens.identifier, data.identifier),
            eq(verificationTokens.token, data.token)
          )
        );

      return verificationToken;
    },
    async deleteUser(userId) {
      await client.delete(users).where(eq(users.id, userId));
    },
    async unlinkAccount(account) {
      await client
        .delete(accounts)
        .where(
          and(
            eq(accounts.providerAccountId, account.providerAccountId),
            eq(accounts.provider, account.provider)
          )
        );
    },
  };
} 
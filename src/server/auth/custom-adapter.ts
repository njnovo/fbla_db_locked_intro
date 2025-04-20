import { and, eq } from "drizzle-orm";
import type { Adapter } from "next-auth/adapters";
import type * as schema from "~/server/db/schema";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "~/server/db/schema";
import type { MySql2Database } from 'drizzle-orm/mysql2';

// Helper to convert number timestamp to Date or null
function timestampToDate(timestamp: number | null | undefined): Date | null {
  return typeof timestamp === 'number' ? new Date(timestamp * 1000) : null;
}

export function MySqlDrizzleAdapter(
  client: MySql2Database<typeof schema>,
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

      if (!user) throw new Error("User not found after creation");

      return {
        ...user,
        emailVerified: timestampToDate(user.emailVerified),
      };
    },
    async getUser(userId) {
      const user = await client.query.users.findFirst({
        where: eq(users.id, userId),
      });
      if (!user) return null;
      return {
        ...user,
        emailVerified: timestampToDate(user.emailVerified),
      };
    },
    async getUserByEmail(email) {
      const user = await client.query.users.findFirst({
        where: eq(users.email, email),
      });
       if (!user) return null;
      return {
        ...user,
        emailVerified: timestampToDate(user.emailVerified),
      };
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

      if (!session) throw new Error("Session not found after creation");

      return {
        ...session,
        expires: timestampToDate(session.expires)!,
      };
    },
    async getSessionAndUser(sessionToken) {
      console.log(`[Adapter] getSessionAndUser called with token: ${sessionToken}`);
      
      const sessionAndUser = await client.query.sessions.findFirst({
        where: eq(sessions.sessionToken, sessionToken),
        with: {
          user: true,
        },
      });

      if (!sessionAndUser) {
        console.log(`[Adapter] No session found for token: ${sessionToken}`);
        return null;
      }
      
      console.log(`[Adapter] Session found for token: ${sessionToken}`, sessionAndUser);

      const { user, ...session } = sessionAndUser;
      
      const expiresDate = timestampToDate(session.expires)!;
      if (expiresDate < new Date()) {
        console.log(`[Adapter] Session expired for token: ${sessionToken}`);
        return null;
      }
      
      return {
        session: {
          ...session,
          expires: expiresDate,
        },
        user: {
          ...user,
          emailVerified: timestampToDate(user.emailVerified),
        },
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

      if (!user) throw new Error("User not found after update");
      
      return {
        ...user,
        emailVerified: timestampToDate(user.emailVerified),
      };
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

      const updatedSession = await client.query.sessions.findFirst({
        where: eq(sessions.sessionToken, data.sessionToken),
      });
      
      if (!updatedSession) return null;

      return {
          ...updatedSession,
          expires: timestampToDate(updatedSession.expires)!,
      };
    },
    async linkAccount(data) {
      await client.insert(accounts).values({
        userId: data.userId,
        type: data.type,
        provider: data.provider,
        providerAccountId: data.providerAccountId,
        refresh_token: data.refresh_token ?? null,
        access_token: data.access_token ?? null,
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

      if (!dbAccount?.user) return null;

      const user = dbAccount.user;
      return {
        ...user,
        emailVerified: timestampToDate(user.emailVerified),
      };
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

      if (!verificationToken) throw new Error("Verification token not found after creation");
      
      // Although the Adapter type expects Awaitable<VerificationToken | null | undefined>,
      // NextAuth seems to actually expect the token object itself on successful creation.
      // Returning the object structure directly.
      return {
        ...verificationToken,
        expires: timestampToDate(verificationToken.expires)!,
      };
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

      return {
        ...verificationToken,
        expires: timestampToDate(verificationToken.expires)!,
      };
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
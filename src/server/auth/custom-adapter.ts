import { type Adapter, type AdapterUser } from "next-auth/adapters";
import { type SingleStoreDatabase } from "drizzle-orm/singlestore-core";
import * as schema from "../db/schema";
import { users, accounts, sessions, verificationTokens } from "../db/schema";
import { and, eq, SQL } from "drizzle-orm";
import { type AdapterAccount } from "next-auth/adapters";

// Helper to convert DB user to AdapterUser
const dbUserToAdapterUser = (user: typeof users.$inferSelect): AdapterUser => {
  return {
    ...user,
    emailVerified: user.emailVerified ? new Date(user.emailVerified * 1000) : null, // Convert seconds to Date
  };
};

export function CustomSinglestoreAdapter(
  client: SingleStoreDatabase<any, any, any, any>,
): Adapter {
  return {
    async createUser(data) {
      // SingleStore doesn't support returning() - insert then fetch the user
      await client
        .insert(users)
        .values({
          ...data,
          id: crypto.randomUUID(),
          emailVerified: data.emailVerified ? Math.floor(data.emailVerified.getTime() / 1000) : null,
        });
      
      // Fetch the newly created user by email (which should be unique)
      const newUser = await client
        .select()
        .from(users)
        .where(eq(users.email, data.email))
        .then((res: any[]) => res[0] ?? null);

      if (!newUser) throw new Error("User not created");
      return dbUserToAdapterUser(newUser);
    },
    
    async getUser(id) {
      const user = await client
        .select()
        .from(users)
        .where(eq(users.id, id))
        .then((res: any[]) => res[0] ?? null);

      if (!user) return null;
      return dbUserToAdapterUser(user);
    },
    
    async getUserByEmail(email) {
        const user = await client
            .select()
            .from(users)
            .where(eq(users.email, email))
            .then((res: any[]) => res[0] ?? null);

        if (!user) return null;
        return dbUserToAdapterUser(user);
    },
    
    async getUserByAccount({ providerAccountId, provider }) {
        const result = await client
            .select({
                user: users,
            })
            .from(accounts)
            .where(
                and(
                    eq(accounts.providerAccountId, providerAccountId),
                    eq(accounts.provider, provider)
                )
            )
            .innerJoin(users, eq(accounts.userId, users.id))
            .then((res: any[]) => res[0] ?? null);

        if (!result || !result.user) return null;
        return dbUserToAdapterUser(result.user);
    },
    
    async updateUser(user) {
      if (!user.id) {
        throw new Error("User id is required to update");
      }
      
      // SingleStore doesn't support returning() - update then fetch
      await client
        .update(users)
        .set({
          name: user.name,
          email: user.email,
          image: user.image,
          emailVerified: user.emailVerified ? Math.floor(user.emailVerified.getTime() / 1000) : null,
        })
        .where(eq(users.id, user.id));
      
      // Fetch the updated user
      const updatedUser = await client
        .select()
        .from(users)
        .where(eq(users.id, user.id))
        .then((res: any[]) => res[0] ?? null);

      if (!updatedUser) throw new Error("User not updated");
      return dbUserToAdapterUser(updatedUser);
    },
    
    async linkAccount(account) {
        // Using type assertion to bypass TypeScript's checks
        await client.insert(accounts).values({
            userId: account.userId,
            type: account.type,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            refresh_token: account.refresh_token || null,
            access_token: account.access_token || null,
            expires_at: account.expires_at ? Number(account.expires_at) : null,
            token_type: account.token_type || null,
            scope: account.scope || null,
            id_token: account.id_token || null,
            session_state: account.session_state || null,
        } as any);
        
        return account;
    },
    
    async unlinkAccount({ providerAccountId, provider }) {
      await client
        .delete(accounts)
        .where(
          and(
            eq(accounts.providerAccountId, providerAccountId),
            eq(accounts.provider, provider)
          )
        );
    },
    
    async createSession({ sessionToken, userId, expires }) {
        // Using type assertion to bypass TypeScript's checks
        await client
            .insert(sessions)
            .values({
                sessionToken,
                userId,
                expires: Math.floor(expires.getTime() / 1000),
            } as any);
            
        // Fetch the newly created session
        const newSession = await client
            .select()
            .from(sessions)
            .where(eq(sessions.sessionToken, sessionToken))
            .then((res: any[]) => res[0] ?? null);

        if (!newSession) throw new Error("Session not created");
        
        return {
            ...newSession,
            expires: new Date(newSession.expires * 1000)
        };
    },
    
    async getSessionAndUser(sessionToken) {
        const result = await client
            .select({
                session: sessions,
                user: users,
            })
            .from(sessions)
            .where(eq(sessions.sessionToken, sessionToken))
            .innerJoin(users, eq(sessions.userId, users.id))
            .then((res: any[]) => res[0] ?? null);

        if (!result) return null;

        return {
            session: {
                ...result.session,
                expires: new Date(result.session.expires * 1000),
            },
            user: dbUserToAdapterUser(result.user),
        };
    },
    
    async updateSession({ sessionToken, expires, userId }) {
      const updateData: Record<string, any> = {};
      
      if (expires) {
        updateData[sessions.expires.name] = Math.floor(expires.getTime() / 1000);
      }
      
      if (userId) {
        updateData[sessions.userId.name] = userId;
      }

      if (Object.keys(updateData).length === 0) {
        // No valid fields to update, just fetch the existing session
        const existingSession = await client
          .select()
          .from(sessions)
          .where(eq(sessions.sessionToken, sessionToken))
          .then((res: any[]) => res[0] ?? null);
          
        if (!existingSession) return null;
        return { 
          ...existingSession, 
          expires: new Date(existingSession.expires * 1000) 
        };
      }

      // SingleStore doesn't support returning() - update then fetch
      await client
        .update(sessions)
        .set(updateData as any)
        .where(eq(sessions.sessionToken, sessionToken));
      
      // Fetch the updated session
      const updatedSession = await client
        .select()
        .from(sessions)
        .where(eq(sessions.sessionToken, sessionToken))
        .then((res: any[]) => res[0] ?? null);

      if (!updatedSession) return null;

      return {
        ...updatedSession,
        expires: new Date(updatedSession.expires * 1000),
      };
    },
    
    async deleteSession(sessionToken) {
        await client.delete(sessions).where(eq(sessions.sessionToken, sessionToken));
    },
    
    async createVerificationToken({ identifier, token, expires }) {
        // Using type assertion to bypass TypeScript's checks
        await client
            .insert(verificationTokens)
            .values({
                identifier,
                token,
                expires: Math.floor(expires.getTime() / 1000),
            } as any);
            
        // Fetch the newly created token
        const newToken = await client
            .select()
            .from(verificationTokens)
            .where(
                and(
                    eq(verificationTokens.identifier, identifier),
                    eq(verificationTokens.token, token)
                )
            )
            .then((res: any[]) => res[0] ?? null);

         if (!newToken) return null;

         return {
             identifier: newToken.identifier,
             token: newToken.token,
             expires: new Date(newToken.expires * 1000),
         };
    },
    
    async useVerificationToken({ identifier, token }) {
        // Find the token
        const foundToken = await client
            .select()
            .from(verificationTokens)
            .where(
                and(
                    eq(verificationTokens.identifier, identifier),
                    eq(verificationTokens.token, token)
                )
            )
            .then((res: any[]) => res[0] ?? null);

        if (!foundToken) return null;

        // Delete the token
        await client
            .delete(verificationTokens)
            .where(
                and(
                    eq(verificationTokens.identifier, identifier),
                    eq(verificationTokens.token, token)
                )
            );

        // Return the token details
        return {
            ...foundToken,
            expires: new Date(foundToken.expires * 1000),
        };
    },
  };
}

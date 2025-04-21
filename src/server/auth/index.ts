import { cache } from "react";
import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import type { Session } from "next-auth";
import type { User } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { env } from "~/env";
import { db } from "~/server/db";
import { CustomSinglestoreAdapter } from "~/server/auth/custom-adapter";
import { sql } from "drizzle-orm";

// Debug database tables
try {
  console.log("[Auth] Checking database tables on startup");
  // This is executed at build time, so we can't use async/await here
  db.execute(sql`SHOW TABLES LIKE 'fbla_db_locked_intro_%'`)
    .then((tables) => {
      console.log("[Auth] Available tables:", tables);
    })
    .catch((error) => {
      console.error("[Auth] Error checking tables:", error);
    });
} catch (e) {
  console.error("[Auth] Error during database check:", e);
}

// Define auth options separately with the correct type
export const authOptions: NextAuthConfig = {
  providers: [
    DiscordProvider({
      clientId: env.AUTH_DISCORD_ID,
      clientSecret: env.AUTH_DISCORD_SECRET,
    }),
  ],
  adapter: CustomSinglestoreAdapter(db),
  callbacks: {
    session: ({ 
      session, 
      user 
    }: { 
      session: Session; 
      user: User 
    }) => {
      console.log("[Auth] Session callback called with session:", session);
      console.log("[Auth] Session callback called with user:", user);
      
      if (!user) {
        console.error("[Auth] No user data in session callback");
        return session;
      }
      
      if (!user.id) {
        console.error("[Auth] User is missing ID in session callback");
        console.error("[Auth] User keys:", Object.keys(user));
      }
      
      // Make sure we return a well-formed session object
      return {
        ...session,
        user: {
          ...session.user,
          id: user.id,
        },
      };
    },
  },
  // Enable debugging
  debug: true,
};

// Create NextAuth
const nextAuth = NextAuth(authOptions);

// Cache the auth function
export const auth = cache(nextAuth.auth);

// Export signIn/signOut
export const { signIn, signOut } = nextAuth;

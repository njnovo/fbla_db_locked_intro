import { cache } from "react";
import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import type { Session } from "next-auth";
import type { User } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { env } from "~/env";
import { db } from "~/server/db";
import { MySqlDrizzleAdapter } from "~/server/auth/custom-adapter";

// Define auth options separately with the correct type
export const authOptions: NextAuthConfig = {
  providers: [
    DiscordProvider({
      clientId: env.AUTH_DISCORD_ID,
      clientSecret: env.AUTH_DISCORD_SECRET,
    }),
  ],
  adapter: MySqlDrizzleAdapter(db),
  callbacks: {
    session: ({ 
      session, 
      user 
    }: { 
      session: Session; 
      user: User 
    }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
      },
    }),
  },
};

// Create NextAuth
const nextAuth = NextAuth(authOptions);

// Cache the auth function
export const auth = cache(nextAuth.auth);

// Export signIn/signOut
export const { signIn, signOut } = nextAuth;

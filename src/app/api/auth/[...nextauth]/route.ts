import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { env } from "~/env";
import { db } from "~/server/db";
import { MySqlDrizzleAdapter } from "~/server/auth/custom-adapter";
import { cache } from "react";

// Create the NextAuth handler
const handler = NextAuth({
  providers: [
    DiscordProvider({
      clientId: env.AUTH_DISCORD_ID,
      clientSecret: env.AUTH_DISCORD_SECRET,
    }),
  ],
  adapter: MySqlDrizzleAdapter(db),
  callbacks: {
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
      },
    }),
  },
});

// Export the route handlers
export { handler as GET, handler as POST };

// Export cached auth function that can be used across the app
export const auth = cache(handler.auth);

import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { env } from "~/env";
import { db } from "~/server/db";
import { MySqlDrizzleAdapter } from "~/server/auth/custom-adapter";

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

export { handler as GET, handler as POST };

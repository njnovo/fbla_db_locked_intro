import { type NextAuthConfig } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { env } from "~/env";
// ... other imports

export const authOptions: NextAuthConfig = {
  // ... adapter, callbacks, etc.
  providers: [
    DiscordProvider({
      clientId: env.AUTH_DISCORD_ID,
      clientSecret: env.AUTH_DISCORD_SECRET
    })
  ],
  // ...
}; 
// https://next-auth.js.org/providers/github
import { type NextAuthConfig } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { env } from "~/env";
// ... other imports

// Auth configuration
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

// Re-export auth from auth directory
export * from "./auth/index";
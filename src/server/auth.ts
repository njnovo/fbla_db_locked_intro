import GoogleProvider from "next-auth/providers/google";
import { env } from "~/env";
// ... other imports

export const authOptions: NextAuthOptions = {
  // ... adapter, callbacks, etc.
  providers: [
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,       // Make sure these are defined
      clientSecret: env.GOOGLE_CLIENT_SECRET, // Make sure these are defined
    }),
    // DiscordProvider(...) // Keep other providers if you have them
    /**
     * ...add more providers here.
     *
     * Most other providers require a bit more work than the Discord provider. For example, the
     * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
     * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
     *
     * @see https://next-auth.js.org/providers/github
     */
  ],
  // ...
}; 
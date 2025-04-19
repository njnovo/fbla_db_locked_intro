import NextAuth from "next-auth";
import { authOptions } from "~/server/auth/auth";

// Create the NextAuth handler
const handler = NextAuth(authOptions);

// Export the route handlers
export { handler as GET, handler as POST };

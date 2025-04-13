import NextAuth from "next-auth";
import { cache } from "react";

import { authConfig } from "./config";

// Create a single instance of NextAuth
const nextAuth = NextAuth(authConfig);

// Cache the auth function using React's cache
const auth = cache(nextAuth.auth);

// Export the auth function
export { auth };

// Export signIn and signOut for client usage (if needed)
export const { signIn, signOut } = nextAuth;

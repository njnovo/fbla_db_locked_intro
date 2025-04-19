import NextAuth from "next-auth";
import { authOptions } from "~/server/auth";

/**
 * NextAuth.js Route Handler
 * @see https://next-auth.js.org/configuration/nextjs#in-app-router
 */
const { handlers } = NextAuth(authOptions);
export const { GET, POST } = handlers;

import { auth } from "~/app/api/auth/[...nextauth]/route";

// Re-export the auth function
export { auth };

// Export signIn and signOut for client usage (importing from next-auth/react is preferred)
export { signIn, signOut } from "next-auth/react";

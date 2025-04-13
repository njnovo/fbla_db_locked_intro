"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { Layout } from "~/components/Layout";
import { Container } from "~/components/Container";
import { Button } from "~/components/Button";
import { LoadingIndicator } from "~/components/LoadingIndicator";
import { PageTitle } from "~/components/PageTitle";

export default function UserPage() {
  const { data: session, status } = useSession();

  return (
    <Layout>
      <Container>
        <PageTitle className="mb-8">User Profile & Settings</PageTitle>

        {status === "loading" && (
           <LoadingIndicator />
        )}

        {status === "authenticated" && session?.user && (
          <div className="flex flex-col items-center gap-4 text-center">
            {session.user.image && (
              <img
                src={session.user.image}
                alt="User avatar"
                className="h-24 w-24 rounded-full border-2 border-purple-400 mb-4"
              />
            )}
            <p className="text-2xl">
              Welcome, <span className="font-semibold">{session.user.name ?? "User"}</span>!
            </p>
            <p className="text-lg text-gray-300">
                Email: {session.user.email ?? "No email provided"}
            </p>
            <Button
              variant="secondary"
              onClick={() => void signOut()}
              className="mt-6"
            >
              Sign Out
            </Button>
          </div>
        )}

        {status === "unauthenticated" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-2xl mb-4">You are not signed in.</p>
            <Button
              variant="primary"
              onClick={() => void signIn()}
              className="text-xl px-10 py-4" // Adjust size if needed
            >
              Sign In
            </Button>
             <p className="text-gray-400 mt-2">
                (Sign in to save your game progress)
             </p>
          </div>
        )}

        <div className="mt-12 flex flex-col items-center gap-4">
           <Link href="/game" className="text-purple-300 hover:text-purple-100 text-lg">
                Go to Game
            </Link>
            <Link href="/" className="text-purple-300 hover:text-purple-100 text-lg">
                Go back home
            </Link>
        </div>

      </Container>
    </Layout>
  );
}

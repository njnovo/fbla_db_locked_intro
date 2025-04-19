"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation"; // Use next/navigation for App Router
import { useEffect } from "react";
import Link from "next/link";
import { Layout } from "~/components/Layout";
import { Button } from "~/components/Button";
import { LoadingIndicator } from "~/components/LoadingIndicator";
import { PageTitle } from "~/components/PageTitle";

export default function SignInPage() {
  const { /* data: session, */ status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Redirect if already logged in
    if (status === "authenticated") {
      router.push("/user"); // Redirect to user profile page or /game
    }
  }, [status, router]);

  const handleGoogleSignIn = () => {
    // Specify the provider ID ('google') and optionally a callback URL
    void signIn("google", { callbackUrl: "/user" }); // Redirect to /user after successful sign-in
  };

  // Show loading state while checking session
  if (status === "loading") {
    return (
      <Layout>
        <LoadingIndicator />
      </Layout>
    );
  }

  // Don't render the sign-in button if already authenticated (should be redirected)
  if (status === "authenticated") {
    return null; // Or a message indicating redirection
  }

  return (
    <Layout>
      <div className="container flex max-w-md flex-col items-center justify-center gap-8 rounded-xl bg-white/5 p-10 shadow-lg">
        <PageTitle>Sign In</PageTitle>

        <p className="text-center text-gray-300">
          Sign in to save your game progress and continue your adventure!
        </p>

        <Button variant="google" onClick={handleGoogleSignIn}>
          {/* <GoogleIcon className="h-5 w-5" /> */}
          <span>Sign in with Google</span>
        </Button>

        <div className="mt-4 text-center">
          <Link href="/" className="text-sm text-purple-300 hover:text-purple-100">
            Back to Home
          </Link>
        </div>
      </div>
    </Layout>
  );
}

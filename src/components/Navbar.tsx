"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { Button } from "./Button";
import Image from "next/image";

export const Navbar = () => {
  const { data: session, status } = useSession();

  return (
    <nav className="w-full bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto flex items-center justify-between">
        {/* Left Side: Brand/Title */}
        <Link href="/" className="text-xl font-bold text-blue-600 hover:text-blue-700 transition-colors">
          Threads of Destiny
        </Link>

        {/* Center: Navigation Links */}
        <div className="hidden md:flex items-center space-x-8">
          <Link href="/game" className="text-gray-600 hover:text-blue-600 font-medium transition-colors">
            Game
          </Link>
          <Link href="/elements" className="text-gray-600 hover:text-blue-600 font-medium transition-colors">
            Tech Details
          </Link>
        </div>

        {/* Right Side: Auth Status */}
        <div className="flex items-center gap-4">
          {status === "loading" && (
            <div className="h-8 w-20 animate-pulse rounded bg-gray-200"></div>
          )}

          {status === "authenticated" && session?.user && (
            <div className="flex items-center gap-4">
              <span className="hidden md:inline text-sm text-gray-600">
                {session.user.name}
              </span>
              {session.user.image && (
                <Link href="/user" title="Go to Profile" className="flex items-center">
                  <Image
                    src={session.user.image}
                    alt="User avatar"
                    width={32}
                    height={32}
                    className="rounded-full border border-gray-200"
                  />
                </Link>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void signOut()}
              >
                Sign Out
              </Button>
            </div>
          )}

          {status === "unauthenticated" && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => void signIn()}
            >
              Sign In
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}; 
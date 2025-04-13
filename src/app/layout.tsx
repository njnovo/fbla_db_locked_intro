import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";

import { TRPCReactProvider } from "~/trpc/react";
import { Navbar } from "~/components/Navbar";
import { NextAuthProvider } from "~/components/NextAuthProvider";

export const metadata: Metadata = {
  title: "Threads of Destiny",
  description: "An AI-powered choose your own adventure game.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable}`}>
      <body>
        <TRPCReactProvider>
          <NextAuthProvider>
            <Navbar />
            {children}
          </NextAuthProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}

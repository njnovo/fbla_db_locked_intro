import Link from "next/link";
import { Layout } from "~/components/Layout";
import { PageTitle } from "~/components/PageTitle";
import { Button } from "~/components/Button"; // Optional: if you want styled links

export default function ElementsPage() {
  return (
    <Layout>
      <div className="container max-w-4xl mx-auto"> {/* Keep specific container for now */}
        <PageTitle className="mb-12">
          Threads of Destiny: <span className="text-[hsl(280,100%,70%)]">Under the Hood</span>
        </PageTitle>

        <div className="space-y-10 text-lg leading-relaxed">
          {/* Section 1: Core Technologies */}
          <section>
            <h2 className="text-3xl font-semibold mb-4 border-b border-purple-500/30 pb-2">
              Core Technologies
            </h2>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>
                <strong>Framework:</strong>{" "}
                <a href="https://nextjs.org/" target="_blank" rel="noopener noreferrer" className="text-purple-300 hover:underline">Next.js</a> (App Router) - Provides server-side rendering, static site generation, routing, and API capabilities within a React ecosystem.
              </li>
              <li>
                <strong>Styling:</strong>{" "}
                <a href="https://tailwindcss.com/" target="_blank" rel="noopener noreferrer" className="text-purple-300 hover:underline">Tailwind CSS</a> - A utility-first CSS framework for rapid UI development directly within the markup.
              </li>
              <li>
                <strong>API Layer:</strong>{" "}
                <a href="https://trpc.io/" target="_blank" rel="noopener noreferrer" className="text-purple-300 hover:underline">tRPC</a> - Enables end-to-end typesafe APIs, connecting the Next.js frontend directly to backend procedures with full TypeScript inference.
              </li>
              <li>
                <strong>Database:</strong>{" "}
                <a href="https://www.postgresql.org/" target="_blank" rel="noopener noreferrer" className="text-purple-300 hover:underline">PostgreSQL</a> - A powerful, open-source relational database used for storing user accounts and game save data.
              </li>
              <li>
                <strong>ORM:</strong>{" "}
                <a href="https://orm.drizzle.team/" target="_blank" rel="noopener noreferrer" className="text-purple-300 hover:underline">Drizzle ORM</a> - A modern TypeScript ORM used for defining the database schema and interacting with the PostgreSQL database in a typesafe manner.
              </li>
              <li>
                <strong>Authentication:</strong>{" "}
                <a href="https://next-auth.js.org/" target="_blank" rel="noopener noreferrer" className="text-purple-300 hover:underline">NextAuth.js</a> - Handles user authentication, currently configured with a Google OAuth provider for easy sign-in.
              </li>
              <li>
                <strong>AI Integration:</strong> Interactions with{" "}
                <a href="https://openai.com/api/" target="_blank" rel="noopener noreferrer" className="text-purple-300 hover:underline">OpenAI APIs</a> (specifically models like GPT for text generation and DALL-E or similar for image generation) are used to dynamically create game content.
              </li>
            </ul>
          </section>

          {/* Section 2: Game Flow & Logic */}
          <section>
            <h2 className="text-3xl font-semibold mb-4 border-b border-purple-500/30 pb-2">
              Game Flow & Logic
            </h2>
            <p className="mb-4">
              "Threads of Destiny" is designed as a dynamic, AI-powered choose-your-own-adventure game:
            </p>
            <ol className="list-decimal list-inside space-y-3 pl-4">
              <li>
                <strong>Authentication:</strong> Users sign in (currently via Google) using NextAuth.js. This is required to save game progress.
              </li>
              <li>
                <strong>Load/New Game:</strong> Upon visiting the game page, a tRPC query (`loadGame`) checks the database for an existing save linked to the user ID. If found, the game state is loaded; otherwise, the user starts the new game flow.
              </li>
              <li>
                <strong>Sprite Creation:</strong> The user provides a text description for their character. A tRPC mutation (`generateSprite`) sends this description to an AI image generation API (like DALL-E). The resulting image URL is returned and displayed. The game state (phase, sprite URL) is saved via the `saveGame` mutation.
              </li>
              <li>
                <strong>Theme Selection:</strong> The user inputs a theme for their adventure (e.g., "Fantasy", "Sci-Fi"). Another tRPC mutation (`startGame`) uses this theme (and the sprite description for context) to prompt an AI text generation API (like ChatGPT) for the initial story segment, choices, and a background description. A separate AI call generates the initial background image based on its description. This initial state is returned, displayed, and saved using `saveGame`.
              </li>
              <li>
                <strong>Gameplay Loop:</strong>
                 <ul className="list-disc list-inside space-y-1 mt-2 pl-6">
                     <li>The current story segment and choices are displayed.</li>
                     <li>The user selects a choice (currently via button click, potentially number keys/WASD later).</li>
                     <li>A tRPC mutation (`makeChoice`) sends the chosen option and current context (story, theme, sprite) to the AI text API.</li>
                     <li>The AI generates the next story part, new choices, and an updated background description.</li>
                     <li>The AI image API generates a new background based on the updated description.</li>
                     <li>The new state (story, choices, background URL) is returned, displayed, and automatically saved via the `saveGame` mutation.</li>
                 </ul>
              </li>
              <li>
                <strong>Persistence:</strong> Every significant game state change (sprite generation, theme selection, choice made) triggers the `saveGame` tRPC mutation, which uses Drizzle ORM to upsert (update or insert) the user's current game state into the `game_saves` table in the PostgreSQL database. This ensures progress is saved automatically and can be resumed later.
              </li>
            </ol>
             <p className="mt-4 italic text-gray-400">
                Note: WASD movement for triggering prompts is a planned feature but not yet implemented in the current version.
            </p>
          </section>

          {/* Section 3: Architecture Highlights */}
           <section>
            <h2 className="text-3xl font-semibold mb-4 border-b border-purple-500/30 pb-2">
              Architecture Highlights
            </h2>
             <ul className="list-disc list-inside space-y-2 pl-4">
                <li><strong>End-to-End Type Safety:</strong> tRPC + Drizzle ORM + TypeScript ensure type safety from the database schema definition through the backend API layer and into the React frontend components, reducing runtime errors.</li>
                <li><strong>Server Components & Client Components:</strong> Leverages Next.js App Router features. Pages like this one can be Server Components, while interactive pages like the game itself (`/game`) are Client Components (`"use client"`) to utilize React Hooks and handle browser events.</li>
                <li><strong>Protected Procedures:</strong> tRPC's `protectedProcedure` is used for actions requiring authentication (loading/saving game, generating content tied to a user), ensuring only logged-in users can perform them.</li>
                <li><strong>Database Migrations:</strong> `drizzle-kit` is used to manage database schema changes and generate SQL migration files, ensuring safe evolution of the database structure.</li>
                <li><strong>Environment Variables:</strong> Sensitive keys (API keys, database URL, auth secrets) are managed through environment variables (`.env`) and validated using `T3 Env` (`src/env.js`).</li>
             </ul>
          </section>

          {/* Back Link */}
          <div className="mt-16 text-center">
            {/* Using a standard link here, but Button could be adapted */}
            <Link href="/" className="text-purple-300 hover:text-purple-100 text-xl">
                ← Back to Home
            </Link>
            {/* Example using Button component as a link (requires 'asChild' prop pattern if using Radix)
             <Button variant="secondary" asChild>
               <Link href="/">← Back to Home</Link>
             </Button>
             */}
          </div>
        </div>
      </div>
    </Layout>
  );
}

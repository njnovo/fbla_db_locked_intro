import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db"; // Import db instance
import { gameSaves } from "~/server/db/schema"; // Import gameSaves schema
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server"; // For error handling
// Import your AI API client setup here (e.g., OpenAI)
// import { openai } from "~/server/ai"; // Assuming you have this setup
import { env } from "~/env"; // For API keys

// Placeholder function - replace with actual OpenAI API call
async function generateImageWithAI(prompt: string): Promise<string> {
  console.log(`AI IMAGE API CALL (MOCK): Generating image for prompt: "${prompt}"`);
  if (!env.OPENAI_API_KEY) {
     console.warn("OPENAI_API_KEY not set. Returning placeholder.");
     // Return a placeholder or throw an error if the key is missing
     // Using a more dynamic placeholder based on prompt might help debugging
     return `/placeholder-img-${prompt.substring(0, 15).replace(/[^a-z0-9]/gi, '-')}.png`;
  }
  // --- Actual OpenAI Image Generation Call Would Go Here ---
  // Example using a hypothetical openai client:
  // const response = await openai.images.generate({
  //   model: "dall-e-3", // Or your desired model
  //   prompt: prompt,
  //   n: 1,
  //   size: "1024x1024", // Or your desired size
  // });
  // const imageUrl = response.data[0]?.url;
  // if (!imageUrl) {
  //   throw new Error("Failed to generate image");
  // }
  // return imageUrl;
  // ----------------------------------------------------------
  await new Promise(resolve => setTimeout(resolve, 800)); // Simulate delay
  // Returning a consistent placeholder might be simpler if the dynamic one causes issues
  return `/placeholder-ai-image.png`;
}

// Placeholder function - replace with actual OpenAI API call
async function generateStoryWithAI(input: { theme?: string, previousStory?: string, choice?: string, spriteDesc?: string }): Promise<{ story: string; choices: { id: number; text: string }[], backgroundDescription: string }> {
    console.log(`AI TEXT API CALL (MOCK): Generating story part for input:`, input);
    if (!env.OPENAI_API_KEY) {
       console.warn("OPENAI_API_KEY not set. Returning placeholder.");
       return {
           story: `(Placeholder: API Key Missing) Setting the scene for the ${input.theme ?? 'adventure'}...`,
           choices: [{id: 1, text: "Proceed"}, {id: 2, text: "Look around"}],
           backgroundDescription: `A placeholder background for ${input.theme ?? 'adventure'}`
       }
    }
    // --- Actual OpenAI Chat Completion Call Would Go Here ---
    // Construct a prompt based on the input (theme, previous state, choice)
    // Example using a hypothetical openai client:
    // const response = await openai.chat.completions.create({
    //   model: "gpt-4", // Or your desired model
    //   messages: [
    //     { role: "system", content: "You are a choose-your-own-adventure game master." },
    //     // Add more context messages based on input...
    //     { role: "user", content: "Generate the next part of the story..." }
    //   ],
    //   // Add instructions for response format (e.g., JSON with story, choices, bg desc)
    // });
    // const result = JSON.parse(response.choices[0]?.message?.content ?? '{}');
    // return result; // Assuming the AI returns the correct structure
    // ---------------------------------------------------------
    await new Promise(resolve => setTimeout(resolve, 1200)); // Simulate delay
    const baseStory = input.choice
        ? `(Placeholder) Following choice '${input.choice}', something else happens in the ${input.theme} setting.`
        : `(Placeholder) Starting the adventure in a ${input.theme} world with a character like ${input.spriteDesc}.`;

    // Generate slightly varying choices for testing
    const choiceNum = Math.floor(Math.random() * 3) + 1;
    return {
        story: `${baseStory} What is the next move? (Random choice: ${choiceNum})`,
        choices: [
            { id: 1, text: `Option A (${choiceNum}) for ${input.theme}` },
            { id: 2, text: `Option B (${choiceNum}) for ${input.theme}` },
            { id: 3, text: `Option C (${choiceNum}) for ${input.theme}` }
        ],
        backgroundDescription: `A dynamic background representing the current state (${choiceNum}) in the ${input.theme} adventure.`
    };
}

export const gameRouter = createTRPCRouter({
  // Procedure to load existing game or signal creation of a new one
  loadGame: protectedProcedure // Requires user to be logged in
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      const existingSave = await db.query.gameSaves.findFirst({
        where: eq(gameSaves.userId, userId),
        orderBy: (saves, { desc }) => [desc(saves.updatedAt)], // Get the latest updated one if multiple exist (shouldn't happen ideally)
      });

      if (existingSave) {
        // `jsonb` type in Drizzle should handle parsing automatically if defined correctly in schema.
        // No explicit JSON.parse needed unless schema uses `text` for choices.
        const choices = existingSave.currentChoices ?? []; // Default to empty array if null/undefined

        // Ensure the structure matches the type expected by the frontend
        // The schema uses `jsonb` which Drizzle maps to `unknown` by default,
        // so we need to assert the type or validate it.
        // Let's assume the structure matches the Zod schema used later.
        return {
            status: "loaded",
            saveData: {
                ...existingSave,
                currentChoices: choices as Array<{ id: number; text: string }>, // Assert type for safety
            },
        } as const; // Use 'as const' for better type inference on status
      } else {
        // No save found, signal frontend to start new game flow
        return { status: "new" } as const; // Use 'as const'
      }
    }),

  // Save the entire game state (call this after each successful step)
  saveGame: protectedProcedure
    .input(
      z.object({
        gamePhase: z.enum(["sprite", "theme", "playing"]),
        spriteDescription: z.string().nullish(), // Use nullish for optional().nullable()
        spriteUrl: z.string().nullish(),
        gameTheme: z.string().nullish(),
        currentStory: z.string().nullish(),
        currentChoices: z.array(z.object({ id: z.number(), text: z.string() })).nullish(),
        currentBackgroundDescription: z.string().nullish(),
        currentBackgroundImageUrl: z.string().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // --------------------------------------------------------------------
      // IMPORTANT: The following `onConflictDoUpdate` requires a UNIQUE INDEX
      // or UNIQUE CONSTRAINT on the `userId` column in the `game_saves` table
      // in your PostgreSQL database. Ensure this index exists.
      // Add it in `src/server/db/schema.ts` like this:
      // export const gameSaves = createTable(
      //   "game_save",
      //   { ... columns ... },
      //   (table) => ({
      //     userIdx: index("gameSave_userId_idx").on(table.userId),
      //     userUniqueIdx: uniqueIndex("gameSave_user_unique_idx").on(table.userId), // <-- Ensure this line exists
      //   })
      // );
      // Then run your Drizzle migration command (e.g., `drizzle-kit push:pg`).
      // --------------------------------------------------------------------

      await db
        .insert(gameSaves)
        .values({
          userId: userId,
          gamePhase: input.gamePhase,
          // Handle potential null values from input matching schema defaults or nullability
          spriteDescription: input.spriteDescription ?? null,
          spriteUrl: input.spriteUrl ?? null,
          gameTheme: input.gameTheme ?? null,
          currentStory: input.currentStory ?? null,
          currentChoices: input.currentChoices ?? [], // Default to empty array if null/undefined
          currentBackgroundDescription: input.currentBackgroundDescription ?? null,
          currentBackgroundImageUrl: input.currentBackgroundImageUrl ?? null,
          // createdAt is set by default, updatedAt needs manual update here
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: gameSaves.userId, // Target the unique user ID column
          set: {
            // Update all fields from the input when conflict occurs
            gamePhase: input.gamePhase,
            spriteDescription: input.spriteDescription ?? null,
            spriteUrl: input.spriteUrl ?? null,
            gameTheme: input.gameTheme ?? null,
            currentStory: input.currentStory ?? null,
            currentChoices: input.currentChoices ?? [],
            currentBackgroundDescription: input.currentBackgroundDescription ?? null,
            currentBackgroundImageUrl: input.currentBackgroundImageUrl ?? null,
            updatedAt: new Date(), // Also update the timestamp on update
          },
        });

      return { success: true };
    }),

  // Generate Sprite - becomes protected, saves URL after generation
  generateSprite: protectedProcedure
    .input(z.object({ description: z.string().min(1, "Description cannot be empty") })) // Added error message
    .mutation(async ({ input }) => { // Removed ctx as it's not used here
      const imageUrl = await generateImageWithAI(
        `Pixel art character sprite: ${input.description}`
      );
      return { imageUrl };
    }),

  // Start Game - becomes protected, generates initial state, frontend saves
  startGame: protectedProcedure
    .input(z.object({
        theme: z.string().min(1, "Theme cannot be empty"),
        // Ensure spriteDescription is required if needed by AI function
        spriteDescription: z.string().min(1, "Sprite description is required to start"),
    }))
    .mutation(async ({ input }) => {
      const initialState = await generateStoryWithAI({
        theme: input.theme,
        spriteDesc: input.spriteDescription,
      });
      const backgroundImageUrl = await generateImageWithAI(
        initialState.backgroundDescription
      );

      // Return data needed for frontend to save
      return {
        initialState: {
          story: initialState.story,
          choices: initialState.choices,
          backgroundDescription: initialState.backgroundDescription,
        },
        backgroundImageUrl,
      };
    }),

  // Make Choice - becomes protected, generates next state, frontend saves
  makeChoice: protectedProcedure
    .input(
      z.object({
        choiceId: z.number(),
        // Ensure these match what the frontend sends
        currentStory: z.string(),
        currentChoices: z.array(
          z.object({ id: z.number(), text: z.string() }) // Ensure choice objects have id and text
        ),
        gameTheme: z.string(),
        spriteDescription: z.string(), // Pass sprite desc if needed by AI
      })
    )
    .mutation(async ({ input }) => {
      const choiceMade =
        input.currentChoices.find((c) => c.id === input.choiceId)?.text ??
        "an unknown choice"; // Default text if choice isn't found

      const nextState = await generateStoryWithAI({
        previousStory: input.currentStory,
        choice: choiceMade,
        theme: input.gameTheme,
        spriteDesc: input.spriteDescription, // Pass to AI
      });
      const backgroundImageUrl = await generateImageWithAI(
        nextState.backgroundDescription
      );

      // Return data needed for frontend to save
      return {
        nextState: {
          story: nextState.story,
          choices: nextState.choices,
          backgroundDescription: nextState.backgroundDescription,
        },
        backgroundImageUrl,
      };
    }),
});

// IMPORTANT: Remember to add the UNIQUE index to your database schema for the upsert logic
// in `saveGame` to work reliably based on `userId`.
// Example schema addition (re-run drizzle-kit push:pg after adding):
// export const gameSaves = createTable(
//   "game_save",
//   { ... columns ... },
//   (table) => ({
//     userIdx: index("gameSave_userId_idx").on(table.userId),
//     userUniqueIdx: uniqueIndex("gameSave_user_unique_idx").on(table.userId), // <-- Add this
//   })
// ); 
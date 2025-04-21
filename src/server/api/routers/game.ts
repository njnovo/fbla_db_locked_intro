import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db"; // Import db instance
import { gameSaves } from "~/server/db/schema"; // Import gameSaves schema
import { eq } from "drizzle-orm";
import OpenAI from "openai"; // Import OpenAI client
import { env } from "~/env"; // For API keys
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions"; // Import message type

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

// Define a stricter type for AI story response
interface AIStoryResponse {
  story: string;
  choices: Array<{ id: number; text: string }>;
  backgroundDescription: string;
}

// Placeholder function - replace with actual OpenAI API call
async function generateImageWithAI(prompt: string): Promise<string> {
  console.log(`Generating image for prompt: "${prompt}"`);
  if (!env.OPENAI_API_KEY) {
     console.warn("OPENAI_API_KEY not set. Returning placeholder.");
     return `/placeholder-img-${prompt.substring(0, 15).replace(/[^a-z0-9]/gi, '-')}.png`;
  }
  
  try {
    // Actual OpenAI Image Generation Call
    const response = await openai.images.generate({
      model: "dall-e-3", // Or any available model
      prompt: prompt,
      n: 1,
      size: "1024x1024",
    });
    
    const imageUrl = response.data[0]?.url;
    if (!imageUrl) {
      throw new Error("Failed to generate image");
    }
    
    return imageUrl;
  } catch (error) {
    console.error("Error generating image with OpenAI:", error);
    // Return a placeholder on error
    return `/placeholder-ai-image.png`;
  }
}

// Placeholder function - replace with actual OpenAI API call
async function generateStoryWithAI(input: { 
  theme?: string, 
  previousStory?: string, 
  choice?: string, 
  spriteDesc?: string,
  conversationHistory?: ChatCompletionMessageParam[] // Use imported type
}): Promise<AIStoryResponse> {
    console.log(`AI TEXT API CALL: Generating story part for input:`, input);
    if (!env.OPENAI_API_KEY) {
       console.warn("OPENAI_API_KEY not set. Returning placeholder.");
       return {
           story: `(Placeholder: API Key Missing) Setting the scene for the ${input.theme ?? 'adventure'}...`,
           choices: [{id: 1, text: "Proceed"}, {id: 2, text: "Look around"}],
           backgroundDescription: `A placeholder background for ${input.theme ?? 'adventure'}`
       }
    }
    
    // Build conversation history if provided, otherwise create a basic history
    const messages: ChatCompletionMessageParam[] = input.conversationHistory ?? []; // Use imported type and initialize with ??
    
    // If no history provided, add system message and initial context
    if (messages.length === 0) {
      messages.push({ 
        role: "system", 
        content: "You are a choose-your-own-adventure game master. Generate engaging story segments with 2-4 choices for the player. For each response, provide a JSON object with three fields: 'story' (the current narrative), 'choices' (an array of options each with 'id' and 'text'), and 'backgroundDescription' (a detailed description for image generation)."
      });
      
      // Add initial theme and character context
      if (input.theme || input.spriteDesc) {
        messages.push({
          role: "user",
          content: `I want to play a ${input.theme ?? "fantasy"} adventure with a character described as: ${input.spriteDesc ?? "a brave adventurer"}.`
        });
      }
    }
    
    // Add the current choice/request to the conversation
    if (input.choice) {
      messages.push({
        role: "user",
        content: `I choose: ${input.choice}`
      });
    }
    
    // Add a structured prompt for the response format
    messages.push({
      role: "user",
      content: `Generate the next part of the story${input.previousStory ? " following from: " + input.previousStory : ""}. Include a vivid scene description, what happens next, and 2-4 choices for me. Return your response as a valid JSON object with these fields: "story" (the narrative text), "choices" (array of options with "id" and "text" fields), and "backgroundDescription" (a detailed visual description of the current scene for image generation).`
    });
    
    try {
      // Call OpenAI API
      const response = await openai.chat.completions.create({
        model: "gpt-4", // Or your desired model
        messages: messages, // No longer needs 'as any'
        response_format: { type: "json_object" }, // Request JSON response
      });
      
      // Parse the response
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("AI response content is missing or empty.");
      }
      const result = JSON.parse(content) as unknown;
      
      // Add AI's response to conversation history for next time
      messages.push({
        role: "assistant",
        content: content,
      });
      
      // Validate that the response has the expected structure using type guards
      if (
        typeof result === 'object' && 
        result !== null &&
        'story' in result && typeof result.story === 'string' &&
        'choices' in result && Array.isArray(result.choices) &&
        /* eslint-disable @typescript-eslint/no-unsafe-member-access */
        result.choices.every((c): c is {id: number; text: string} => 
          typeof c === 'object' && 
          c !== null && 
          'id' in c && 
          typeof c.id === 'number' && 
          'text' in c && 
          typeof c.text === 'string'
        ) &&
        /* eslint-enable @typescript-eslint/no-unsafe-member-access */
        'backgroundDescription' in result && typeof result.backgroundDescription === 'string'
      ) {
         return result as AIStoryResponse; // Type assertion is safe now
      } else {
         throw new Error("Invalid response format from AI after parsing.");
      }

    } catch (error) {
      console.error("Error calling OpenAI or parsing response:", error);
      
      // Fallback to mock data
      const baseStory = input.choice
        ? `Following choice '${input.choice}', something else happens in the ${input.theme ?? 'adventure'} setting.`
        : `Starting the adventure in a ${input.theme ?? 'adventure'} world with a character like ${input.spriteDesc ?? 'a brave adventurer'}.`;

      const choiceNum = Math.floor(Math.random() * 3) + 1;
      return {
        story: `${baseStory} What is the next move? (Random choice: ${choiceNum})`,
        choices: [
          { id: 1, text: `Option A (${choiceNum}) for ${input.theme ?? 'adventure'}` },
          { id: 2, text: `Option B (${choiceNum}) for ${input.theme ?? 'adventure'}` },
          { id: 3, text: `Option C (${choiceNum}) for ${input.theme ?? 'adventure'}` }
        ],
        backgroundDescription: `A dynamic background representing the current state (${choiceNum}) in the ${input.theme ?? 'adventure'} adventure.`
      };
    }
}

export const gameRouter = createTRPCRouter({
  // Procedure to load existing game or signal creation of a new one
  loadGame: publicProcedure // Changed from protectedProcedure to publicProcedure
    .query(async ({ ctx }) => {
      // Check if user is authenticated
      if (!ctx.session || !ctx.session.user) {
        // Return new game state with warning
        return { 
          status: "new",
          warning: "You are not logged in. Your game progress won't be saved to your account."
        } as const;
      }

      const userId = ctx.session.user.id;
      // Add proper type casting for db.query
      const existingSave = await (db.query as any).gameSaves.findFirst({
        where: eq(gameSaves.userId, userId),
        orderBy: (saves: any, { desc }: { desc: any }) => [desc(saves.updatedAt)], // Get the latest updated one if multiple exist
      });

      if (existingSave) {
        // For SQLite, we need to parse the JSON string into an array of choice objects
        let parsedChoices: Array<{ id: number; text: string }> = [];
        try {
          // Try to parse the string, but handle potential issues
          if (existingSave.currentChoices) {
            const choicesString = existingSave.currentChoices.toString();
            if (choicesString.trim()) {
              try {
                const parsed = JSON.parse(choicesString) as unknown;
                // Validate the structure matches our expected format
                if (Array.isArray(parsed) && 
                    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
                    parsed.every((item): item is {id: number; text: string} => 
                      typeof item === 'object' && 
                      item !== null && 
                      'id' in item && 
                      typeof item.id === 'number' && 
                      'text' in item && 
                      typeof item.text === 'string'
                    )
                    /* eslint-enable @typescript-eslint/no-unsafe-member-access */
                ) {
                  parsedChoices = parsed;
                }
              } catch (parseError) {
                console.error("Error parsing JSON structure:", parseError);
              }
            }
          }
        } catch (error) {
          console.error("Error parsing choices JSON:", error);
          // Default to empty array on parse error
          parsedChoices = [];
        }

        return {
          status: "loaded",
          saveData: {
            ...existingSave,
            currentChoices: parsedChoices,
          },
        } as const;
      } else {
        // No save found, signal frontend to start new game flow
        return { status: "new" } as const;
      }
    }),

  // Save the entire game state (call this after each successful step)
  saveGame: publicProcedure // Changed from protectedProcedure to publicProcedure
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
      // Check if user is authenticated
      if (!ctx.session || !ctx.session.user) {
        return { 
          success: true,
          warning: "Game state not saved to database. Log in to save your progress."
        };
      }

      const userId = ctx.session.user.id;

      // For SQLite, we need to stringify JSON data since SQLite doesn't have JSONB
      const choicesString = input.currentChoices ? JSON.stringify(input.currentChoices) : '[]';
      
      // Get current timestamp as seconds since epoch
      const currentTimestamp = Math.floor(Date.now() / 1000);

      // Check if a save already exists for this user - add type casting
      const existingSave = await (db.query as any).gameSaves.findFirst({
        where: eq(gameSaves.userId, userId),
      });

      if (existingSave) {
        // Update existing save
        await db
          .update(gameSaves)
          .set({
            gamePhase: input.gamePhase,
            spriteDescription: input.spriteDescription ?? null,
            spriteUrl: input.spriteUrl ?? null,
            gameTheme: input.gameTheme ?? null,
            currentStory: input.currentStory ?? null,
            currentChoices: choicesString,
            currentBackgroundDescription: input.currentBackgroundDescription ?? null,
            currentBackgroundImageUrl: input.currentBackgroundImageUrl ?? null,
            updatedAt: currentTimestamp,
          })
          .where(eq(gameSaves.userId, userId));
      } else {
        // Insert new save
        await db
          .insert(gameSaves)
          .values({
            userId: userId,
            gamePhase: input.gamePhase,
            spriteDescription: input.spriteDescription ?? null,
            spriteUrl: input.spriteUrl ?? null,
            gameTheme: input.gameTheme ?? null,
            currentStory: input.currentStory ?? null,
            currentChoices: choicesString,
            currentBackgroundDescription: input.currentBackgroundDescription ?? null,
            currentBackgroundImageUrl: input.currentBackgroundImageUrl ?? null,
            createdAt: currentTimestamp,
            updatedAt: currentTimestamp,
          });
      }

      return { success: true };
    }),

  // Generate Sprite - becomes public, saves URL after generation
  generateSprite: publicProcedure // Changed from protectedProcedure to publicProcedure
    .input(z.object({ description: z.string().min(1, "Description cannot be empty") })) // Added error message
    .mutation(async ({ ctx, input }) => { 
      // No database operations here, so we just add a warning if not logged in
      const isLoggedIn = !!(ctx.session && ctx.session.user);
      
      const imageUrl = await generateImageWithAI(
        `Retro character sprite (front view): ${input.description}`
      );
      
      return { 
        imageUrl,
        warning: isLoggedIn ? undefined : "You are not logged in. Your game progress won't be saved."
      };
    }),

  // Start Game - becomes public, generates initial state, frontend saves
  startGame: publicProcedure // Changed from protectedProcedure to publicProcedure
    .input(z.object({
        theme: z.string().min(1, "Theme cannot be empty"),
        // Ensure spriteDescription is required if needed by AI function
        spriteDescription: z.string().min(1, "Sprite description is required to start"),
    }))
    .mutation(async ({ ctx, input }) => {
      // No database operations here, so we just add a warning if not logged in
      const isLoggedIn = !!(ctx.session && ctx.session.user);
      
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
        warning: isLoggedIn ? undefined : "You are not logged in. Your game progress won't be saved."
      };
    }),

  // Make Choice - becomes public, generates next state, frontend saves
  makeChoice: publicProcedure // Changed from protectedProcedure to publicProcedure
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
    .mutation(async ({ ctx, input }) => {
      // No database operations here, so we just add a warning if not logged in
      const isLoggedIn = !!(ctx.session && ctx.session.user);
      
      const choiceMade =
        input.currentChoices.find((c) => c.id === input.choiceId)?.text ??
        "an unknown choice"; // Default text if choice isn't found

      const nextState = await generateStoryWithAI({
        previousStory: input.currentStory,
        choice: choiceMade,
        theme: input.gameTheme,
        spriteDesc: input.spriteDescription,
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
        warning: isLoggedIn ? undefined : "You are not logged in. Your game progress won't be saved."
      };
    }),

  // WASD Movement - handle directional movement in the game
  handleMovement: publicProcedure
    .input(
      z.object({
        direction: z.enum(["w", "a", "s", "d"]),
        currentStory: z.string(),
        currentChoices: z.array(
          z.object({ id: z.number(), text: z.string() })
        ),
        gameTheme: z.string(),
        spriteDescription: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Map WASD keys to movement directions
      const directionMap = {
        w: "move forward",
        a: "move left",
        s: "move backward",
        d: "move right"
      };
      
      const movementAction = directionMap[input.direction];
      const isLoggedIn = !!(ctx.session && ctx.session.user);
      
      // Generate story based on the movement direction
      const nextState = await generateStoryWithAI({
        previousStory: input.currentStory,
        choice: `I ${movementAction}`,
        theme: input.gameTheme,
        spriteDesc: input.spriteDescription,
      });
      
      const backgroundImageUrl = await generateImageWithAI(
        nextState.backgroundDescription
      );

      return {
        nextState: {
          story: nextState.story,
          choices: nextState.choices,
          backgroundDescription: nextState.backgroundDescription,
        },
        backgroundImageUrl,
        warning: isLoggedIn ? undefined : "You are not logged in. Your game progress won't be saved."
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
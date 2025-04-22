import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db"; // Import db instance
import { gameSaves } from "~/server/db/schema"; // Import gameSaves schema
import { eq, and } from "drizzle-orm";
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
  isGameOver: boolean;
}

// Placeholder function - replace with actual OpenAI API call
async function generateImageWithAI(prompt: string, isSprite: boolean): Promise<string> {
  console.log(`Generating image for prompt: "${prompt}"`);
  if (!env.OPENAI_API_KEY) {
     console.warn("OPENAI_API_KEY not set. Returning placeholder.");
     return `/placeholder-img-${prompt.substring(0, 15).replace(/[^a-z0-9]/gi, '-')}.png`;
  }
  
  try {
    // Actual OpenAI Image Generation Call
    let response;
    if(isSprite) {
      response = await openai.images.generate({
        model: "dall-e-3", // Or any available model
        prompt: prompt+"retro style",
        n: 1,
        size: "1024x1024",
      });
    } else {
      response = await openai.images.generate({
        model: "dall-e-3", // Or any available model
        prompt: prompt+"retro style as if it was the background of a video game, with a path going from left to right",
        n: 1,
        size: "1024x1024",
      });
    }

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
           backgroundDescription: `A placeholder background for ${input.theme ?? 'adventure'}`,
           isGameOver: false
       }
    }
    
    // Build conversation history if provided, otherwise create a basic history
    const messages: ChatCompletionMessageParam[] = input.conversationHistory ?? []; // Use imported type and initialize with ??
    
    // If no history provided, add system message and initial context
    if (messages.length === 0) {
      messages.push({ 
        role: "system", 
        content: "You are a choose-your-own-adventure game master. Generate engaging story segments with 3 choices for the player. For each response, provide a JSON object with three fields: 'story' (the current narrative), 'choices' (an array of options each with 'id' and 'text'), and 'backgroundDescription' (a detailed description for image generation).  If the user blunders, they should die and all three of the choices in the json object should be 'game over!'. The game should be easy to die in."
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
      console.log("About to call OpenAI API with model: gpt-3.5-turbo");
      console.log("Messages structure:", JSON.stringify(messages.map(m => ({ 
        role: m.role, 
        contentLength: m.content ? m.content.length : 0 
      }))));
      
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo", // Change to gpt-3.5-turbo as a test
        messages: messages,
        response_format: { type: "json_object" }, // Request JSON response
      });
      
      console.log("OpenAI API response received:", {
        id: response.id,
        model: response.model,
        choicesCount: response.choices.length,
        firstChoiceContent: response.choices[0]?.message?.content?.substring(0, 100) + "..."
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
         // Check if this is a game over response (all choices are "Game Over")
         const parsedResult = result as AIStoryResponse;
         const isGameOverResponse = checkIfGameOver(parsedResult.choices);
         
         // Return the result with an indicator if it's a game over
         parsedResult.isGameOver = isGameOverResponse;
         return parsedResult;
      } else {
         throw new Error("Invalid response format from AI after parsing.");
      }

    } catch (error) {
      console.error("Error calling OpenAI or parsing response:", error);
      // Log more detailed error information
      if (error instanceof Error) {
        console.error(`Error details - Name: ${error.name}, Message: ${error.message}`);
        console.error(`Stack trace: ${error.stack}`);
      }
      
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
        backgroundDescription: `A dynamic background representing the current state (${choiceNum}) in the ${input.theme ?? 'adventure'} adventure.`,
        isGameOver: false
      };
    }
}

// Helper function to check if all choices indicate a game over
function checkIfGameOver(choices: Array<{id: number; text: string}>): boolean {
  return choices.length > 0 && 
    choices.every(choice => 
      choice.text.toLowerCase().includes("game over")
    );
}

export const gameRouter = createTRPCRouter({
  // Get all save slots for a user
  getSaveSlots: publicProcedure
    .query(async ({ ctx }) => {
      // Check if user is authenticated
      if (!ctx.session || !ctx.session.user) {
        console.log("getSaveSlots: User not authenticated");
        return { 
          status: "unauthenticated",
          warning: "You are not logged in. Your game progress won't be saved to your account."
        } as const;
      }

      const userId = ctx.session.user.id;
      console.log("getSaveSlots: Fetching slots for user ID:", userId);
      
      // Get all save slots for the user
      const saveSlots = await db
        .select()
        .from(gameSaves)
        .where(eq(gameSaves.userId, userId))
        .orderBy(gameSaves.slotNumber);

      console.log("getSaveSlots: Raw database results:", saveSlots);

      // Process each save slot's data
      const processedSlots = [];
      for (let i = 1; i <= 3; i++) {
        const slot = saveSlots.find(slot => Number(slot.slotNumber) === i);
        
        if (slot) {
          console.log(`getSaveSlots: Found slot ${i}:`, slot);
          // Parse the choices from JSON string
          let parsedChoices: Array<{ id: number; text: string }> = [];
          try {
            if (slot.currentChoices) {
              const choicesString = slot.currentChoices.toString();
              if (choicesString.trim()) {
                try {
                  const parsed = JSON.parse(choicesString) as unknown;
                  // Validate the structure
                  if (Array.isArray(parsed) && 
                      parsed.every((item): item is {id: number; text: string} => 
                        typeof item === 'object' && 
                        item !== null && 
                        'id' in item && 
                        typeof item.id === 'number' && 
                        'text' in item && 
                        typeof item.text === 'string'
                      )
                  ) {
                    parsedChoices = parsed;
                  }
                } catch (parseError) {
                  console.error(`Error parsing JSON structure for slot ${i}:`, parseError);
                }
              }
            }
          } catch (error) {
            console.error(`Error processing choices for slot ${i}:`, error);
            parsedChoices = [];
          }

          // Check if this is actually a complete save
          const slotIsEmpty = !slot.gamePhase || !slot.spriteUrl;
          console.log(`getSaveSlots: Slot ${i} isEmpty check:`, { 
            slotIsEmpty,
            hasGamePhase: !!slot.gamePhase,
            hasSpriteUrl: !!slot.spriteUrl
          });

          processedSlots.push({
            slotNumber: i,
            slotName: slot.slotName || `Save Slot ${i}`,
            isEmpty: slotIsEmpty, // Only mark as non-empty if it has required fields
            gamePhase: slot.gamePhase,
            spriteDescription: slot.spriteDescription,
            spriteUrl: slot.spriteUrl,
            gameTheme: slot.gameTheme,
            currentStory: slot.currentStory,
            currentChoices: parsedChoices,
            currentBackgroundImageUrl: slot.currentBackgroundImageUrl,
            score: slot.score || 0,
            updatedAt: slot.updatedAt,
          });
        } else {
          console.log(`getSaveSlots: No data for slot ${i}, marking as empty`);
          // Empty slot
          processedSlots.push({
            slotNumber: i,
            slotName: `Save Slot ${i}`,
            isEmpty: true,
          });
        }
      }

      console.log("getSaveSlots: Returning processed slots:", processedSlots);
      return { 
        status: "success",
        saveSlots: processedSlots
      } as const;
    }),

  // Load a specific save slot
  loadGameSlot: publicProcedure
    .input(z.object({
      slotNumber: z.number().int().min(1).max(3)
    }))
    .query(async ({ ctx, input }) => {
      // Check if user is authenticated
      if (!ctx.session || !ctx.session.user) {
        return { 
          status: "unauthenticated",
          warning: "You are not logged in. Your game progress won't be saved to your account."
        } as const;
      }

      const userId = ctx.session.user.id;
      
      // Find the save for the specified slot
      const existingSave = await db
        .select()
        .from(gameSaves)
        .where(
          and(
            eq(gameSaves.userId, userId),
            eq(gameSaves.slotNumber, input.slotNumber)
          )
        )
        .limit(1);

      if (existingSave.length > 0) {
        const save = existingSave[0];
        // Parse choices
        let parsedChoices: Array<{ id: number; text: string }> = [];
        try {
          if (save && save.currentChoices) {
            const choicesString = save.currentChoices.toString();
            if (choicesString.trim()) {
              try {
                const parsed = JSON.parse(choicesString) as unknown;
                // Validate the structure
                if (Array.isArray(parsed) && 
                    parsed.every((item): item is {id: number; text: string} => 
                      typeof item === 'object' && 
                      item !== null && 
                      'id' in item && 
                      typeof item.id === 'number' && 
                      'text' in item && 
                      typeof item.text === 'string'
                    )
                ) {
                  parsedChoices = parsed;
                }
              } catch (parseError) {
                console.error(`Error parsing JSON structure:`, parseError);
              }
            }
          }
        } catch (error) {
          console.error(`Error processing choices:`, error);
          parsedChoices = [];
        }

        return {
          status: "loaded",
          saveData: {
            ...save,
            currentChoices: parsedChoices,
          },
        } as const;
      } else {
        // No save found for this slot
        return { status: "empty", slotNumber: input.slotNumber } as const;
      }
    }),

  // Procedure to load existing game or signal creation of a new one (legacy, will be removed later)
  loadGame: publicProcedure
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
      // Get all save slots
      const saveSlots = await db
        .select()
        .from(gameSaves)
        .where(eq(gameSaves.userId, userId))
        .orderBy(gameSaves.updatedAt);

      if (saveSlots.length > 0) {
        const mostRecentSave = saveSlots[0];
        // For SQLite, we need to parse the JSON string into an array of choice objects
        let parsedChoices: Array<{ id: number; text: string }> = [];
        try {
          // Try to parse the string, but handle potential issues
          if (mostRecentSave && mostRecentSave.currentChoices) {
            const choicesString = mostRecentSave.currentChoices.toString();
            if (choicesString.trim()) {
              try {
                const parsed = JSON.parse(choicesString) as unknown;
                // Validate the structure matches our expected format
                if (Array.isArray(parsed) && 
                    parsed.every((item): item is {id: number; text: string} => 
                      typeof item === 'object' && 
                      item !== null && 
                      'id' in item && 
                      typeof item.id === 'number' && 
                      'text' in item && 
                      typeof item.text === 'string'
                    )
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
            ...mostRecentSave,
            currentChoices: parsedChoices,
          },
        } as const;
      } else {
        // No save found, signal frontend to start new game flow
        return { status: "new" } as const;
      }
    }),

  // Save the game state to a specific slot
  saveGameSlot: publicProcedure
    .input(
      z.object({
        slotNumber: z.number(),
        gamePhase: z.enum(["sprite", "theme", "playing"]),
        slotName: z.string().optional(),
        spriteDescription: z.string().nullable().optional(),
        spriteUrl: z.string().nullable().optional(),
        gameTheme: z.string().nullable().optional(),
        currentStory: z.string().nullable().optional(),
        currentChoices: z.array(z.object({ id: z.number(), text: z.string() })).optional(),
        currentBackgroundDescription: z.string().nullable().optional(),
        currentBackgroundImageUrl: z.string().nullable().optional(),
        score: z.number().optional(),
        spritePosition: z.any().optional(), // Keep as any for compatibility with different position formats
      })
    )
    .mutation(async ({ ctx, input }) => {
      console.log("saveGameSlot: Starting save operation with input:", { 
        slotNumber: input.slotNumber,
        gamePhase: input.gamePhase,
        hasChoices: !!input.currentChoices?.length
      });
      
      // Check raw session data to debug authentication
      console.log("saveGameSlot: Session debug:", {
        hasSession: !!ctx.session,
        hasUser: !!(ctx.session?.user),
        userId: ctx.session?.user?.id,
        name: ctx.session?.user?.name,
        email: ctx.session?.user?.email
      });
      
      // Check if user is authenticated
      if (!ctx.session || !ctx.session.user) {
        console.log("saveGameSlot: User not authenticated, returning warning");
        return { 
          success: false,
          warning: "Game state not saved to database. Log in to save your progress."
        };
      }

      const userId = ctx.session.user.id;
      console.log("saveGameSlot: Saving for user ID:", userId);

      // For SQLite, we need to stringify JSON data since SQLite doesn't have JSONB
      const choicesString = input.currentChoices ? JSON.stringify(input.currentChoices) : '[]';
      
      // Get current timestamp as seconds since epoch
      const currentTimestamp = Math.floor(Date.now() / 1000);

      // Check if a save already exists for this user and slot
      const existingSave = await db
        .select()
        .from(gameSaves)
        .where(
          and(
            eq(gameSaves.userId, userId),
            eq(gameSaves.slotNumber, input.slotNumber)
          )
        )
        .limit(1);
      
      console.log("saveGameSlot: Existing save found:", existingSave.length > 0);

      // Calculate score increment - each save increments score by 1 for screens seen
      const currentScore = existingSave.length > 0 && existingSave[0] ? (existingSave[0].score || 0) : 0;
      const newScore = input.score !== undefined ? input.score : currentScore + 1;

      try {
        if (existingSave.length > 0) {
          // Update existing save
          console.log("saveGameSlot: Updating existing save, setting:", {
            gamePhase: input.gamePhase,
            score: newScore
          });
          
          await db
            .update(gameSaves)
            .set({
              gamePhase: input.gamePhase,
              slotName: input.slotName,
              spriteDescription: input.spriteDescription ?? null,
              spriteUrl: input.spriteUrl ?? null,
              gameTheme: input.gameTheme ?? null,
              currentStory: input.currentStory ?? null,
              currentChoices: choicesString,
              currentBackgroundDescription: input.currentBackgroundDescription ?? null,
              currentBackgroundImageUrl: input.currentBackgroundImageUrl ?? null,
              score: newScore,
              updatedAt: currentTimestamp,
            })
            .where(
              and(
                eq(gameSaves.userId, userId),
                eq(gameSaves.slotNumber, input.slotNumber)
              )
            );
        } else {
          // Insert new save
          console.log("saveGameSlot: Inserting new save with:", {
            slotNumber: input.slotNumber,
            gamePhase: input.gamePhase,
            score: newScore
          });
          
          await db
            .insert(gameSaves)
            .values({
              userId: userId,
              slotNumber: input.slotNumber,
              gamePhase: input.gamePhase,
              slotName: input.slotName || `Save Slot ${input.slotNumber}`,
              spriteDescription: input.spriteDescription ?? null,
              spriteUrl: input.spriteUrl ?? null,
              gameTheme: input.gameTheme ?? null,
              currentStory: input.currentStory ?? null,
              currentChoices: choicesString,
              currentBackgroundDescription: input.currentBackgroundDescription ?? null,
              currentBackgroundImageUrl: input.currentBackgroundImageUrl ?? null,
              score: newScore,
              createdAt: currentTimestamp,
              updatedAt: currentTimestamp,
            });
        }
        
        console.log("saveGameSlot: Save operation successful");
        return { 
          success: true,
          slotNumber: input.slotNumber,
          score: newScore
        };
      } catch (error) {
        console.error("saveGameSlot: Database error during save:", error);
        throw error;
      }
    }),

  // Legacy save method - will be removed later
  saveGame: publicProcedure
    .input(
      z.object({
        gamePhase: z.enum(["sprite", "theme", "playing"]),
        spriteDescription: z.string().nullish(),
        spriteUrl: z.string().nullish(),
        gameTheme: z.string().nullish(),
        currentStory: z.string().nullish(),
        currentChoices: z.array(z.object({ id: z.number(), text: z.string() })).nullish(),
        currentBackgroundDescription: z.string().nullish(),
        currentBackgroundImageUrl: z.string().nullish(),
        spritePosition: z.any().nullish(), // Keep for compatibility
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

      // Check if any saves exist for this user
      const existingSaves = await db
        .select()
        .from(gameSaves)
        .where(eq(gameSaves.userId, userId))
        .orderBy(gameSaves.updatedAt);

      // Use slot 1 by default for legacy saves
      const slotNumber = 1;
      const currentScore = existingSaves.length > 0 && existingSaves[0] ? (existingSaves[0].score || 0) : 0;
      const newScore = currentScore + 1;

      if (existingSaves.length > 0 && existingSaves[0]) {
        // Update most recent save
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
            score: newScore,
            updatedAt: currentTimestamp,
          })
          .where(eq(gameSaves.id, existingSaves[0].id));
      } else {
        // Insert new save in slot 1
        await db
          .insert(gameSaves)
          .values({
            userId: userId,
            slotNumber: slotNumber,
            slotName: "Save Slot 1",
            gamePhase: input.gamePhase,
            spriteDescription: input.spriteDescription ?? null,
            spriteUrl: input.spriteUrl ?? null,
            gameTheme: input.gameTheme ?? null,
            currentStory: input.currentStory ?? null,
            currentChoices: choicesString,
            currentBackgroundDescription: input.currentBackgroundDescription ?? null,
            currentBackgroundImageUrl: input.currentBackgroundImageUrl ?? null,
            score: newScore,
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
        `Retro character sprite (front view): ${input.description}`,
        true // This is a sprite
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
        initialState.backgroundDescription,
        false // This is a background
      );

      // Check if this is a game over state (shouldn't happen at start, but just in case)
      if (initialState.isGameOver) {
        return {
          initialState: {
            story: initialState.story,
            choices: initialState.choices,
            backgroundDescription: initialState.backgroundDescription,
          },
          backgroundImageUrl,
          warning: isLoggedIn ? undefined : "You are not logged in. Your game progress won't be saved.",
          gameOver: true,
          gameOverReason: "Your adventure ended before it could begin!"
        };
      }

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
  makeChoice: publicProcedure
    .input(
      z.object({
        choiceId: z.number(),
        currentStory: z.string(),
        currentChoices: z.array(
          z.object({ id: z.number(), text: z.string() })
        ),
        gameTheme: z.string(),
        spriteDescription: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const isLoggedIn = !!(ctx.session && ctx.session.user);
        
        // Find the selected choice text
        const selectedChoice = input.currentChoices.find(
          (c) => c.id === input.choiceId
        );

        if (!selectedChoice) {
          throw new Error("Invalid choice selected.");
        }

        // Determine if this choice is a blunder (10% chance randomly)
        const isBlunder = Math.random() < 0.1;

        if (isBlunder) {
          // Return game over state
          return {
            nextState: {
              story: "Game Over! You made a fatal mistake.",
              backgroundDescription: "A dark and gloomy scene.",
              choices: [
                { id: 1, text: "Game Over" },
                { id: 2, text: "Game Over" },
                { id: 3, text: "Game Over" }
              ]
            },
            backgroundImageUrl: "", // Empty to keep current
            warning: isLoggedIn ? undefined : "You are not logged in. Your game progress won't be saved.",
            gameOver: true,
            gameOverReason: "You made a wrong choice and your adventure ended!"
          };
        }

        // Regular game continuation
        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are a choose-your-own-adventure game master. Generate engaging story segments with 2-4 choices for the player. For each response, provide a JSON object with three fields: 'story' (the current narrative), 'choices' (an array of options each with 'id' and 'text'), and 'backgroundDescription' (a detailed description for image generation).  If the user blunders, they should die and all three of the choices in the json object should be 'game over!'"
            },
            {
              role: "user",
              content: `Generate the next part of the story following from: ${input.currentStory}. Include a vivid scene description, what happens next, and 2-4 choices for me. Return your response as a valid JSON object with these fields: "story" (the narrative text), "choices" (array of options with "id" and "text" fields), and "backgroundDescription" (a detailed visual description of the current scene for image generation).`
            }
          ],
          response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("AI response content is missing or empty.");
        }
        const nextState = JSON.parse(content) as AIStoryResponse;

        // Check if all choices are "Game Over" to trigger game over sequence
        const allChoicesAreGameOver = nextState.choices.length > 0 && 
          nextState.choices.every(choice => 
            choice.text.toLowerCase().includes("game over")
          );

        // Mark as game over if all choices are game over
        nextState.isGameOver = allChoicesAreGameOver;

        // Handle game over state
        if (nextState.isGameOver) {
          return {
            nextState: {
              story: nextState.story,
              choices: nextState.choices,
              backgroundDescription: nextState.backgroundDescription,
            },
            backgroundImageUrl: await generateImageWithAI(
              nextState.backgroundDescription,
              false
            ),
            warning: isLoggedIn ? undefined : "You are not logged in. Your game progress won't be saved.",
            gameOver: true,
            gameOverReason: "Your adventure has come to an end!"
          };
        }

        const backgroundImageUrl = await generateImageWithAI(
          nextState.backgroundDescription,
          false // This is a background
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
      } catch (error) {
        console.error("Error generating next state:", error);
        return {
          nextState: {
            story: "Game Over! An error occurred.",
            backgroundDescription: "A dark and gloomy scene.",
            choices: [
              { id: 1, text: "Game Over" },
              { id: 2, text: "Game Over" },
              { id: 3, text: "Game Over" }
            ]
          },
          backgroundImageUrl: "",
          warning: "An error occurred. Your game progress won't be saved.",
          gameOver: true,
          gameOverReason: "An error occurred. Please try again later."
        };
      }
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
      // For our platformer mechanics, we don't generate new content for WASD movement
      // The movements are handled client-side with physics
      // This endpoint now just returns the current state unchanged
      
      const isLoggedIn = !!(ctx.session && ctx.session.user);
      
      return {
        nextState: {
          story: input.currentStory,
          choices: input.currentChoices,
          backgroundDescription: "", // Empty since we're not changing the background
        },
        backgroundImageUrl: "", // Return empty to keep current background
        warning: isLoggedIn ? undefined : "You are not logged in. Your game progress won't be saved."
      };
    }),

  // Delete a game save
  deleteGameSave: publicProcedure
    .input(
      z.object({
        slotNumber: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user is authenticated
      if (!ctx.session || !ctx.session.user) {
        return { 
          success: false,
          message: "User not authenticated"
        };
      }

      const userId = ctx.session.user.id;

      // Delete the game save
      await db
        .delete(gameSaves)
        .where(
          and(
            eq(gameSaves.userId, userId),
            eq(gameSaves.slotNumber, input.slotNumber)
          )
        );

      return {
        success: true,
        message: "Game save deleted successfully"
      };
    }),

  // Generate a game report
  generateGameReport: publicProcedure
    .input(
      z.object({
        score: z.number(),
        theme: z.string(),
        spriteDescription: z.string(),
        reason: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Generate report content using AI helper function
        const reportContent = await generateAIGameReport(
          input.score,
          input.theme,
          input.spriteDescription,
          input.reason
        );

        return {
          success: true,
          report: reportContent
        };
      } catch (error) {
        console.error("Error generating game report:", error);
        return {
          success: false,
          report: `Game Over! You achieved a score of ${input.score}.\n\nYour adventure as "${input.spriteDescription}" in the world of "${input.theme}" has come to an end.\n\nReason: ${input.reason}`
        };
      }
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

// Helper function to generate a game report using AI
async function generateAIGameReport(
  score: number,
  theme: string,
  spriteDescription: string,
  reason: string
): Promise<string> {
  // For now, we'll just generate a simple report without AI
  // In a real implementation, you would call an AI service here
  
  const report = `# GAME OVER

Final Score: ${score}

You played as "${spriteDescription}" in the world of "${theme}".

Your adventure came to an end because: ${reason}

${score > 10 ? "Impressive score! You were doing really well." : "Better luck next time!"}

${generateRandomTip()}
`;

  return report;
}

// Generate a random gameplay tip
function generateRandomTip(): string {
  const tips = [
    "Tip: Try to avoid falling off the screen!",
    "Tip: The more choices you make, the higher your score.",
    "Tip: Sometimes the safest path is the best path.",
    "Tip: Pay attention to your surroundings.",
    "Tip: Different choices lead to different adventures."
  ];
  
  return tips[Math.floor(Math.random() * tips.length)] || "Tip: Practice makes perfect!";
} 
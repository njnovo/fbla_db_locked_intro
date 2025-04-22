import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { eq } from "drizzle-orm";

export const userRouter = createTRPCRouter({
  getUserData: publicProcedure
    .query(async ({ ctx }) => {
      // Check if user is authenticated
      if (!ctx.session || !ctx.session.user) {
        return { 
          highScore: 0
        };
      }

      const userId = ctx.session.user.id;

      // Get user data
      const userData = await db
        .select({
          highScore: users.highScore
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (userData.length === 0) {
        return { highScore: 0 };
      }

      return {
        highScore: userData[0]!.highScore ?? 0
      };
    }),

  updateHighScore: publicProcedure
    .input(
      z.object({
        score: z.number(),
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

      // Get current high score
      const userData = await db
        .select({
          highScore: users.highScore
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const currentHighScore = userData[0]?.highScore ?? 0;

      // Only update if new score is higher
      if (input.score > currentHighScore) {
        await db
          .update(users)
          .set({
            highScore: input.score
          })
          .where(eq(users.id, userId));

        return {
          success: true,
          message: "High score updated",
          newHighScore: input.score
        };
      }

      return {
        success: false,
        message: "Score not high enough to update high score",
        currentHighScore
      };
    }),
}); 
"use client"; // Required for useState, useEffect

import { useState, useEffect } from "react";
import { api } from "~/trpc/react"; // <--- Import the TRPC client
import { signIn, useSession } from "next-auth/react"; // Import useSession and signIn
import Link from "next/link"; // For linking back home
import { Layout } from "~/components/Layout";
import { Container } from "~/components/Container";
import { Button } from "~/components/Button";
import { LoadingIndicator } from "~/components/LoadingIndicator";
import { ErrorMessage } from "~/components/ErrorMessage"; // Import ErrorMessage
import type { AppRouter } from "~/server/api/root"; // Import AppRouter for types
import type { TRPCClientErrorLike } from "@trpc/client"; // Import error type

// Define types for game state (optional but good practice)
interface Choice {
  id: number;
  text: string;
}

interface GameState {
  story: string;
  choices: Choice[];
  backgroundDescription: string; // Description used for generating bg image
  // Add other relevant game state fields here later
}

// Type for the error from loadGame query
type LoadGameError = TRPCClientErrorLike<AppRouter>;

export default function GamePage() {
  const { data: session, status: sessionStatus } = useSession(); // Get session status

  const [gamePhase, setGamePhase] = useState<"sprite" | "theme" | "playing" | "loading">(
    "loading", // Start in loading state
  );
  const [spriteDescription, setSpriteDescription] = useState("");
  const [spriteUrl, setSpriteUrl] = useState<string | null>(null);
  const [gameTheme, setGameTheme] = useState("");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null); // URL for the dynamically generated background

  // --- tRPC Query to Load Game (Refactored onSuccess/onError) ---
  const { data: loadedGameData, isLoading: isLoadingGame, error: loadGameError, status: loadGameStatus } = api.game.loadGame.useQuery(
    undefined,
    {
      enabled: sessionStatus === "authenticated",
      staleTime: Infinity,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  // --- Handle Load Game Success/Error with useEffect ---
  useEffect(() => {
    if (loadGameStatus === 'success' && loadedGameData) {
       if (loadedGameData && typeof loadedGameData === 'object' && 'status' in loadedGameData) {
           const data = loadedGameData; // No need for 'as' assertion now

           if (data.status === "loaded" && 'saveData' in data && data.saveData) {
              console.log("Loaded existing game save:", data.saveData);
              setGamePhase(data.saveData.gamePhase as "sprite" | "theme" | "playing");
              setSpriteDescription(data.saveData.spriteDescription ?? "");
              setSpriteUrl(data.saveData.spriteUrl);
              setGameTheme(data.saveData.gameTheme ?? "");
              setBackgroundImageUrl(data.saveData.currentBackgroundImageUrl);
              if (data.saveData.gamePhase === 'playing') {
                setGameState({
                    story: data.saveData.currentStory ?? "",
                    choices: Array.isArray(data.saveData.currentChoices) ? data.saveData.currentChoices : [],
                    backgroundDescription: data.saveData.currentBackgroundDescription ?? "",
                });
              } else {
                  setGameState(null);
              }
            } else if (data.status === "new") {
              console.log("No existing save, starting new game flow.");
              setGamePhase("sprite");
              setSpriteDescription("");
              setSpriteUrl(null);
              setGameTheme("");
              setGameState(null);
              setBackgroundImageUrl(null);
            }
       }
    } else if (loadGameStatus === 'error' && loadGameError) {
        const error = loadGameError; // Removed unnecessary assertion
        console.error("Error loading game:", error);
    }
  }, [loadGameStatus, loadedGameData, loadGameError]);

  // --- tRPC Mutation to Save Game ---
  const saveGameMutation = api.game.saveGame.useMutation({
      onSuccess: () => {
          console.log("Game saved successfully.");
      },
      onError: (error: LoadGameError) => { // Add explicit type
          console.error("Error saving game:", error);
          alert(`Failed to save game: ${error.message}`);
      },
  });

  // Helper function to trigger save
  const triggerSave = () => {
      // Check gamePhase state *before* creating saveData object
      if (sessionStatus !== "authenticated" || gamePhase === 'loading') return;

      const saveData = {
          gamePhase: gamePhase,
          spriteDescription: spriteDescription ?? null,
          spriteUrl: spriteUrl ?? null,
          gameTheme: gameTheme ?? null,
          currentStory: gameState?.story ?? null,
          currentChoices: gameState?.choices ?? [],
          currentBackgroundDescription: gameState?.backgroundDescription ?? null,
          currentBackgroundImageUrl: backgroundImageUrl ?? null,
      };
      console.log("Triggering save with data:", saveData);
      saveGameMutation.mutate(saveData);
  };

  // Handle starting a new game
  const handleNewGame = () => {
    setGamePhase("sprite");
    setSpriteDescription("");
    setSpriteUrl(null);
    setGameTheme("");
    setGameState(null);
    setBackgroundImageUrl(null);
    
    // Save the new state
    triggerSave();
  };

  // --- Other tRPC Mutations (Add error types) ---
  const generateSpriteMutation = api.game.generateSprite.useMutation({
    onSuccess: (data) => {
      console.log("Sprite generated:", data);
      setSpriteUrl(data.imageUrl);
      setGamePhase("theme");
      // Defer save until after state is set
      // Use useEffect to save when relevant states change or trigger manually after setStates
      // Let's trigger save manually after setting state for clarity here
       triggerSave(); // NOTE: This relies on the previous `gamePhase` state, which might not be ideal.
                     // A better approach might be to pass the intended next phase to triggerSave.
    },
    onError: (error: LoadGameError) => { // Add explicit type
       console.error("Sprite generation error:", error);
       alert(`Error generating sprite: ${error.message}`);
    },
  });

  const startGameMutation = api.game.startGame.useMutation({
    onSuccess: (data) => {
        console.log("Game started:", data);
        setGameState(data.initialState);
        setBackgroundImageUrl(data.backgroundImageUrl);
        setGamePhase("playing");
         // Trigger save after setting state
         triggerSave(); // Similar note as above applies
    },
     onError: (error: LoadGameError) => { // Add explicit type
        console.error("Start game error:", error);
        alert(`Error starting game: ${error.message}`);
    },
  });

   const makeChoiceMutation = api.game.makeChoice.useMutation({
    onSuccess: (data) => {
        console.log("Choice made, next state:", data);
        setGameState(data.nextState);
        setBackgroundImageUrl(data.backgroundImageUrl);
         // Trigger save after setting state
         triggerSave();
    },
     onError: (error: LoadGameError) => { // Add explicit type
       console.error("Make choice error:", error);
       alert(`Error making choice: ${error.message}`);
    },
   });

  // --- Event Handlers (call mutations, state updates happen in onSuccess) ---
  const handleSpriteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!spriteDescription.trim() || generateSpriteMutation.isPending) return;
    generateSpriteMutation.mutate({ description: spriteDescription });
  };

  const handleThemeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Sprite description must exist to start game (as it's needed by AI)
    if (!gameTheme.trim() || !spriteDescription || startGameMutation.isPending) return;
    startGameMutation.mutate({ theme: gameTheme, spriteDescription });
  };

  const handleChoiceSelection = (choiceId: number) => {
    // Game state, theme, and sprite description must exist
    if (!gameState || !gameTheme || !spriteDescription || makeChoiceMutation.isPending) return;
    makeChoiceMutation.mutate({
        choiceId,
        currentStory: gameState.story,
        currentChoices: gameState.choices,
        gameTheme: gameTheme,
        spriteDescription: spriteDescription
    });
  };

  // --- Render Logic ---

  // Handle Auth Loading / Unauthenticated states first
  if (sessionStatus === "loading" || (sessionStatus === 'authenticated' && isLoadingGame)) { // Adjust loading condition
    return (
      <Layout>
        <LoadingIndicator text="Loading Session..." />
      </Layout>
    );
  }

  if (sessionStatus === "unauthenticated") {
     return (
      <Layout>
        <Container className="gap-6">
          <h1 className="text-4xl font-bold">Access Denied</h1>
          <p className="text-xl">You need to be signed in to play.</p>
          <Button variant="secondary" onClick={() => void signIn()}>
            Sign In
          </Button>
          <Link href="/" className="text-purple-300 hover:text-purple-100">
            Go back home
          </Link>
        </Container>
      </Layout>
    );
  }

  // Display combined loading/mutation errors (adjust error checking)
  const mutationError = generateSpriteMutation.error ?? startGameMutation.error ?? makeChoiceMutation.error ?? saveGameMutation.error;
  if (mutationError) { // Check if any mutation has an error
      return (
          <Layout>
              <Container>
                  <ErrorMessage message={mutationError.message} />
                   <Link href="/" className="text-purple-300 hover:text-purple-100">
                      Go back home
                  </Link>
              </Container>
          </Layout>
      );
  }
   if (loadGameStatus === 'error' && loadGameError) { // Check query error separately
      return (
       <Layout>
           <Container className="gap-4">
               <ErrorMessage message={`loading game data: ${loadGameError.message}`} />
                <Link href="/" className="text-purple-300 hover:text-purple-100">
                   Go back home
               </Link>
           </Container>
       </Layout>
      );
  }

  // Main Render Content function (similar to before, but uses combined loading state)
  const renderContent = () => {
    const isMutating = generateSpriteMutation.isPending || startGameMutation.isPending || makeChoiceMutation.isPending || saveGameMutation.isPending;

    if (gamePhase === "loading" || (loadGameStatus === 'pending' && sessionStatus === 'authenticated')) {
       return <LoadingIndicator text="Loading Game Data..." />;
    }

    switch (gamePhase) {
      case "sprite":
        return (
          <div className="text-center w-full max-w-md">
            <h2 className="text-3xl font-bold mb-6">Create Your Character</h2>
            <form onSubmit={handleSpriteSubmit} className="flex flex-col items-center gap-4">
              <label htmlFor="spriteDesc" className="text-lg">Describe your character:</label>
              <input
                id="spriteDesc"
                type="text"
                value={spriteDescription}
                onChange={(e) => setSpriteDescription(e.target.value)}
                placeholder="e.g., A brave knight with shining armor"
                className="p-2 rounded bg-white/20 text-white w-full disabled:opacity-70"
                required
                disabled={isMutating}
              />
              <Button
                type="submit"
                variant="primary"
                disabled={isMutating || !spriteDescription.trim()}
              >
                {generateSpriteMutation.isPending ? "Generating..." : "Generate Sprite"}
              </Button>
               {saveGameMutation.isPending && <LoadingIndicator text="Saving..." className="mt-2 text-sm text-gray-400"/>}
            </form>
          </div>
        );

      case "theme":
        return (
          <div className="text-center w-full max-w-md">
            <h2 className="text-3xl font-bold mb-6">Choose Your Adventure Theme</h2>
            {spriteUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={spriteUrl} alt="Generated Sprite" className="mx-auto mb-4 h-32 w-32 object-contain border-2 border-purple-400 rounded" />
            )}
            <form onSubmit={handleThemeSubmit} className="flex flex-col items-center gap-4">
              <label htmlFor="gameTheme" className="text-lg">Enter a theme:</label>
              <input
                id="gameTheme"
                type="text"
                value={gameTheme}
                onChange={(e) => setGameTheme(e.target.value)}
                placeholder="e.g., Fantasy, Sci-Fi, Mystery"
                className="p-2 rounded bg-white/20 text-white w-full disabled:opacity-70"
                required
                disabled={isMutating}
              />
              <Button
                type="submit"
                variant="primary"
                disabled={isMutating || !gameTheme.trim()}
              >
                 {startGameMutation.isPending ? "Starting..." : "Start Adventure"}
              </Button>
              {saveGameMutation.isPending && <LoadingIndicator text="Saving..." className="mt-2 text-sm text-gray-400"/>}
            </form>
          </div>
        );

      case "playing":
        if (!gameState) {
          return <LoadingIndicator text="Initializing game state..." />;
        }
        return (
          <div className="flex flex-col items-center gap-6 w-full">
            {backgroundImageUrl && (
              <div className="w-full max-w-xl aspect-video bg-black/30 rounded-lg overflow-hidden border border-purple-500/50 shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={backgroundImageUrl}
                  alt={gameState.backgroundDescription ?? "Game background"}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <p className="text-lg whitespace-pre-wrap text-center max-w-prose">
              {gameState.story}
            </p>

            <div className="w-full">
              <h3 className="text-xl font-semibold mb-4 text-center">Choose your action:</h3>
              <ul className="flex flex-col gap-3 items-center">
                {gameState.choices.map((choice) => (
                  <li key={choice.id} className="w-full max-w-md">
                    <Button
                      variant="choice"
                      onClick={() => handleChoiceSelection(choice.id)}
                      disabled={isMutating} // Disable buttons while any mutation is pending
                    >
                      {choice.id}. {choice.text}
                    </Button>
                  </li>
                ))}
              </ul>
              {(makeChoiceMutation.isPending || saveGameMutation.isPending) && <LoadingIndicator text="Loading next step..." className="text-center mt-4"/>}
            </div>
             {/* Placeholder for WASD movement trigger */}
             <p className="text-sm text-gray-400 mt-4 italic">(Movement with WASD to get next prompt - not implemented yet)</p>
             
             {/* New Game button */}
             <Button
               variant="secondary"
               onClick={handleNewGame}
               disabled={isMutating}
               className="mt-8"
             >
               Start New Game
             </Button>
          </div>
        );

      default:
         // Should not happen if loading/auth states are handled
        return <div>Invalid game state.</div>;
    }
  };

  // Final return statement for authenticated users
  return (
    <Layout>
      <Container className="relative">
         {/* Display username */}
         {session?.user?.name && (
            <div className="absolute top-0 right-4 sm:top-4 text-sm text-gray-300">
               Logged in as: {session.user.name}
            </div>
         )}
         {renderContent()}
         
         {/* Show New Game button at bottom when in theme phase */}
         {gamePhase === "theme" && (
           <div className="mt-8 flex justify-center">
             <Button
               variant="secondary"
               onClick={handleNewGame}
               disabled={generateSpriteMutation.isPending || startGameMutation.isPending || makeChoiceMutation.isPending || saveGameMutation.isPending}
             >
               Start New Game
             </Button>
           </div>
         )}
      </Container>
    </Layout>
  );
}

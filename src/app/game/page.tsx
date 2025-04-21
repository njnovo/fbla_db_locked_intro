"use client"; // Required for useState, useEffect

import { useState, useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { Layout } from "~/components/Layout";
import { Container } from "~/components/Container";
import { Button } from "~/components/Button";
import { LoadingIndicator } from "~/components/LoadingIndicator";
import { ErrorMessage } from "~/components/ErrorMessage";
import type { AppRouter } from "~/server/api/root";
import type { TRPCClientErrorLike } from "@trpc/client";

// Physics constants
const GRAVITY = 0.5;
const JUMP_FORCE = -10;
const MOVEMENT_SPEED = 10; // Increased from 5 to 10 for faster movement
const GROUND_LEVEL = 70; // % from the top of the container

// Define types for game state
interface Choice {
  id: number;
  text: string;
}

interface GameState {
  story: string;
  choices: Choice[];
  backgroundDescription: string;
}

interface SpritePosition {
  x: number;
  y: number;
  velocityY: number;
  velocityX: number;
  isGrounded: boolean;
}

interface SaveSlot {
  slotNumber: number;
  slotName: string;
  isEmpty: boolean;
  gamePhase?: string;
  spriteDescription?: string | null;
  spriteUrl?: string | null;
  gameTheme?: string | null;
  currentStory?: string | null;
  currentChoices?: Choice[];
  currentBackgroundImageUrl?: string | null;
  score?: number;
  updatedAt?: number;
}

type LoadGameError = TRPCClientErrorLike<AppRouter>;

export default function GamePage() {
  const { data: session, status: sessionStatus } = useSession();
  const gameContainerRef = useRef<HTMLDivElement>(null);

  // Game setup states
  const [gamePhase, setGamePhase] = useState<"slots" | "sprite" | "theme" | "playing" | "loading">("loading");
  const [saveSlots, setSaveSlots] = useState<SaveSlot[]>([]);
  const [currentSlot, setCurrentSlot] = useState<number | null>(null);
  const [spriteDescription, setSpriteDescription] = useState("");
  const [spriteUrl, setSpriteUrl] = useState<string | null>(null);
  const [gameTheme, setGameTheme] = useState("");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const [gameScore, setGameScore] = useState(0);
  
  // New states for 2D platformer mechanics
  const [spritePosition, setSpritePosition] = useState<SpritePosition>({
    x: 10, // Start at left side (percentage)
    y: GROUND_LEVEL, // Start on ground
    velocityY: 0,
    velocityX: 0,
    isGrounded: true
  });
  const [showChoiceCloud, setShowChoiceCloud] = useState(false);
  const [transitioningToNextScene, setTransitioningToNextScene] = useState(false);
  const [keysPressed, setKeysPressed] = useState<{[key: string]: boolean}>({});

  // Add a state for the slot to load
  const [slotToLoad, setSlotToLoad] = useState<number>(0);

  // Helper function to ensure we always have exactly 3 choices
  const ensureThreeChoices = (choices: Choice[]): Choice[] => {
    // If we have exactly 3 choices, return them
    if (choices.length === 3) return choices;
    
    // If we have more than 3, take the first 3
    if (choices.length > 3) return choices.slice(0, 3);
    
    // If we have fewer than 3, add generic choices to reach 3
    const result = [...choices];
    const defaultOptions = [
      { id: 1, text: "Continue forward" },
      { id: 2, text: "Explore the area" },
      { id: 3, text: "Turn back" }
    ];
    
    while (result.length < 3) {
      // Add a default option that doesn't conflict with existing IDs
      const usedIds = result.map(c => c.id);
      const availableOption = defaultOptions.find(opt => !usedIds.includes(opt.id));
      
      if (availableOption) {
        result.push(availableOption);
      } else {
        // If all default IDs are taken, create one with a new ID
        const newId = Math.max(...usedIds) + 1;
        result.push({ id: newId, text: `Option ${newId}` });
      }
    }
    
    return result;
  };

  // --- tRPC Query to Load All Save Slots ---
  const { data: saveSlotData, isLoading: isLoadingSaveSlots, error: loadSaveSlotsError, refetch: refetchSaveSlots } = 
    api.game.getSaveSlots.useQuery(
      undefined,
      {
        enabled: sessionStatus === "authenticated",
        staleTime: 0, // Always refetch
        refetchOnWindowFocus: true,
      }
    );

  // Add effect to log saveSlotData when it changes
  useEffect(() => {
    console.log("saveSlotData changed:", saveSlotData);
  }, [saveSlotData]);

  // --- tRPC Query to Load a Specific Slot ---
  const { data: gameSlotData, isLoading: isLoadingGameSlot, refetch: refetchGameSlot } = api.game.loadGameSlot.useQuery(
    { slotNumber: slotToLoad },
    {
      enabled: slotToLoad > 0, // Only run when a valid slot is selected
    }
  );

  // --- Process Save Slot Data When Loaded ---
  useEffect(() => {
    if (saveSlotData?.status === 'success' && Array.isArray(saveSlotData.saveSlots)) {
      setSaveSlots(saveSlotData.saveSlots as SaveSlot[]);
      
      // If we're in the loading phase, transition to slot selection
      if (gamePhase === 'loading') {
        setGamePhase('slots');
      }
    } else if (saveSlotData?.status === 'unauthenticated') {
      // If not logged in, set up default empty slots
      setSaveSlots([
        { slotNumber: 1, slotName: "Save Slot 1", isEmpty: true },
        { slotNumber: 2, slotName: "Save Slot 2", isEmpty: true },
        { slotNumber: 3, slotName: "Save Slot 3", isEmpty: true }
      ]);
      
      // If we're in the loading phase, transition to slot selection
      if (gamePhase === 'loading') {
        setGamePhase('slots');
      }
    }
  }, [saveSlotData, gamePhase]);

  // --- tRPC Mutation to Save Game to a Slot ---
  const saveGameSlotMutation = api.game.saveGameSlot.useMutation({
    onSuccess: (data) => {
      console.log("Game saved successfully to slot:", data.slotNumber);
      console.log("Save response data:", data);
      if (typeof data.score === 'number') {
        setGameScore(data.score); // Update the score only if it's a number
      }
      
      // Refetch save slots to update the UI
      console.log("Calling refetchSaveSlots after successful save");
      void refetchSaveSlots();
    },
    onError: (error: LoadGameError) => {
      console.error("Error saving game:", error);
      alert(`Failed to save game: ${error.message}`);
    },
  });

  // Effect to process loaded game data
  useEffect(() => {
    if (!gameSlotData) return;
    
    if (gameSlotData.status === "loaded" && 'saveData' in gameSlotData) {
      const saveData = gameSlotData.saveData;
      
      // Set game phase and slot
      setCurrentSlot(Number(saveData.slotNumber));
      setGamePhase(saveData.gamePhase as "sprite" | "theme" | "playing");
      
      // Load sprite data
      setSpriteDescription(saveData.spriteDescription ?? "");
      setSpriteUrl(saveData.spriteUrl || null);
      
      // Load theme
      setGameTheme(saveData.gameTheme ?? "");
      
      // Load background
      setBackgroundImageUrl(saveData.currentBackgroundImageUrl || null);
      
      // Load score
      setGameScore(saveData.score ?? 0);
      
      // Set default sprite position
      setSpritePosition({
        x: 10,
        y: GROUND_LEVEL,
        velocityY: 0,
        velocityX: 0,
        isGrounded: true
      });
      
      // Load game state if in playing phase
      if (saveData.gamePhase === 'playing') {
        // Ensure we have exactly 3 choices
        const choices = Array.isArray(saveData.currentChoices) 
          ? ensureThreeChoices(saveData.currentChoices)
          : ensureThreeChoices([]);
        
        setGameState({
          story: saveData.currentStory ?? "",
          choices: choices,
          backgroundDescription: saveData.currentBackgroundDescription ?? "",
        });
      } else {
        setGameState(null);
      }
      
      setShowChoiceCloud(false);
    } else if (gameSlotData.status === "empty") {
      // Start a new game with the chosen slot
      setCurrentSlot(gameSlotData.slotNumber);
      setGamePhase("sprite");
      setSpriteDescription("");
      setSpriteUrl(null);
      setGameTheme("");
      setGameState(null);
      setBackgroundImageUrl(null);
      setGameScore(0);
      setSpritePosition({
        x: 10,
        y: GROUND_LEVEL,
        velocityY: 0,
        velocityX: 0,
        isGrounded: true
      });
    }
    
    // Reset slot to load after processing
    setSlotToLoad(0);
  }, [gameSlotData]);

  // --- Other tRPC Mutations ---
  const generateSpriteMutation = api.game.generateSprite.useMutation({
    onSuccess: (data) => {
      console.log("Sprite generated:", data);
      setSpriteUrl(data.imageUrl);
      setGamePhase("theme");
      
      // Increase score for generating sprite
      setGameScore(prev => prev + 1);
      
      // Save to current slot
      triggerSave();
    },
    onError: (error: LoadGameError) => {
       console.error("Sprite generation error:", error);
       alert(`Error generating sprite: ${error.message}`);
    },
  });

  const startGameMutation = api.game.startGame.useMutation({
    onSuccess: (data) => {
        console.log("Game started:", data);
        // Make sure we have exactly 3 choices for our cloud UI
        const initialChoices = ensureThreeChoices(data.initialState.choices);
        setGameState({
          ...data.initialState,
          choices: initialChoices
        });
        setBackgroundImageUrl(data.backgroundImageUrl);
        setGamePhase("playing");
        
        // Increase score for starting game
        setGameScore(prev => prev + 1);
        
        // Reset sprite position
        setSpritePosition({
          x: 10,
          y: GROUND_LEVEL,
          velocityY: 0,
          velocityX: 0,
          isGrounded: true
        });
        setShowChoiceCloud(false);
        
        // Save to current slot
        triggerSave();
    },
    onError: (error: LoadGameError) => {
        console.error("Start game error:", error);
        alert(`Error starting game: ${error.message}`);
    },
  });

  const makeChoiceMutation = api.game.makeChoice.useMutation({
    onSuccess: (data) => {
        console.log("Choice made, next state:", data);
        setTransitioningToNextScene(true);
        
        // Make sure we have exactly 3 choices for our cloud UI
        const nextChoices = ensureThreeChoices(data.nextState.choices);
        
        // Increase score for making a choice
        setGameScore(prev => prev + 1);
        
        // Set timeout to transition to new scene
        setTimeout(() => {
          setGameState({
            ...data.nextState,
            choices: nextChoices
          });
          setBackgroundImageUrl(data.backgroundImageUrl);
          setSpritePosition({
            x: 10, // Reset to left side
            y: GROUND_LEVEL,
            velocityY: 0,
            velocityX: 0,
            isGrounded: true
          });
          setShowChoiceCloud(false);
          setTransitioningToNextScene(false);
          
          // Save to current slot
          triggerSave();
        }, 500);
    },
    onError: (error: LoadGameError) => {
       console.error("Make choice error:", error);
       alert(`Error making choice: ${error.message}`);
    },
  });

  // Add a new mutation for WASD movement
  const handleMovementMutation = api.game.handleMovement.useMutation({
    onSuccess: (data) => {
      console.log("Movement processed, next state:", data);
      setGameState(data.nextState);
      setBackgroundImageUrl(data.backgroundImageUrl);
      // Trigger save after setting state
      triggerSave();
    },
    onError: (error: LoadGameError) => {
      console.error("Movement error:", error);
      alert(`Error processing movement: ${error.message}`);
    },
  });

  // Physics and movement system
  useEffect(() => {
    if (gamePhase !== "playing" || transitioningToNextScene) return;
    
    // Game animation loop
    let animationFrameId: number;
    
    const gameLoop = () => {
      setSpritePosition(prev => {
        // Skip updates if transitioning
        if (transitioningToNextScene) return prev;
        
        let newX = prev.x;
        let newY = prev.y;
        let newVelocityY = prev.velocityY;
        let isGrounded = prev.isGrounded;
        
        // Apply horizontal movement from key presses
        if (keysPressed.a || keysPressed.A) { // Left
          newX = Math.max(0, prev.x - MOVEMENT_SPEED);
        }
        if (keysPressed.d || keysPressed.D) { // Right
          newX = Math.min(90, prev.x + MOVEMENT_SPEED); // Limit to 90% of screen width
        }
        
        // Apply jump
        if ((keysPressed.w || keysPressed.W) && isGrounded) {
          newVelocityY = JUMP_FORCE;
          isGrounded = false;
        }
        
        // Apply gravity
        if (!isGrounded) {
          newVelocityY += GRAVITY;
        }
        
        // Apply vertical movement
        newY += newVelocityY;
        
        // Check if landed on ground
        if (newY >= GROUND_LEVEL) {
          newY = GROUND_LEVEL;
          newVelocityY = 0;
          isGrounded = true;
        }
        
        // Check if reached right side to show choices
        if (newX >= 80 && !showChoiceCloud) {
          setShowChoiceCloud(true);
        }
        
        return {
          x: newX,
          y: newY,
          velocityY: newVelocityY,
          velocityX: prev.velocityX,
          isGrounded
        };
      });
      
      animationFrameId = requestAnimationFrame(gameLoop);
    };
    
    animationFrameId = requestAnimationFrame(gameLoop);
    
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [gamePhase, keysPressed, showChoiceCloud, transitioningToNextScene]);
  
  // Keyboard input handling
  useEffect(() => {
    if (gamePhase !== "playing") return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      
      // Prevent default for WASD and number keys in game
      if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D', '1', '2', '3'].includes(key)) {
        e.preventDefault();
        
        // Update pressed keys for movement
        if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(key)) {
          setKeysPressed(prev => ({ ...prev, [key]: true }));
        }
        
        // Handle choice selection with number keys
        if (showChoiceCloud && ['1', '2', '3'].includes(key) && gameState?.choices) {
          const choiceId = parseInt(key);
          const choice = gameState.choices.find(c => c.id === choiceId);
          
          if (choice && !makeChoiceMutation.isPending) {
            handleChoiceSelection(choiceId);
          }
        }
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key;
      
      if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(key)) {
        setKeysPressed(prev => ({ ...prev, [key]: false }));
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [gamePhase, showChoiceCloud, gameState, makeChoiceMutation.isPending]);

  const handleChoiceSelection = (choiceId: number) => {
    if (!gameState || !gameTheme || !spriteDescription || makeChoiceMutation.isPending) return;
    makeChoiceMutation.mutate({
        choiceId,
        currentStory: gameState.story,
        currentChoices: gameState.choices,
        gameTheme: gameTheme,
        spriteDescription: spriteDescription
    });
  };

  // Handle sprite form submission
  const handleSpriteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!spriteDescription.trim() || generateSpriteMutation.isPending) return;
    generateSpriteMutation.mutate({ description: spriteDescription });
  };

  // Handle theme form submission
  const handleThemeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameTheme.trim() || !spriteDescription || startGameMutation.isPending) return;
    startGameMutation.mutate({ theme: gameTheme, spriteDescription });
  };

  // Function to return to slot selection
  const handleReturnToSlots = () => {
    // If in a game, save before returning
    if (gamePhase !== 'slots' && gamePhase !== 'loading' && currentSlot !== null) {
      triggerSave();
    }
    
    setGamePhase('slots');
  };

  // Helper function to trigger save to the current slot
  const triggerSave = () => {
    if (sessionStatus !== "authenticated" || gamePhase === 'loading' || gamePhase === 'slots' || currentSlot === null) {
      console.log("Save prevented because:", { 
        isAuthenticated: sessionStatus === "authenticated",
        gamePhase,
        currentSlot 
      });
      return;
    }

    const saveData = {
      slotNumber: currentSlot,
      slotName: `Game ${gameScore} pts - ${new Date().toLocaleDateString()}`,
      gamePhase: gamePhase,
      spriteDescription: spriteDescription ?? null,
      spriteUrl: spriteUrl ?? null,
      gameTheme: gameTheme ?? null,
      currentStory: gameState?.story ?? null,
      currentChoices: gameState?.choices ?? [],
      currentBackgroundDescription: gameState?.backgroundDescription ?? null,
      currentBackgroundImageUrl: backgroundImageUrl ?? null,
      score: gameScore,
    };
    
    // Double check we're actually saving something useful
    console.log("Save data quality check:", {
      hasValidSlot: currentSlot > 0 && currentSlot <= 3,
      hasSprite: !!spriteUrl,
      hasTheme: !!gameTheme,
      gamePhase
    });
    
    console.log("Triggering save with data:", saveData);
    saveGameSlotMutation.mutate(saveData);
  };

  // Add an effect to log saveSlots whenever they change
  useEffect(() => {
    console.log("Current saveSlots:", saveSlots);
  }, [saveSlots]);

  // Handle starting a new game in a specific slot
  const handleNewGame = (slotNumber: number) => {
    setCurrentSlot(slotNumber);
    setGamePhase("sprite");
    setSpriteDescription("");
    setSpriteUrl(null);
    setGameTheme("");
    setGameState(null);
    setBackgroundImageUrl(null);
    setGameScore(0);
    setSpritePosition({
      x: 10,
      y: GROUND_LEVEL,
      velocityY: 0,
      velocityX: 0,
      isGrounded: true
    });
    setShowChoiceCloud(false);
    setTransitioningToNextScene(false);
    
    // Save the new game state to the selected slot
    if (sessionStatus === "authenticated") {
      saveGameSlotMutation.mutate({
        slotNumber,
        slotName: `New Game - ${new Date().toLocaleDateString()}`,
        gamePhase: "sprite",
        score: 0
      });
    }
  };

  // Handle loading a saved game from a slot
  const handleLoadGame = (slotNumber: number) => {
    setSlotToLoad(slotNumber);
  };

  // --- Render Logic ---

  // Handle Auth Loading / Unauthenticated states first
  if (sessionStatus === "loading" || (gamePhase === 'loading' && isLoadingSaveSlots)) {
    return (
      <Layout>
        <LoadingIndicator text="Loading Session..." />
      </Layout>
    );
  }

  if (sessionStatus === "unauthenticated" && gamePhase === 'loading') {
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

  // Display combined loading/mutation errors
  const mutationError = generateSpriteMutation.error ?? startGameMutation.error ?? makeChoiceMutation.error ?? saveGameSlotMutation.error;
  if (mutationError) {
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
  
  const loadError = loadSaveSlotsError;
  if (loadError) {
      return (
       <Layout>
           <Container className="gap-4">
               <ErrorMessage message={`Loading save slots: ${loadError.message}`} />
                <Link href="/" className="text-purple-300 hover:text-purple-100">
                   Go back home
               </Link>
           </Container>
       </Layout>
      );
  }

  // Main Render Content function
  const renderContent = () => {
    const isMutating = generateSpriteMutation.isPending || 
                       startGameMutation.isPending || 
                       makeChoiceMutation.isPending || 
                       saveGameSlotMutation.isPending ||
                       isLoadingGameSlot;

    switch (gamePhase) {
      case "slots":
        return (
          <div className="w-full max-w-xl">
            <h2 className="text-3xl font-bold mb-6 text-center">Game Slots</h2>
            <p className="text-center mb-4">Select a slot to start or continue your adventure</p>
            
            {/* Debug info and refresh button */}
            <div className="mb-4 p-2 border border-gray-700 rounded bg-gray-900 text-xs text-white">
              <p>Authentication status: {sessionStatus}</p>
              <p>Has slot data: {saveSlotData ? 'yes' : 'no'}</p>
              <p>Number of slots: {saveSlots.length}</p>
              <details>
                <summary className="cursor-pointer hover:text-blue-300">Show raw slot data</summary>
                <pre className="mt-2 p-2 bg-black/50 overflow-auto max-h-40 text-green-400">
                  {JSON.stringify(saveSlots, null, 2)}
                </pre>
              </details>
              <button 
                onClick={() => void refetchSaveSlots()} 
                className="mt-2 bg-blue-700 text-white px-2 py-1 rounded text-xs"
              >
                Refresh Slots
              </button>
            </div>
            
            <div className="grid gap-4">
              {saveSlots.map((slot) => (
                <div 
                  key={slot.slotNumber} 
                  className="bg-gray-800 rounded-lg p-4 border border-gray-700 shadow-md relative"
                >
                  {/* Debug data */}
                  <div className="absolute top-1 right-1 text-xs text-green-300 bg-black/40 p-1 rounded">
                    isEmpty: {String(slot.isEmpty)} • slotNumber: {slot.slotNumber}
                  </div>
                  
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-semibold">{slot.slotName}</h3>
                    {!slot.isEmpty && (
                      <span className="bg-purple-700 text-white text-xs px-2 py-1 rounded-full">
                        Score: {slot.score}
                      </span>
                    )}
                  </div>
                  
                  {!slot.isEmpty ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        {slot.spriteUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img 
                            src={slot.spriteUrl} 
                            alt="Character sprite" 
                            className="w-12 h-12 object-contain border border-gray-600 rounded bg-black/30"
                          />
                        )}
                        <div className="flex-1 text-sm">
                          <p className="text-gray-300">{slot.spriteDescription?.substring(0, 100)}</p>
                          <p className="text-gray-400 text-xs">Theme: {slot.gameTheme}</p>
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-400">
                        <p>Updated: {slot.updatedAt ? new Date(slot.updatedAt * 1000).toLocaleString() : 'Unknown'}</p>
                      </div>
                      
                      <div className="flex gap-2 mt-2">
                        <Button 
                          variant="primary" 
                          className="flex-1"
                          onClick={() => handleLoadGame(slot.slotNumber)}
                          disabled={isMutating}
                        >
                          Continue
                        </Button>
                        <Button 
                          variant="secondary" 
                          className="flex-1"
                          onClick={() => handleNewGame(slot.slotNumber)}
                          disabled={isMutating}
                        >
                          New Game
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-gray-400">Empty slot</p>
                      <Button 
                        variant="primary" 
                        onClick={() => handleNewGame(slot.slotNumber)}
                        disabled={isMutating}
                        className="w-full"
                      >
                        Start New Game
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {isLoadingGameSlot && <LoadingIndicator text="Loading game data..." className="mt-4" />}
          </div>
        );

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
                className="p-2 rounded bg-white/20 text-black w-full disabled:opacity-70"
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
              {saveGameSlotMutation.isPending && <LoadingIndicator text="Saving..." className="mt-2 text-sm text-gray-400"/>}
            </form>
            
            <Button
              variant="secondary"
              onClick={handleReturnToSlots}
              disabled={isMutating}
              className="mt-8"
            >
              Return to Slot Selection
            </Button>
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
                className="p-2 rounded bg-white/20 text-black w-full disabled:opacity-70"
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
              {saveGameSlotMutation.isPending && <LoadingIndicator text="Saving..." className="mt-2 text-sm text-gray-400"/>}
            </form>
            
            <Button
              variant="secondary"
              onClick={handleReturnToSlots}
              disabled={isMutating}
              className="mt-8"
            >
              Return to Slot Selection
            </Button>
          </div>
        );

      case "playing":
        if (!gameState) {
          return <LoadingIndicator text="Initializing game state..." />;
        }
        return (
          <div 
            className="flex flex-col items-center gap-6 w-full" 
            ref={gameContainerRef}
          >
            <div className="relative w-full max-w-xl aspect-video bg-black/30 rounded-lg overflow-hidden border border-purple-500/50 shadow-lg">
              {/* Background image */}
              {backgroundImageUrl && (
                <div className={`absolute inset-0 transition-opacity duration-500 ${transitioningToNextScene ? 'opacity-0' : 'opacity-100'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={backgroundImageUrl}
                    alt={gameState.backgroundDescription ?? "Game background"}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              
              {/* Game score display */}
              <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-md">
                Score: {gameScore}
              </div>
              
              {/* Ground/floor for sprite to stand on */}
              <div 
                className="absolute bottom-0 left-0 right-0 h-[10%] bg-opacity-0"
                style={{ top: `${GROUND_LEVEL}%` }}
              />
              
              {/* Sprite */}
              {spriteUrl && (
                <div 
                  className={`absolute transition-transform duration-100 ${transitioningToNextScene ? 'opacity-0' : 'opacity-100'}`}
                  style={{
                    left: `${spritePosition.x}%`,
                    top: `${spritePosition.y}%`,
                    transform: 'translate(-50%, -100%)', // Center sprite horizontally, align bottom to position
                    width: '48px',
                    height: '48px',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={spriteUrl} 
                    alt="Player character" 
                    className="w-full h-full object-contain" 
                  />
                </div>
              )}
              
              {/* Choice cloud */}
              {showChoiceCloud && !transitioningToNextScene && (
                <div 
                  className="absolute top-[20%] right-[20%] bg-black border-2 border-white rounded-md p-3 max-w-[250px] transform-gpu animate-float"
                >
                  <div className="text-white text-xs font-medium mb-1">Choose your next action:</div>
                  <ul className="text-white text-xs space-y-1">
                    {gameState.choices.slice(0, 3).map((choice) => (
                      <li key={choice.id} className="hover:bg-gray-700 p-1 rounded cursor-pointer">
                        <span className="font-bold mr-1">{choice.id}.</span> {choice.text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Loading indicator */}
              {(makeChoiceMutation.isPending || saveGameSlotMutation.isPending) && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <LoadingIndicator text="Loading next scene..." />
                </div>
              )}
            </div>
            
            {/* Story text */}
            <p className="text-lg whitespace-pre-wrap text-center max-w-prose">
              {gameState.story}
            </p>
            
            {/* Controls hint */}
            <div className="text-sm text-blue-600 mt-2 flex flex-col items-center">
              <p>Use W (jump), A (left), D (right) to move</p>
              <p>Press 1, 2, or 3 to select choices when they appear</p>
            </div>
            
            {/* Game controls */}
            <div className="flex gap-4 mt-4">
              <Button
                variant="secondary"
                onClick={() => handleNewGame(currentSlot || 1)}
                disabled={isMutating}
              >
                New Game
              </Button>
              
              <Button
                variant="secondary"
                onClick={handleReturnToSlots}
                disabled={isMutating}
              >
                Return to Slots
              </Button>

              {/* Manual save button */}
              <Button
                variant="primary"
                onClick={triggerSave}
                disabled={isMutating || sessionStatus !== "authenticated" || currentSlot === null}
                className="bg-green-600 hover:bg-green-700 relative"
              >
                Save Game
                {currentSlot !== null && (
                  <span className="absolute -top-2 -right-2 bg-yellow-600 text-white text-[10px] px-1 rounded-full">
                    Slot {currentSlot}
                  </span>
                )}
              </Button>
            </div>

            {/* Save slot info */}
            {currentSlot && (
              <div className="text-xs text-gray-400 mt-2">
                {sessionStatus === "authenticated" 
                  ? `Saving to slot ${currentSlot}` 
                  : "Sign in to save your progress"}
              </div>
            )}
          </div>
        );

      default:
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
      </Container>
    </Layout>
  );
}

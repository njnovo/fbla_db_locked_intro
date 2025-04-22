"use client";

import { useState } from "react";
import { Button } from "~/components/Button";
import { Container } from "~/components/Container";
import { Layout } from "~/components/Layout";
import { LoadingIndicator } from "~/components/LoadingIndicator";
import { api } from "~/trpc/react";
import { useSession } from "next-auth/react";

export default function TestDatabasePage() {
  const { data: session, status } = useSession();
  const [result, setResult] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Test save game mutation
  const saveGameSlotMutation = api.game.saveGameSlot.useMutation({
    onSuccess: (data) => {
      setResult(`Save successful! Slot ${data.slotNumber}, Score: ${data.score}\n${JSON.stringify(data, null, 2)}`);
      setIsLoading(false);
    },
    onError: (error) => {
      setResult(`Error saving: ${error.message}\n${JSON.stringify(error, null, 2)}`);
      setIsLoading(false);
    },
  });
  
  // Test get save slots query with forced refresh
  const { data: saveSlotData, isLoading: slotsLoading, refetch } = 
    api.game.getSaveSlots.useQuery(undefined, {
      enabled: status === "authenticated",
      refetchOnWindowFocus: true,
    });
  
  const handleTestSave = (slotNumber: number) => {
    if (status !== "authenticated") {
      setResult("You must be logged in to test saving");
      return;
    }
    
    setIsLoading(true);
    setResult("Saving test data...");
    
    saveGameSlotMutation.mutate({
      slotNumber,
      slotName: `Test Save ${new Date().toLocaleTimeString()}`,
      gamePhase: "playing",
      spriteDescription: "Test character",
      spriteUrl: "https://example.com/sprite.png",
      gameTheme: "Test theme",
      currentStory: "This is a test save",
      currentChoices: [
        { id: 1, text: "Option 1" },
        { id: 2, text: "Option 2" },
        { id: 3, text: "Option 3" }
      ],
      score: Math.floor(Math.random() * 100),
    });
  };
  
  const handleRefreshSlots = () => {
    setIsLoading(true);
    setResult("Refreshing slot data...");
    
    refetch().then((result) => {
      setResult(`Slots refreshed:\n${JSON.stringify(result.data, null, 2)}`);
      setIsLoading(false);
    }).catch(error => {
      setResult(`Error refreshing: ${error}`);
      setIsLoading(false);
    });
  };
  
  return (
    <Layout>
      <Container>
        <h1 className="text-3xl font-bold mb-6">Database Test Page</h1>
        
        <div className="mb-4">
          <p>Session Status: <span className="font-bold">{status}</span></p>
          {session?.user && (
            <p>User: {session.user.name} ({session.user.id})</p>
          )}
        </div>
        
        <div className="flex gap-4 mb-6">
          <Button onClick={() => handleTestSave(1)} disabled={isLoading}>
            Test Save Slot 1
          </Button>
          <Button onClick={() => handleTestSave(2)} disabled={isLoading}>
            Test Save Slot 2
          </Button>
          <Button onClick={() => handleTestSave(3)} disabled={isLoading}>
            Test Save Slot 3
          </Button>
          <Button onClick={handleRefreshSlots} disabled={isLoading}>
            Refresh Slots
          </Button>
        </div>
        
        {isLoading && <LoadingIndicator text="Processing..." />}
        
        <div className="mt-6">
          <h2 className="text-xl font-bold mb-2">Current Slots:</h2>
          {slotsLoading ? (
            <LoadingIndicator text="Loading slots..." />
          ) : (
            <pre className="bg-gray-800 p-4 rounded overflow-auto max-h-80">
              {JSON.stringify(saveSlotData, null, 2)}
            </pre>
          )}
        </div>
        
        <div className="mt-6">
          <h2 className="text-xl font-bold mb-2">Result:</h2>
          <pre className="bg-gray-800 p-4 rounded overflow-auto max-h-80">
            {result || "No operations performed yet"}
          </pre>
        </div>
      </Container>
    </Layout>
  );
} 
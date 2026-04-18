/**
 * Placeholder hook for future voice command integration.
 * Returns a stable no-op interface — isAvailable is always false.
 */
export function useVoiceCommand() {
  const startListening = (): void => {
    // no-op placeholder
  };

  const stopListening = (): void => {
    // no-op placeholder
  };

  return {
    isListening: false as const,
    lastCommand: null as string | null,
    startListening,
    stopListening,
    isAvailable: false as const,
  };
}

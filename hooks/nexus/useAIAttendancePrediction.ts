/**
 * Placeholder hook for future AI attendance prediction integration.
 * Returns a stable no-op interface — isAvailable is always false.
 */
export function useAIAttendancePrediction() {
  return {
    prediction: null,
    confidence: null,
    isLoading: false as const,
    isAvailable: false as const,
  };
}

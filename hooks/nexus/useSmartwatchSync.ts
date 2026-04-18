/**
 * Placeholder hook for future smartwatch sync integration.
 * Returns a stable no-op interface — isAvailable is always false.
 */
export function useSmartwatchSync() {
  const sync = (): void => {
    // no-op placeholder
  };

  return {
    isConnected: false as const,
    deviceName: null as string | null,
    sync,
    isAvailable: false as const,
  };
}

/**
 * Placeholder hook for future BLE indoor positioning integration.
 * Returns a stable no-op interface — isAvailable is always false.
 */
export function useIndoorPositioning() {
  return {
    floor: null as number | null,
    beaconCount: 0,
    accuracy: null as 'low' | 'medium' | 'high' | null,
    isAvailable: false as const,
  };
}

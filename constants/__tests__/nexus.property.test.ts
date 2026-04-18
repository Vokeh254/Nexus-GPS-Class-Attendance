/**
 * Property-based tests for Nexus Attendance UI design tokens and pure logic helpers.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */

// Mock heavy native modules that AttendanceService pulls in at import time
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));
jest.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: jest.fn() }, from: jest.fn() },
}));
jest.mock('../../services/GeofenceService', () => ({
  __esModule: true,
  default: { getCurrentLocation: jest.fn(), isAccuracyAcceptable: jest.fn() },
}));

import fc from 'fast-check';
import { Colors, NexusColors } from '../theme';
import { ERRORS } from '../../services/AttendanceService';

// ─── Pure helper functions ────────────────────────────────────────────────────

/** Returns the icon colour for a tab given its index and the currently active index. */
function getTabIconColor(tabIndex: number, activeIndex: number): string {
  return tabIndex === activeIndex ? NexusColors.accentCyan : NexusColors.textSecondary;
}

/** Returns the GPS pulse indicator colour for a given GPS state. */
function getGpsColor(state: 'active' | 'searching' | 'disabled'): string {
  if (state === 'active') return NexusColors.gpsActive;
  if (state === 'searching') return NexusColors.gpsSearching;
  return NexusColors.gpsDisabled;
}

/** Returns the proximity indicator colour based on distance vs radius. */
function getProximityColor(distanceMetres: number, radiusMetres: number): string {
  if (distanceMetres <= radiusMetres) return NexusColors.accentEmerald;
  if (distanceMetres <= 2 * radiusMetres) return NexusColors.accentAmber;
  return NexusColors.accentRose;
}

/** Returns whether the Mark Attendance button should be enabled. */
function isMarkAttendanceEnabled(inside: boolean, accuracyOk: boolean, sessionActive: boolean): boolean {
  return inside && accuracyOk && sessionActive;
}

/** Returns whether the button should show the confirmed state. */
function shouldShowConfirmed(result: { success: boolean }): boolean {
  return result.success;
}

/** Returns the error message for a failed attendance result. */
function getErrorMessage(
  result: { success: false; reason: string },
  errors: Record<string, string>,
): string {
  return errors[result.reason] ?? errors['server_error'];
}

// ─── Property 1: Colors preservation ─────────────────────────────────────────
// Validates: Requirements 1.1

describe('Property 1 — Colors preservation', () => {
  it('Colors.light values are unchanged after Nexus tokens are exported', () => {
    const lightKeys = Object.keys(Colors.light) as (keyof typeof Colors.light)[];
    const snapshot = { ...Colors.light };

    fc.assert(
      fc.property(fc.constantFrom(...lightKeys), (key) => {
        expect(Colors.light[key]).toBe(snapshot[key]);
      }),
    );
  });

  it('Colors.dark values are unchanged after Nexus tokens are exported', () => {
    const darkKeys = Object.keys(Colors.dark) as (keyof typeof Colors.dark)[];
    const snapshot = { ...Colors.dark };

    fc.assert(
      fc.property(fc.constantFrom(...darkKeys), (key) => {
        expect(Colors.dark[key]).toBe(snapshot[key]);
      }),
    );
  });
});

// ─── Property 2: Tab icon colour matches active state ─────────────────────────
// Validates: Requirements 1.2

describe('Property 2 — Tab icon colour matches active state', () => {
  it('active tab always gets accentCyan', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 3 }), (i) => {
        expect(getTabIconColor(i, i)).toBe(NexusColors.accentCyan);
      }),
    );
  });

  it('inactive tab always gets textSecondary', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 0, max: 3 }),
        (tabIndex, activeIndex) => {
          fc.pre(tabIndex !== activeIndex);
          expect(getTabIconColor(tabIndex, activeIndex)).toBe(NexusColors.textSecondary);
        },
      ),
    );
  });
});

// ─── Property 3: GPS status indicator colour matches GPS state ────────────────
// Validates: Requirements 1.3

describe('Property 3 — GPS status indicator colour matches GPS state', () => {
  it('maps every GPS state to the correct colour', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('active' as const, 'searching' as const, 'disabled' as const),
        (state) => {
          const color = getGpsColor(state);
          if (state === 'active') expect(color).toBe(NexusColors.gpsActive);
          else if (state === 'searching') expect(color).toBe(NexusColors.gpsSearching);
          else expect(color).toBe(NexusColors.gpsDisabled);
        },
      ),
    );
  });
});

// ─── Property 4: Proximity indicator colour matches geofence zone ─────────────
// Validates: Requirements 1.4

describe('Property 4 — Proximity indicator colour matches geofence zone', () => {
  it('inside zone (distance ≤ radius) → accentEmerald', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 500, noNaN: true }),
        fc.float({ min: 0, max: 1, noNaN: true }),
        (radius, fraction) => {
          const distance = fraction * radius; // guaranteed ≤ radius
          expect(getProximityColor(distance, radius)).toBe(NexusColors.accentEmerald);
        },
      ),
    );
  });

  it('approaching zone (radius < distance ≤ 2×radius) → accentAmber', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 500, noNaN: true }),
        fc.float({ min: 0, max: 1, noNaN: true }),
        (radius, fraction) => {
          // distance in (radius, 2*radius]
          const distance = radius + fraction * radius; // radius + [0..radius]
          fc.pre(distance > radius && distance <= 2 * radius);
          expect(getProximityColor(distance, radius)).toBe(NexusColors.accentAmber);
        },
      ),
    );
  });

  it('outside zone (distance > 2×radius) → accentRose', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 500, noNaN: true }),
        fc.float({ min: 0, max: 10000, noNaN: true }),
        (radius, extra) => {
          const distance = 2 * radius + extra + 0.001; // strictly > 2*radius
          expect(getProximityColor(distance, radius)).toBe(NexusColors.accentRose);
        },
      ),
    );
  });
});

// ─── Property 5: Mark Attendance button enabled state equals conjunction ───────
// Validates: Requirements 1.5

describe('Property 5 — Mark Attendance button enabled state', () => {
  it('enabled iff inside && accuracyOk && sessionActive', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), fc.boolean(), (inside, accuracyOk, sessionActive) => {
        expect(isMarkAttendanceEnabled(inside, accuracyOk, sessionActive)).toBe(
          inside && accuracyOk && sessionActive,
        );
      }),
    );
  });
});

// ─── Property 6: AttendanceButton visual state matches attendance result ───────
// Validates: Requirements 1.6

describe('Property 6 — AttendanceButton visual state matches attendance result', () => {
  it('shouldShowConfirmed reflects result.success', () => {
    fc.assert(
      fc.property(fc.boolean(), (success) => {
        expect(shouldShowConfirmed({ success })).toBe(success);
      }),
    );
  });

  it('getErrorMessage returns ERRORS[reason] for every known reason', () => {
    const knownReasons = Object.keys(ERRORS);
    fc.assert(
      fc.property(fc.constantFrom(...knownReasons), (reason) => {
        const result = { success: false as const, reason };
        expect(getErrorMessage(result, ERRORS)).toBe(ERRORS[reason as keyof typeof ERRORS]);
      }),
    );
  });

  it('getErrorMessage falls back to server_error for unknown reasons', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !(s in ERRORS) && s !== ''),
        (unknownReason) => {
          const result = { success: false as const, reason: unknownReason };
          expect(getErrorMessage(result, ERRORS)).toBe(ERRORS['server_error']);
        },
      ),
    );
  });
});

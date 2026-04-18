import {
  Colors,
  NexusColors,
  NexusFonts,
  NexusSpacing,
  NexusRadius,
} from '../theme';

// ─── NexusColors ─────────────────────────────────────────────────────────────

describe('NexusColors', () => {
  const requiredKeys = [
    'bgPrimary',
    'bgCard',
    'bgCardSolid',
    'borderGlass',
    'borderGlow',
    'accentCyan',
    'accentAmber',
    'accentEmerald',
    'accentRose',
    'accentIndigo',
    'textPrimary',
    'textSecondary',
    'textDisabled',
    'gradientGlow',
    'gradientCyan',
    'gradientAmber',
    'gradientCard',
    'gpsActive',
    'gpsSearching',
    'gpsDisabled',
  ] as const;

  test.each(requiredKeys)('has key "%s"', (key) => {
    expect(NexusColors).toHaveProperty(key);
  });

  test('all required keys are present (exhaustive check)', () => {
    for (const key of requiredKeys) {
      expect(key in NexusColors).toBe(true);
    }
  });
});

// ─── NexusFonts ──────────────────────────────────────────────────────────────

describe('NexusFonts', () => {
  test('has key "family"', () => {
    expect(NexusFonts).toHaveProperty('family');
  });

  test('has key "fallback"', () => {
    expect(NexusFonts).toHaveProperty('fallback');
  });

  test('has key "sizes"', () => {
    expect(NexusFonts).toHaveProperty('sizes');
  });

  test('has key "weights"', () => {
    expect(NexusFonts).toHaveProperty('weights');
  });

  test('has key "letterSpacing"', () => {
    expect(NexusFonts).toHaveProperty('letterSpacing');
  });
});

// ─── NexusSpacing ─────────────────────────────────────────────────────────────

describe('NexusSpacing', () => {
  const requiredKeys = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'] as const;

  test.each(requiredKeys)('has key "%s"', (key) => {
    expect(NexusSpacing).toHaveProperty(key);
  });
});

// ─── NexusRadius ──────────────────────────────────────────────────────────────

describe('NexusRadius', () => {
  const requiredKeys = ['sm', 'md', 'lg', 'xl', '2xl', 'full'] as const;

  test.each(requiredKeys)('has key "%s"', (key) => {
    expect(NexusRadius).toHaveProperty(key);
  });
});

// ─── Colors.light — existing entries unchanged ────────────────────────────────

describe('Colors.light (existing entries unchanged)', () => {
  test('text is #1A1A2E', () => {
    expect(Colors.light.text).toBe('#1A1A2E');
  });

  test('background is #F0F4F8', () => {
    expect(Colors.light.background).toBe('#F0F4F8');
  });

  test('tint is #4169E1', () => {
    expect(Colors.light.tint).toBe('#4169E1');
  });

  test('primary is #4169E1', () => {
    expect(Colors.light.primary).toBe('#4169E1');
  });

  test('card is #FFFFFF', () => {
    expect(Colors.light.card).toBe('#FFFFFF');
  });
});

// ─── Colors.dark — existing entries unchanged ─────────────────────────────────

describe('Colors.dark (existing entries unchanged)', () => {
  test('text is #E8F4FF', () => {
    expect(Colors.dark.text).toBe('#E8F4FF');
  });

  test('background is #0F1419', () => {
    expect(Colors.dark.background).toBe('#0F1419');
  });

  test('tint is #5B7FE8', () => {
    expect(Colors.dark.tint).toBe('#5B7FE8');
  });

  test('primary is #5B7FE8', () => {
    expect(Colors.dark.primary).toBe('#5B7FE8');
  });

  test('card is #1A1F2E', () => {
    expect(Colors.dark.card).toBe('#1A1F2E');
  });
});

/**
 * Feature Flag Pattern Regression Test
 *
 * Ensures services use isFeatureEnabled() instead of direct FEATURES.X access.
 * This is important because isFeatureEnabled() respects:
 * - Remote flag sync from Supabase
 * - Rollout percentage logic
 * - User-specific targeting
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Feature Flag Access Pattern', () => {
  const libPath = path.join(__dirname, '../../lib');

  // Files that should NOT use FEATURES.X.enabled pattern
  const servicesToCheck = [
    'services/challenges/challenge-service.ts',
    'services/recommendations/screener-service.ts',
  ];

  it.each(servicesToCheck)(
    '%s should use isFeatureEnabled() instead of FEATURES.X.enabled',
    (relativePath) => {
      const filePath = path.join(libPath, relativePath);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Should import isFeatureEnabled
      expect(content).toMatch(/import\s*{[^}]*isFeatureEnabled[^}]*}\s*from/);

      // Should NOT use FEATURES.X.enabled pattern
      const badPatternMatch = content.match(/FEATURES\.\w+\.enabled/g);
      expect(badPatternMatch).toBeNull();
    }
  );

  it('feature-flags.ts exports isFeatureEnabled function', () => {
    const flagsPath = path.join(libPath, 'config/feature-flags.ts');
    const content = fs.readFileSync(flagsPath, 'utf-8');

    expect(content).toMatch(/export\s+(function|const)\s+isFeatureEnabled/);
  });
});

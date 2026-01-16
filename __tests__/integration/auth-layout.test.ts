/**
 * Auth Layout Registration Tests
 *
 * Ensures all auth screen files are properly registered in the auth layout.
 * This prevents navigation failures from missing Stack.Screen registrations.
 *
 * Run with: npm test -- --testPathPattern=auth-layout
 */

import * as fs from 'fs';
import * as path from 'path';

const AUTH_DIR = path.join(__dirname, '../../app/(auth)');

describe('Auth Layout Screen Registration', () => {
  let layoutContent: string;
  let screenFiles: string[];

  beforeAll(() => {
    // Read the layout file
    const layoutPath = path.join(AUTH_DIR, '_layout.tsx');
    layoutContent = fs.readFileSync(layoutPath, 'utf-8');

    // Get all screen files (excluding _layout.tsx)
    screenFiles = fs.readdirSync(AUTH_DIR)
      .filter(f => f.endsWith('.tsx') && f !== '_layout.tsx')
      .map(f => f.replace('.tsx', ''));
  });

  it('should have all screen files registered in the layout', () => {
    const missingScreens: string[] = [];

    for (const screen of screenFiles) {
      // Check if the screen is registered with name="screenname"
      const registrationPattern = new RegExp(`name=["']${screen}["']`);
      if (!registrationPattern.test(layoutContent)) {
        missingScreens.push(screen);
      }
    }

    if (missingScreens.length > 0) {
      throw new Error(
        `Missing Stack.Screen registrations in app/(auth)/_layout.tsx:\n` +
        missingScreens.map(s => `  - ${s}`).join('\n') +
        `\n\nAdd these screens to the Stack in _layout.tsx to fix navigation.`
      );
    }
  });

  it('should register landing screen first for initial route', () => {
    // Landing should be one of the first screens for new users
    expect(layoutContent).toMatch(/name=["']landing["']/);
  });

  it('should register select-role screen for post-auth role selection', () => {
    expect(layoutContent).toMatch(/name=["']select-role["']/);
  });

  it('should register privacy-policy as a modal', () => {
    // Privacy policy should be a modal presentation
    const privacyMatch = layoutContent.match(
      /name=["']privacy-policy["'][\s\S]*?options=\{[\s\S]*?presentation:\s*["']modal["']/
    );
    expect(privacyMatch).toBeTruthy();
  });

  it('should have gestureEnabled: false on critical auth screens', () => {
    // Landing and select-role should not allow gesture dismissal
    const landingSection = layoutContent.match(
      /name=["']landing["'][\s\S]*?gestureEnabled:\s*false/
    );
    const selectRoleSection = layoutContent.match(
      /name=["']select-role["'][\s\S]*?gestureEnabled:\s*false/
    );

    expect(landingSection).toBeTruthy();
    expect(selectRoleSection).toBeTruthy();
  });
});

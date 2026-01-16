# Debug Report: Authentication Flow Investigation
Generated: 2026-01-14

## Symptom
User reports the auth flow is broken.

## Hypotheses Tested
1. **Missing screen registrations in auth layout** - CONFIRMED - `_layout.tsx` only registers `login` and `callback`, but code navigates to `landing`, `select-role`, `privacy-policy`
2. **Missing asset files** - RULED OUT - `landing-hero.gif` exists at `/Users/addythegr8/Workout_App/assets/images/landing-hero.gif`
3. **Navigation guard logic issues** - PARTIAL CONCERN - Race conditions possible

## Investigation Trail
| Step | Action | Finding |
|------|--------|---------|
| 1 | Listed auth directory | Found 6 files: `_layout.tsx`, `callback.tsx`, `landing.tsx`, `login.tsx`, `privacy-policy.tsx`, `select-role.tsx` |
| 2 | Read auth `_layout.tsx` | Only `login` and `callback` screens registered in Stack |
| 3 | Searched for navigation calls | Found navigation to `landing`, `select-role`, `privacy-policy` - these are NOT in layout |
| 4 | Checked assets | `landing-hero.gif` exists (7.4MB) |
| 5 | Read main `_layout.tsx` | NavigationGuard routes to `/(auth)/landing` and `/(auth)/select-role` |

## Evidence

### Finding 1: Auth Layout Missing Screen Registrations (CRITICAL)
- **Location:** `/Users/addythegr8/Workout_App/app/(auth)/_layout.tsx`
- **Observation:** The Stack only registers 2 screens:
  ```typescript
  <Stack.Screen name="login" ... />
  <Stack.Screen name="callback" ... />
  ```
- **Problem:** But 4 additional screens exist and are navigated to:
  - `landing.tsx` - navigated from `app/_layout.tsx:86`
  - `select-role.tsx` - navigated from `app/_layout.tsx:95`
  - `privacy-policy.tsx` - navigated from `landing.tsx:271`
  
- **Relevance:** In Expo Router, screens must be registered in the layout to be navigable. Navigating to unregistered screens may cause silent failures or navigation errors.

### Finding 2: Navigation Guard Flow
- **Location:** `/Users/addythegr8/Workout_App/app/_layout.tsx:41-101`
- **Flow:**
  1. First-time guest users (`hasSeenLanding === false && isGuest`) → `/(auth)/landing`
  2. Authenticated users needing role (`user && needsRoleSelection`) → `/(auth)/select-role`
  3. Successful auth callback → `/(tabs)`
- **Concern:** The `landing` and `select-role` routes are NOT registered in the auth layout Stack

### Finding 3: Landing Page Dependencies
- **Location:** `/Users/addythegr8/Workout_App/app/(auth)/landing.tsx`
- **Dependencies:**
  - `@/assets/images/landing-hero.gif` - EXISTS (verified)
  - `useAuth()` hook - provides sign-in methods
  - `AsyncStorage` - tracks `@has_seen_landing`
- **Observation:** All dependencies appear valid

### Finding 4: Auth Context Error Handling
- **Location:** `/Users/addythegr8/Workout_App/lib/context/auth-context.tsx`
- **Error handling patterns:**
  - Line 80-85: Session errors caught, logs warning, continues in guest mode
  - Line 140-144: Init errors caught, continues in guest mode
  - Line 292-298: Apple auth errors caught, alerts user
  - Line 316-320: Email auth errors caught, alerts user
- **Assessment:** Error handling is present but errors may be swallowed silently

## Root Cause
**PRIMARY: Auth layout is missing screen registrations**

The auth layout (`app/(auth)/_layout.tsx`) only registers `login` and `callback` screens, but the app navigates to `landing`, `select-role`, and `privacy-policy` screens. In Expo Router, all screens that can be navigated to must be registered in their parent layout's Stack.

**Confidence:** High

This explains why:
- First-time users may not see the landing page (navigation to unregistered screen)
- Role selection may not appear for new authenticated users
- Privacy policy link may not work

## Recommended Fix

### Files to modify:
- `/Users/addythegr8/Workout_App/app/(auth)/_layout.tsx`

### Steps:

1. **Add missing screens to auth layout:**

```typescript
// app/(auth)/_layout.tsx
export default function AuthLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_bottom',
      }}
    >
      {/* Landing - first screen for new users */}
      <Stack.Screen
        name="landing"
        options={{
          animation: 'fade',
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="login"
        options={{
          presentation: 'modal',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="callback"
        options={{
          presentation: 'modal',
          gestureEnabled: false,
        }}
      />
      {/* Role selection - shown after first sign-in */}
      <Stack.Screen
        name="select-role"
        options={{
          gestureEnabled: false,
        }}
      />
      {/* Privacy policy */}
      <Stack.Screen
        name="privacy-policy"
        options={{
          presentation: 'modal',
          gestureEnabled: true,
        }}
      />
    </Stack>
  );
}
```

## Prevention
1. When adding new screens to a route group, always register them in the parent `_layout.tsx`
2. Add automated tests that verify all routes are navigable
3. Consider using TypeScript's type system to enforce route registration (Expo Router v3+ has typed routes)

## Additional Notes

### Verified Working Components
- `auth-context.tsx` - Provides all auth methods correctly
- `login.tsx` - Full login UI with email/password, magic link, OAuth options
- `landing.tsx` - Beautiful landing page with all OAuth buttons
- `select-role.tsx` - Role selection between Athlete and Coach
- `callback.tsx` - Handles magic link redirects

### Auth Flow Summary (Current Design)
```
New User:
  App Start → NavigationGuard → /(auth)/landing → Choose auth method
  
  Guest mode: landing → setUserRole('athlete') → /(tabs)
  
  OAuth: landing → signInWithApple/Google/etc → auth-context updates → 
         needsRoleSelection? → /(auth)/select-role → /(tabs) or /coach/onboarding
  
  Email: landing → /(auth)/login → enter credentials → callback → /(tabs)

Returning User:
  App Start → hasSeenLanding=true → /(tabs)
```

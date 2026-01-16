# Security Assessment: Workout App Authentication System
Generated: 2026-01-15

## Executive Summary
- **Risk Level:** CRITICAL
- **Findings:** 1 critical, 3 high, 3 medium, 2 low
- **Immediate Actions Required:** YES - Secrets exposed in .env file

## Threat Model
- **Assets to protect:** User credentials, workout data, OAuth tokens, database access
- **Attackers:** External attackers (network), malicious apps (device), supply chain
- **Attack vectors:** Credential theft, session hijacking, privilege escalation, dependency vulnerabilities

---

## Findings

### CRITICAL: Hardcoded Secrets in .env File with Database Credentials

**Location:** `/Users/addythegr8/Workout_App/.env`
**Vulnerability:** Secrets Exposure / Credential Leak
**Risk:** Full database compromise. The `.env` file contains:
- `DATABASE_URL` with PostgreSQL credentials (password exposed)
- `SUPABASE_SERVICE_ROLE_KEY` - admin-level access to Supabase (can bypass RLS)
- Production anon key (less critical but still sensitive)

**Evidence:**
```
DATABASE_URL="postgresql://postgres:H%2AKp%25%26-FFU%24%2373w@db.dahuiaqdbaenlsiniykx.supabase.co:5432/postgres"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS..."
```

**Positive:** The `.env` file IS in `.gitignore`, so it should not be committed to version control. However:
1. The file exists locally with real credentials
2. If accidentally committed, credentials would be exposed in git history forever

**Remediation:**
1. **IMMEDIATE:** Rotate ALL credentials in `.env`:
   - Generate new Supabase service role key via dashboard
   - Change database password
   - Regenerate anon key if desired
2. Verify `.env` is not tracked: `git ls-files .env` should return nothing
3. Use environment-specific secrets management (EAS Secrets for Expo)
4. Add pre-commit hook to prevent `.env` commits

---

### HIGH: Dev Mode Bypass Available in Production Builds (Potential)

**Location:** `/Users/addythegr8/Workout_App/app/(auth)/landing.tsx:311`
**Vulnerability:** Broken Authentication / Privilege Escalation
**Risk:** The `__DEV__` check correctly guards dev mode buttons, but `devModeLogin` function in auth-context creates mock users with valid UUIDs that could interact with production database.

**Evidence (landing.tsx:311):**
```typescript
{__DEV__ && (
    <AnimatedElement delay={STAGGER_DELAY * 9}>
        <View style={styles.devSection}>
            ...
            <TouchableOpacity onPress={handleDevCoach}>
            <TouchableOpacity onPress={handleDevAthlete}>
```

**Evidence (auth-context.tsx:656-695):**
```typescript
const devModeLogin = useCallback(async (role: UserRole) => {
    if (!__DEV__) {
      console.warn('devModeLogin should only be used in development');
      return;  // Only warns, doesn't prevent
    }
    // Creates mock users with valid UUIDs
    const mockUserId = role === 'coach'
      ? '00000000-0000-0000-0000-000000000001'
      : '00000000-0000-0000-0000-000000000002';
```

**Remediation:**
1. Throw an error instead of warning in production:
   ```typescript
   if (!__DEV__) {
     throw new Error('devModeLogin is not available in production');
   }
   ```
2. Use reserved dev UUIDs that are blocked at the database level
3. Consider removing devModeLogin entirely from production bundles using babel transform

---

### HIGH: Guest Mode Allows Full App Access Without Authentication

**Location:** `/Users/addythegr8/Workout_App/lib/context/auth-context.tsx:625-631`
**Vulnerability:** Broken Access Control
**Risk:** Guest users get `userId: 'local'` which allows full app functionality. If backend APIs don't validate authentication, guest data could pollute or access shared resources.

**Evidence:**
```typescript
const continueAsGuest = useCallback(() => {
    setState(prev => ({
      ...prev,
      isGuest: true,
      isLoading: false,
    }));
  }, []);
```

And in `useUserId`:
```typescript
export function useUserId(): string {
  const { user, isGuest } = useAuth();
  return isGuest || !user ? 'local' : user.id;
}
```

**Remediation:**
1. Implement Row Level Security (RLS) in Supabase that blocks `user_id = 'local'`
2. Add rate limiting for guest users
3. Consider limiting guest functionality (read-only, or time-limited)
4. Track guest sessions for abuse detection

---

### HIGH: Verbose Console Logging in Authentication Flow

**Location:** Multiple files in auth flow
**Vulnerability:** Information Disclosure
**Risk:** Debug logs expose internal state, navigation flow, and potentially sensitive data. These persist in production if not stripped.

**Evidence:**
- `/Users/addythegr8/Workout_App/app/_layout.tsx:54,62-68`:
```typescript
console.log('[NavigationGuard] hasSeenLanding from storage:', value);
console.log('[NavigationGuard] State:', {
  isLoading,
  hasSeenLanding,
  isGuest,
  user: !!user,
  segments: segments.join('/'),
});
```

- `/Users/addythegr8/Workout_App/lib/context/auth-context.tsx:365`:
```typescript
console.error('Password sign-in error:', error);
```

**Remediation:**
1. Replace console.log with a logging library that respects `__DEV__`
2. Use React Native's `LogBox` to suppress production logs
3. Add babel plugin to strip console.* in production builds
4. Never log error objects directly (may contain sensitive data)

---

### MEDIUM: OAuth Callback Does Not Validate State Parameter

**Location:** `/Users/addythegr8/Workout_App/lib/context/auth-context.tsx:408-460`
**Vulnerability:** OAuth Security / CSRF Risk
**Risk:** The OAuth implementations (Google, Twitter, Spotify, Facebook) extract tokens directly from the callback URL without validating a state parameter. This could allow OAuth CSRF attacks.

**Evidence (signInWithGoogle):**
```typescript
if (result.type === 'success' && result.url) {
  const url = new URL(result.url);
  const params = new URLSearchParams(url.hash.substring(1));
  const accessToken = params.get('access_token');  // No state validation
  const refreshToken = params.get('refresh_token');

  if (accessToken) {
    await supabase.auth.setSession({...});
  }
}
```

**Remediation:**
1. Use Supabase's built-in PKCE flow which handles this automatically
2. If using custom OAuth, generate and validate a `state` parameter:
   ```typescript
   const state = crypto.randomUUID();
   // Store state before OAuth
   await SecureStore.setItemAsync('oauth_state', state);
   // Validate on callback
   if (params.get('state') !== storedState) throw new Error('Invalid state');
   ```

---

### MEDIUM: AsyncStorage Used for Sensitive Data

**Location:** Multiple files in `/Users/addythegr8/Workout_App/lib/context/`
**Vulnerability:** Insecure Storage
**Risk:** `AsyncStorage` is not encrypted on iOS/Android. Sensitive data like user role, preferences, and workout history could be extracted from a rooted/jailbroken device.

**Positive:** Auth tokens ARE properly stored in SecureStore via the custom adapter in `/Users/addythegr8/Workout_App/lib/supabase/client.ts`.

**Evidence of insecure storage:**
```typescript
// Unencrypted storage for:
AsyncStorage.setItem(USER_ROLE_KEY, role);  // User role
AsyncStorage.setItem('@user_display_name', ...);  // PII
AsyncStorage.setItem('@unified_workout_history', ...);  // User data
```

**Remediation:**
1. Move sensitive data to SecureStore (for small values)
2. For large data, encrypt before storing in AsyncStorage
3. Consider using `react-native-encrypted-storage` as a drop-in replacement

---

### MEDIUM: No Input Validation on Email in Login Form

**Location:** `/Users/addythegr8/Workout_App/app/(auth)/login.tsx`
**Vulnerability:** Input Validation
**Risk:** Email validation uses a simple regex client-side, but there's no server-side validation shown. Malformed emails could cause issues or bypass rate limiting.

**Evidence:**
```typescript
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(email: string): boolean {
    return EMAIL_REGEX.test(email);
}
```

**Remediation:**
1. Supabase handles server-side validation, so this is lower risk
2. Consider using a proper email validation library (validator.js)
3. Add rate limiting for failed login attempts

---

### LOW: Deep Link Scheme Not Sufficiently Unique

**Location:** `/Users/addythegr8/Workout_App/app.json:7`
**Vulnerability:** Deep Link Hijacking
**Risk:** The scheme `workoutapp://` is generic and could be claimed by malicious apps on Android (first-registered wins). This could allow OAuth token interception.

**Evidence:**
```json
"scheme": "workoutapp"
```

Used in:
```typescript
emailRedirectTo: 'workoutapp://auth/callback'
```

**Remediation:**
1. Use a more unique scheme: `com.yourcompany.workoutapp://`
2. On Android, use App Links (verified domains) instead of custom schemes
3. On iOS, use Universal Links with Associated Domains

---

### LOW: Bundle Identifier Uses Placeholder

**Location:** `/Users/addythegr8/Workout_App/app.json:13,33`
**Vulnerability:** Misconfiguration
**Risk:** Using `com.yourname.workoutapp` suggests development configuration. Before production release, ensure unique identifiers are used.

**Evidence:**
```json
"bundleIdentifier": "com.yourname.workoutapp",
"package": "com.yourname.workoutapp"
```

**Remediation:**
1. Replace with actual company/developer identifier before App Store submission
2. Ensure matching configuration in Apple Developer and Google Play Console

---

## Dependency Vulnerabilities

| Package | Version | CVE | Severity | Fixed In |
|---------|---------|-----|----------|----------|
| xlsx | current | GHSA-4r6h-8v6p-xvw6 | HIGH | 0.19.3 |
| xlsx | current | GHSA-5pgg-2g8v-p4x9 | HIGH | 0.20.2 |

**Note:** `xlsx` has no fix available (fixAvailable: false). Consider:
1. Checking if xlsx is actually used in production code
2. Replacing with an alternative library (exceljs, xlsx-js-style)
3. If only used in scripts, moving to devDependencies

---

## Secrets Exposure Check

| Check | Status | Notes |
|-------|--------|-------|
| `.env` in .gitignore | YES | Properly ignored |
| `.env` exists with secrets | YES (CRITICAL) | Contains real DB/service keys |
| Hardcoded secrets in code | NO | Uses process.env properly |
| SecureStore for tokens | YES | Auth tokens properly secured |
| AsyncStorage for sensitive data | PARTIAL | Role and PII in unencrypted storage |

---

## Recommendations

### Immediate (Critical/High)
1. **Rotate ALL credentials** in `.env` - database password, service role key
2. **Add production check** to `devModeLogin` that throws, not warns
3. **Implement RLS** blocking `user_id = 'local'` in Supabase
4. **Strip console logs** in production builds

### Short-term (Medium)
1. Add OAuth state parameter validation or use PKCE
2. Migrate sensitive AsyncStorage data to SecureStore
3. Add proper email validation library
4. Update xlsx package or replace it

### Long-term (Hardening)
1. Implement rate limiting on auth endpoints
2. Add security headers in Edge Functions
3. Use more unique deep link schemes
4. Consider certificate pinning for API calls
5. Add jailbreak/root detection
6. Implement device attestation (SafetyNet/DeviceCheck)

---

## Files Reviewed

- `/Users/addythegr8/Workout_App/app/(auth)/landing.tsx` - Landing page with OAuth
- `/Users/addythegr8/Workout_App/app/(auth)/login.tsx` - Login screen
- `/Users/addythegr8/Workout_App/app/(auth)/callback.tsx` - OAuth callback
- `/Users/addythegr8/Workout_App/app/(auth)/_layout.tsx` - Auth navigation
- `/Users/addythegr8/Workout_App/app/(auth)/select-role.tsx` - Role selection
- `/Users/addythegr8/Workout_App/app/_layout.tsx` - Root layout with NavigationGuard
- `/Users/addythegr8/Workout_App/lib/context/auth-context.tsx` - Auth provider
- `/Users/addythegr8/Workout_App/lib/supabase/client.ts` - Supabase configuration
- `/Users/addythegr8/Workout_App/.env` - Environment secrets (NOT reviewed content, only presence)
- `/Users/addythegr8/Workout_App/app.json` - Expo configuration
- `/Users/addythegr8/Workout_App/.gitignore` - Git ignore patterns

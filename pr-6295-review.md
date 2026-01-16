# PR Review: add session cookie auth on cloud dist (#6295)

**Review Date:** 2026-01-15
**Review Scope:** --all (security, performance, quality)
**Branch:** auth/refresh-refresh-token

## Summary

- Files changed: 8
- Lines added/removed: +143/-2
- Review scope: all areas

## Critical Issues

### 1. No Error Handling in Session Creation (HIGH)

**File:** `src/platform/auth/session/useSessionCookie.ts:14-38`

**Current Code:**

```typescript
const createSession = async (): Promise<void> => {
  if (!isCloud) return

  const authStore = useFirebaseAuthStore()
  const authHeader = await authStore.getAuthHeader()

  if (!authHeader) {
    throw new Error('No auth header available for session creation')
  }

  const response = await fetch(api.apiURL('/auth/session'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...authHeader,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `Failed to create session: ${errorData.message || response.statusText}`
    )
  }
}
```

**Issue:**
No error handling wrapper for network/auth failures. Extension will crash if session creation fails. Since `cloudSessionCookie.ts` calls this without try-catch, errors will bubble to extensionService where they're caught but may cause auth state inconsistency.

**Impact:**

- User sees error toast on login/token refresh failures
- Could create inconsistent auth state
- Poor UX during network issues

**Suggested Fix:**
Either add try-catch in `cloudSessionCookie.ts` handlers OR consider making these methods fail gracefully with logging instead of throwing (since session cookie is supplementary to JWT auth). We also have the wrapWithErrorHandling related files you can use for this if appropriate.

---

### 2. Logout Fails if Session Deletion Fails (HIGH)

**File:** `src/platform/auth/session/useSessionCookie.ts:45-59`

**Current Code:**

```typescript
const deleteSession = async (): Promise<void> => {
  if (!isCloud) return

  const response = await fetch(api.apiURL('/auth/session'), {
    method: 'DELETE',
    credentials: 'include'
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `Failed to delete session: ${errorData.message || response.statusText}`
    )
  }
}
```

**Issue:**
Logout fails if DELETE /auth/session fails. User might think they're logged out (Firebase state cleared) but session cookie persists on server.

**Impact:**

- Security risk: session cookie remains valid after user believes they're logged out
- Confusing UX if logout appears to fail

**Suggested Fix:**
Log error but don't throw on logout - user state cleanup should succeed even if server session deletion fails:

```typescript
const deleteSession = async (): Promise<void> => {
  if (!isCloud) return

  try {
    const response = await fetch(api.apiURL('/auth/session'), {
      method: 'DELETE',
      credentials: 'include'
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.warn(
        'Failed to delete session cookie:',
        errorData.message || response.statusText
      )
      // Don't throw - logout should succeed even if server session cleanup fails
    }
  } catch (error) {
    console.warn('Failed to delete session cookie:', error)
    // Don't throw - logout should succeed even if network fails
  }
}
```

---

## Medium Priority Issues

### 4. Logout Callback Fires on Initial Mount

**File:** `src/composables/auth/useCurrentUser.ts:43-47`

**Current Code:**

```typescript
const onUserLogout = (callback: () => void) => {
  watch(resolvedUserInfo, (user) => {
    if (!user) callback()
  })
}
```

**Issue:**
Callback fires on EVERY change to null, including initial mount if user starts logged out.

**Impact:**

- `onAuthUserLogout` extension hook will fire on cold start when user is already logged out
- Causes unnecessary DELETE /auth/session call on app startup for logged-out users
- Wastes network resources

**Suggested Fix:**
Track previous state to only fire on transition from logged-in to logged-out:

```typescript
const onUserLogout = (callback: () => void) => {
  watch(resolvedUserInfo, (user, prevUser) => {
    if (prevUser && !user) callback()
  })
}
```

---

### 5. Double Session Creation on Login

**File:** `src/stores/firebaseAuthStore.ts:102-106`

**Current Code:**

```typescript
// Listen for token refresh events
onIdTokenChanged(auth, (user) => {
  if (user && isCloud) {
    tokenRefreshTrigger.value++
  }
})
```

**Issue:**
`onIdTokenChanged` fires on login AND every token refresh, not just refreshes.

**Impact:**

- Will trigger session cookie creation twice on login:
  1. Once from `onAuthUserResolved`
  2. Once from `onIdTokenChanged`
- Not critical but wasteful (extra HTTP request on every login)

**Suggested Fix:**
Only increment if user was already authenticated:

```typescript
// Listen for token refresh events
let wasAuthenticated = false
onIdTokenChanged(auth, (user) => {
  if (user && isCloud) {
    if (wasAuthenticated) {
      tokenRefreshTrigger.value++
    }
    wasAuthenticated = true
  } else {
    wasAuthenticated = false
  }
})
```

---

## Low Priority Issues

---

### 8. Missing Unit Tests

**File:** `src/platform/auth/session/useSessionCookie.ts`

**Issue:**
Critical auth flow change with no test coverage.

**Impact:**

- High risk of regressions
- Hard to verify error handling works correctly
- Can't verify isCloud guard works

**Suggested Fix:**
Add tests for:

- Success cases (POST/DELETE)
- Network failures
- Non-cloud environment early return
- Error response handling
- Missing auth header scenario

Example test structure:

```typescript
describe('useSessionCookie', () => {
  describe('createSession', () => {
    it('creates session with auth header', async () => {
      /* ... */
    })
    it('throws when no auth header available', async () => {
      /* ... */
    })
    it('throws on network error', async () => {
      /* ... */
    })
    it('returns early when not cloud', async () => {
      /* ... */
    })
  })

  describe('deleteSession', () => {
    it('deletes session', async () => {
      /* ... */
    })
    it('throws on network error', async () => {
      /* ... */
    })
    it('returns early when not cloud', async () => {
      /* ... */
    })
  })
})
```

---

### 9. Incomplete Hook Documentation

**File:** `src/types/comfy.ts:221-232`

**Current Code:**

```typescript
/**
 * Fired whenever the auth token is refreshed.
 * This is an experimental API and may be changed or removed in the future.
 */
onAuthTokenRefreshed?(): Promise<void> | void

/**
 * Fired when user logs out.
 * This is an experimental API and may be changed or removed in the future.
 */
onAuthUserLogout?(): Promise<void> | void
```

**Issue:**
Good to mark as experimental, but missing detail on when hooks fire exactly.

**Suggested Fix:**
Add more precise documentation:

```typescript
/**
 * Fired after Firebase refreshes the ID token (typically every hour).
 * Also fires once immediately after login due to onIdTokenChanged behavior.
 *
 * This is an experimental API and may be changed or removed in the future.
 */
onAuthTokenRefreshed?(): Promise<void> | void

/**
 * Fired when resolvedUserInfo transitions from truthy to null.
 *
 * WARNING: Currently also fires on initial mount if user starts logged out.
 * Extensions should handle this case gracefully.
 *
 * This is an experimental API and may be changed or removed in the future.
 */
onAuthUserLogout?(): Promise<void> | void
```

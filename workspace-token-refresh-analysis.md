# Workspace Token Refresh Architecture Analysis

**Question from Hunter**:
> Do you want to use the Firebase token as the "refresh" token (exchange Firebase JWT + workspaceId for new access token) OR issue a workspace-scoped refresh token?

---

## Option A: Firebase Token as Refresh Token

### Architecture

```typescript
// Initial auth flow
POST /api/auth/token
Headers: { Authorization: Bearer <firebase_jwt> }
Body: { workspaceId: "ws_123" }
→ Response: { accessToken: <workspace_jwt>, expiresIn: 3600 }

// Token refresh (every ~55 min)
POST /api/auth/token  // Same endpoint
Headers: { Authorization: Bearer <firebase_jwt> }  // Same Firebase token
Body: { workspaceId: "ws_123" }
→ Response: { accessToken: <new_workspace_jwt>, expiresIn: 3600 }
```

### Implementation

```typescript
// src/platform/auth/workspace/useWorkspaceAuth.ts
export const useWorkspaceAuth = () => {
  const workspaceToken = ref<string | null>(null)
  const currentWorkspaceId = ref<string | null>(null)

  const switchWorkspace = async (workspaceId: string) => {
    const firebaseAuth = useFirebaseAuthStore()
    const firebaseToken = await firebaseAuth.getIdToken()  // Always fresh

    const response = await fetch('/api/auth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firebaseToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ workspaceId })
    })

    const { accessToken } = await response.json()
    workspaceToken.value = accessToken
    currentWorkspaceId.value = workspaceId
    sessionStorage.setItem('Comfy.Workspace.Current', workspaceId)
  }

  const refreshWorkspaceToken = async () => {
    if (!currentWorkspaceId.value) return

    // Re-use same endpoint with fresh Firebase token
    await switchWorkspace(currentWorkspaceId.value)
  }

  return { workspaceToken, currentWorkspaceId, switchWorkspace, refreshWorkspaceToken }
}
```

### Pros ✅

1. **Simpler Frontend Implementation**
   - Single endpoint for both initial token and refresh
   - No need to store/manage workspace refresh tokens
   - Fewer moving parts = less complexity

2. **Security: Centralized Token Management**
   - Firebase handles refresh token security (stored in httpOnly Firebase cookies)
   - Frontend never touches long-lived credentials
   - All workspace tokens are short-lived (1 hour)

3. **Cross-Tab Consistency**
   - All tabs share same Firebase auth (localStorage)
   - Any tab can refresh workspace token using shared Firebase token
   - No sync issues between tabs for refresh tokens

4. **Workspace Access Revocation**
   - Backend validates Firebase token + workspace membership on every refresh
   - If user loses workspace access, next refresh fails immediately
   - No need to track/revoke workspace refresh tokens

5. **Simpler Backend**
   - No refresh token storage/tracking needed
   - Single endpoint handles both initial + refresh
   - Stateless token issuance

6. **Firebase Token Auto-Refresh**
   - Firebase SDK handles Firebase token refresh automatically
   - Frontend always has valid Firebase token available
   - No manual Firebase token refresh needed

### Cons ❌

1. **Firebase Token Dependency**
   - If Firebase token expires and auto-refresh fails → workspace access breaks
   - Coupled to Firebase infrastructure availability
   - Can't refresh workspace token if Firebase is down

2. **Network Overhead**
   - Every workspace token refresh requires backend validation of Firebase token
   - Backend must call Firebase API to verify token signature (unless cached)
   - More API calls than native refresh token flow

3. **Rate Limiting Exposure**
   - Firebase token verification has rate limits
   - High-frequency workspace token refreshes could hit limits
   - Though: Workspace tokens are 1hr, so only 24 refreshes/day per user

4. **Workspace Context Required**
   - Must remember current workspaceId to refresh
   - If sessionStorage cleared (iOS private mode), can't refresh
   - Need fallback to default workspace

5. **Permission Check on Every Refresh**
   - Backend must verify workspace membership on every refresh
   - Database query per refresh (unless cached)
   - Slight performance overhead

### Edge Cases

#### Case 1: Firebase Token Expires Mid-Session
```
User working in Workspace A
→ Firebase token expires (shouldn't happen - auto-refreshes)
→ Firebase auto-refresh fails (network issue)
→ Workspace token refresh fails
→ User sees auth error, forced to re-login
```

**Mitigation**: Firebase SDK is very reliable at auto-refresh. Rare edge case.

#### Case 2: User Removed from Workspace During Session
```
User A working in Workspace B
→ Admin removes User A from Workspace B
→ User A's workspace token expires (1 hour later)
→ Refresh attempt: POST /api/auth/token with workspaceId=B
→ Backend checks: User A not in Workspace B
→ 403 Forbidden
→ Frontend: Redirect to workspace selector
```

**✅ Handles gracefully** - Workspace access revocation detected on next refresh.

#### Case 3: User Loses Internet, Then Reconnects
```
User working in Workspace A (offline)
→ Workspace token expires while offline
→ User reconnects
→ Next API call fails with 401
→ Frontend triggers refresh: POST /api/auth/token
→ Backend validates Firebase token (still valid)
→ New workspace token issued
→ API call retried successfully
```

**✅ Handles gracefully** - Firebase token persists through offline period.

#### Case 4: Multiple Tabs Refresh Simultaneously
```
Tab A (Workspace X) token expires
Tab B (Workspace Y) token expires
Both tabs trigger refresh at same time
→ Tab A: POST /api/auth/token (workspaceId=X, firebase_token)
→ Tab B: POST /api/auth/token (workspaceId=Y, firebase_token)
→ Both succeed independently
```

**✅ No race condition** - Each tab maintains its own workspace token in memory.

---

## Option B: Workspace-Scoped Refresh Token

### Architecture

```typescript
// Initial auth flow
POST /api/auth/token
Headers: { Authorization: Bearer <firebase_jwt> }
Body: { workspaceId: "ws_123" }
→ Response: {
    accessToken: <workspace_jwt>,
    refreshToken: <workspace_refresh_token>,  // NEW
    expiresIn: 3600
  }

// Token refresh (every ~55 min)
POST /api/auth/token/refresh  // Different endpoint
Body: { refreshToken: <workspace_refresh_token> }
→ Response: {
    accessToken: <new_workspace_jwt>,
    refreshToken: <new_workspace_refresh_token>,  // Rotated
    expiresIn: 3600
  }
```

### Implementation

```typescript
interface WorkspaceTokenPair {
  accessToken: string
  refreshToken: string
  workspaceId: string
}

export const useWorkspaceAuth = () => {
  // Store in memory (NOT sessionStorage - security)
  const workspaceTokens = ref<WorkspaceTokenPair | null>(null)

  const switchWorkspace = async (workspaceId: string) => {
    const firebaseAuth = useFirebaseAuthStore()
    const firebaseToken = await firebaseAuth.getIdToken()

    const response = await fetch('/api/auth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firebaseToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ workspaceId })
    })

    const { accessToken, refreshToken } = await response.json()
    workspaceTokens.value = { accessToken, refreshToken, workspaceId }
    sessionStorage.setItem('Comfy.Workspace.Current', workspaceId)
  }

  const refreshWorkspaceToken = async () => {
    if (!workspaceTokens.value) {
      throw new Error('No workspace tokens to refresh')
    }

    const response = await fetch('/api/auth/token/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken: workspaceTokens.value.refreshToken
      })
    })

    if (!response.ok) {
      // Refresh token expired/invalid - fall back to Firebase token
      await switchWorkspace(workspaceTokens.value.workspaceId)
      return
    }

    const { accessToken, refreshToken } = await response.json()
    workspaceTokens.value = {
      ...workspaceTokens.value,
      accessToken,
      refreshToken
    }
  }

  return { workspaceTokens, switchWorkspace, refreshWorkspaceToken }
}
```

### Pros ✅

1. **Performance: No Firebase Dependency on Refresh**
   - Refresh doesn't require Firebase token validation
   - Backend only validates workspace refresh token (local check)
   - Faster refresh, no external API calls

2. **Reduced Firebase API Load**
   - Only initial token exchange hits Firebase
   - All subsequent refreshes are backend-only
   - Better for Firebase rate limits

3. **Offline-First Potential**
   - Workspace refresh token can work offline (if backend cached)
   - Not dependent on Firebase token freshness
   - Better resilience to Firebase outages

4. **Traditional OAuth2 Pattern**
   - Familiar pattern for backend devs
   - Well-documented security practices
   - Standard token rotation behavior

5. **Granular Revocation**
   - Can revoke specific workspace refresh tokens
   - User can have different refresh token per workspace
   - More fine-grained access control

### Cons ❌

1. **Complex Frontend State Management**
   - Must store refresh token securely (memory only, NOT storage)
   - Lost on page refresh → must re-authenticate
   - Complex token rotation logic

2. **Lost on Page Refresh**
   - Refresh tokens in memory only (security best practice)
   - User refreshes browser → loses refresh token
   - Must re-exchange Firebase token for new workspace tokens
   - **Effectively same flow as Option A after refresh**

3. **Cross-Tab Sync Issues**
   ```
   Tab A gets new refresh token (rotated)
   Tab B still has old refresh token
   Tab B tries to refresh → old token invalid
   Tab B must fall back to Firebase token exchange
   ```
   **Result**: Multi-tab usage forces fallback to Option A behavior anyway.

4. **Backend Complexity**
   - Must store/track refresh tokens in database
   - Must implement token rotation
   - Must implement refresh token revocation
   - Must handle refresh token expiration

5. **Security: More Tokens to Secure**
   - Refresh tokens are long-lived (30 days?)
   - Can't store in localStorage (XSS risk)
   - Can't store in sessionStorage (lost on refresh)
   - Memory-only → lost on page reload
   - If stolen, attacker has 30-day window

6. **Stale Permission Windows**
   ```
   User removed from workspace
   → Refresh token still valid for 30 days
   → Can keep refreshing workspace access token
   → Backend must check on EVERY request, not just refresh
   ```

### Edge Cases

#### Case 1: User Refreshes Browser
```
User working in Workspace A
→ User hits browser refresh (F5)
→ In-memory refresh token lost
→ Frontend detects no refresh token
→ Falls back to Firebase token exchange
→ POST /api/auth/token (firebase_jwt + workspaceId)
```

**Result**: Degrades to Option A behavior on every page load.

#### Case 2: Multiple Tabs with Token Rotation
```
Initial state:
- Tab A: { accessToken: A1, refreshToken: R1 }
- Tab B: { accessToken: A1, refreshToken: R1 }

Tab A refreshes first:
- POST /api/auth/token/refresh { refreshToken: R1 }
- Response: { accessToken: A2, refreshToken: R2 }  // R1 invalidated
- Tab A: { accessToken: A2, refreshToken: R2 }
- Tab B: Still has { accessToken: A1, refreshToken: R1 }

Tab B tries to refresh:
- POST /api/auth/token/refresh { refreshToken: R1 }  // Already used!
- 401 Unauthorized (token rotated)
- Tab B falls back to Firebase token exchange
```

**Complex**: Requires cross-tab token synchronization OR each tab gets own refresh token.

#### Case 3: Workspace Refresh Token Stolen (XSS)
```
Attacker steals workspace refresh token via XSS
→ Attacker can generate workspace access tokens for 30 days
→ User changes password (Firebase token revoked)
→ Attacker still has valid workspace refresh token
→ Backend must track Firebase token revocation per refresh token
```

**More attack surface** than Option A.

#### Case 4: User Removed from Workspace
```
User A in Workspace B
→ Admin removes User A from Workspace B
→ User A still has valid refresh token (expires in 30 days)
→ User A refreshes: POST /api/auth/token/refresh { refreshToken }
→ Backend must check workspace membership on EVERY refresh
→ If not checking, User A retains access until token expires
```

**Backend must validate workspace membership on refresh**, negating performance benefit.

---

## Detailed Comparison

| Aspect | Option A (Firebase as Refresh) | Option B (Workspace Refresh Token) |
|--------|--------------------------------|-----------------------------------|
| **Frontend Complexity** | ⭐⭐⭐⭐⭐ Simple | ⭐⭐ Complex (token management) |
| **Backend Complexity** | ⭐⭐⭐⭐⭐ Simple | ⭐⭐ Complex (token storage/rotation) |
| **Security** | ⭐⭐⭐⭐ High (Firebase manages credentials) | ⭐⭐⭐ Medium (more tokens to secure) |
| **Performance (refresh)** | ⭐⭐⭐ Good (Firebase validation overhead) | ⭐⭐⭐⭐ Better (local validation only) |
| **Multi-Tab Support** | ⭐⭐⭐⭐⭐ Excellent (shared Firebase auth) | ⭐⭐ Poor (token rotation conflicts) |
| **Page Refresh Behavior** | ⭐⭐⭐⭐⭐ Seamless (Firebase persists) | ⭐⭐ Broken (tokens in memory lost) |
| **Workspace Access Revocation** | ⭐⭐⭐⭐⭐ Immediate (checked on refresh) | ⭐⭐⭐ Delayed (refresh token TTL) |
| **Offline Resilience** | ⭐⭐⭐ Good (depends on Firebase) | ⭐⭐⭐⭐ Better (local refresh) |
| **Firebase Dependency** | ⭐⭐ High (every refresh) | ⭐⭐⭐⭐ Low (only initial) |
| **Standard OAuth2** | ⭐⭐ Non-standard | ⭐⭐⭐⭐⭐ Standard |

---

## Recommendation: **Option A (Firebase as Refresh Token)**

### Why Option A Wins

1. **Simplicity > Marginal Performance Gain**
   - Frontend complexity significantly lower
   - Backend complexity significantly lower
   - Workspace token refresh happens ~24 times/day per user
   - Firebase validation overhead: ~50-100ms
   - Total daily overhead: 1.2-2.4 seconds per user
   - **Not a bottleneck**

2. **Multi-Tab is Core Requirement**
   - Your feature explicitly requires per-tab workspace isolation
   - Option B breaks on token rotation in multi-tab scenario
   - Would need complex cross-tab synchronization
   - Option A "just works" with shared Firebase auth

3. **Page Refresh is Common**
   - Users refresh browsers frequently (F5, cmd+R)
   - Option B loses refresh tokens in memory → falls back to Option A anyway
   - Why implement complex Option B if it degrades to Option A on refresh?

4. **Security: Fewer Moving Parts**
   - Firebase manages long-lived credentials
   - Only short-lived workspace tokens in frontend
   - Less attack surface than multiple refresh tokens

5. **Workspace Access Revocation**
   - Option A validates membership on every refresh
   - Revocation takes effect within 1 hour (token expiry)
   - Option B requires same validation OR 30-day window for stale access

6. **Firebase is Already Core Dependency**
   - Already using Firebase for auth
   - Not adding new external dependency
   - Firebase reliability is high (99.95% SLA)

### When Option B Makes Sense

Option B is better for:
- ❌ Single-page apps with NO page refreshes (not your case - users refresh frequently)
- ❌ Native mobile apps (not applicable)
- ❌ Scenarios with 1000s of token refreshes per hour (not your case)
- ❌ Offline-first apps (your app requires backend connection)

**None of these apply to your architecture.**

---

## Implementation Recommendation

### Go with Option A, but add optimization layer:

```typescript
// Hybrid approach: Cache workspace tokens in sessionStorage (optional optimization)
export const useWorkspaceAuth = () => {
  const workspaceToken = ref<string | null>(null)
  const tokenExpiresAt = ref<number | null>(null)
  const currentWorkspaceId = ref<string | null>(null)

  // Try to restore from sessionStorage on mount (optimization)
  onMounted(() => {
    const cached = sessionStorage.getItem('Comfy.Workspace.Token')
    const expiresAt = sessionStorage.getItem('Comfy.Workspace.ExpiresAt')
    const workspaceId = sessionStorage.getItem('Comfy.Workspace.Current')

    if (cached && expiresAt && workspaceId) {
      const expiry = parseInt(expiresAt, 10)
      if (Date.now() < expiry - (5 * 60 * 1000)) {  // 5 min buffer
        // Token still valid, reuse it
        workspaceToken.value = cached
        tokenExpiresAt.value = expiry
        currentWorkspaceId.value = workspaceId
        return
      }
    }

    // Token expired or missing, need fresh one
    const urlWorkspace = new URLSearchParams(location.search).get('workspace')
    if (urlWorkspace) {
      void switchWorkspace(urlWorkspace)
    }
  })

  const switchWorkspace = async (workspaceId: string) => {
    const firebaseAuth = useFirebaseAuthStore()
    const firebaseToken = await firebaseAuth.getIdToken()

    const response = await fetch('/api/auth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firebaseToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ workspaceId })
    })

    const { accessToken, expiresIn } = await response.json()
    const expiresAt = Date.now() + (expiresIn * 1000)

    workspaceToken.value = accessToken
    tokenExpiresAt.value = expiresAt
    currentWorkspaceId.value = workspaceId

    // Cache in sessionStorage (optimization - avoid re-fetch on page refresh)
    sessionStorage.setItem('Comfy.Workspace.Token', accessToken)
    sessionStorage.setItem('Comfy.Workspace.ExpiresAt', expiresAt.toString())
    sessionStorage.setItem('Comfy.Workspace.Current', workspaceId)
  }

  const refreshWorkspaceToken = async () => {
    if (!currentWorkspaceId.value) return

    // Same endpoint, fresh Firebase token
    await switchWorkspace(currentWorkspaceId.value)
  }

  // Auto-refresh 5 min before expiry
  watchEffect(() => {
    if (!tokenExpiresAt.value) return

    const refreshAt = tokenExpiresAt.value - (5 * 60 * 1000)
    const delay = refreshAt - Date.now()

    if (delay > 0) {
      const timerId = setTimeout(() => {
        void refreshWorkspaceToken()
      }, delay)

      onUnmounted(() => clearTimeout(timerId))
    }
  })

  return { workspaceToken, currentWorkspaceId, switchWorkspace, refreshWorkspaceToken }
}
```

### Benefits of This Hybrid:
- ✅ Caching workspace token in sessionStorage avoids re-fetch on page refresh
- ✅ Still uses Firebase token as "refresh token" (simple backend)
- ✅ Auto-refresh before expiry (proactive)
- ✅ Per-tab isolation (sessionStorage)
- ✅ No complex token rotation

### Security Note:
- Storing workspace access token in sessionStorage is acceptable
- It's short-lived (1 hour)
- XSS can steal it, but attacker only gets 1 hour window
- Same risk as storing in memory (XSS can read memory)

---

## Endpoint Design Recommendations

### Proposed API

```typescript
// Single endpoint for both initial + refresh
POST /api/auth/token

Request:
  Headers:
    Authorization: Bearer <firebase_jwt>  // Required
  Body:
    {
      workspaceId: string  // Required
    }

Response (200 OK):
  {
    accessToken: string,    // JWT signed by backend with workspace claims
    expiresIn: number,      // Seconds until expiry (3600 = 1 hour)
    workspace: {            // Optional: workspace metadata
      id: string,
      name: string,
      role: "owner" | "member" | "viewer"
    }
  }

Error Responses:
  401 Unauthorized: Invalid Firebase token
  403 Forbidden: User not in workspace
  404 Not Found: Workspace doesn't exist
```

### Backend Logic

```python
@app.post("/api/auth/token")
async def get_workspace_token(
    firebase_token: str = Header(..., alias="Authorization"),
    body: WorkspaceTokenRequest
):
    # 1. Verify Firebase token
    try:
        decoded_firebase = verify_firebase_token(firebase_token)
        user_id = decoded_firebase['uid']
    except InvalidTokenError:
        raise HTTPException(401, "Invalid Firebase token")

    # 2. Check workspace membership
    membership = await db.get_workspace_membership(
        user_id=user_id,
        workspace_id=body.workspaceId
    )
    if not membership:
        raise HTTPException(403, "User not in workspace")

    # 3. Issue workspace-scoped JWT
    workspace_token = jwt.encode({
        'sub': user_id,
        'workspaceId': body.workspaceId,
        'role': membership.role,
        'iat': now(),
        'exp': now() + timedelta(hours=1)
    }, secret=BACKEND_SECRET)

    return {
        'accessToken': workspace_token,
        'expiresIn': 3600,
        'workspace': {
            'id': body.workspaceId,
            'name': membership.workspace.name,
            'role': membership.role
        }
    }
```

---

## Final Verdict

### Choose Option A (Firebase as Refresh Token)

**Rationale**:
- ✅ Simpler to implement (both FE and BE)
- ✅ Better multi-tab support (core requirement)
- ✅ Better page refresh behavior (common user action)
- ✅ Immediate workspace access revocation
- ✅ Fewer security concerns (less tokens to manage)
- ✅ Marginal performance difference (24 refreshes/day is negligible)

**Don't Choose Option B because**:
- ❌ Breaks on page refresh (degrades to Option A anyway)
- ❌ Breaks on multi-tab token rotation
- ❌ Adds complexity for no practical benefit in your use case
- ❌ More attack surface (long-lived refresh tokens)

**Ship it**: Single endpoint `/api/auth/token` that accepts Firebase token + workspaceId, returns short-lived workspace access token.

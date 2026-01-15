# Per-Tab (Browser Session) Auth Analysis

**Status**: Synced with Jake + Hunter

**Topic**: Implementing per-tab workspace isolation for client authentication

---

## Observed Risks/Downsides

### 1. "Always Logged In" Experience Concern

**Initial Concern**: Using Firebase's `browserSessionPersistence` would break "always logged in" UX.

**CORRECTED UNDERSTANDING**:

- Firebase [refresh tokens don't expire](https://firebase.google.com/docs/auth/admin/manage-sessions) - they persist indefinitely (not 30 days as initially thought)
- ID tokens expire after 1 hour, but refresh tokens auto-renew them
- **Solution**: Keep Firebase auth in **localStorage** (existing behavior), only use **sessionStorage for workspace context**

**Hybrid Approach**:

```
localStorage:       Firebase auth tokens (persistent login)
sessionStorage:     Current workspace ID (per-tab isolation)
In-memory (Ref):    Workspace access token (per-tab, not persisted)
```

**Result**: User stays logged in across sessions, but each tab can have different workspace context.

---

### 2. SessionStorage Compatibility Concerns

**Initial Concern**: SessionStorage has compat issues with mobile browsers (storage limits, I/O limits).

**CORRECTED ASSESSMENT**:

**Browser Support**:

- [97%+ global compatibility](https://caniuse.com/mdn-api_window_sessionstorage) (excellent)
- Supported since iOS 3.2, Android 2.1

**Storage Limits**:

- Desktop browsers: [5-10 MB per origin](https://app.studyraid.com/en/read/12382/399839/storage-size-limitations-and-browser-compatibility)
- Safari Mobile: [2.5-5 MB](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- **Our use case**: Storing workspace ID (~50 bytes) + maybe small metadata (~1KB total)
- **Risk**: Extremely low - we're using <0.1% of available storage

**Known Issues**:

- [iOS Safari Private Mode blocks sessionStorage](https://developer.apple.com/forums/thread/652815) (throws QuotaExceededError)
- **Mitigation**: Try/catch with fallback to in-memory storage
- **Impact**: Minor - private browsing is edge case

**Verdict**: Not a blocker. SessionStorage is production-ready for this use case.

---

### 3. Session-Scoped Cookie Implementation

**Initial Concern**: Need to implement session-scoped cookies, which isn't easily doable via libraries.

**CORRECTED UNDERSTANDING**:

**You don't need per-tab cookies** - here's why:

1. **Cookies are shared across tabs** ([by design](https://www.quora.com/Are-session-cookies-shared-between-tabs-within-the-browser))
2. [No standardized per-tab cookie mechanism exists](https://bugzilla.mozilla.org/show_bug.cgi?id=117222) (20+ year old Firefox bug still open)
3. **Current implementation already correct** (src/platform/auth/session/useSessionCookie.ts):
   - Backend sets httpOnly session cookie
   - Cookie is per-origin (shared across tabs)
   - Backend handles workspace authorization server-side

**Architecture Clarification**:

```
┌─────────────────┬─────────────────┐
│   Tab A         │   Tab B         │
│ Workspace: ws_1 │ Workspace: ws_2 │
│ Token: jwt_A    │ Token: jwt_B    │  ← Per-tab (sessionStorage/memory)
└─────────────────┴─────────────────┘
         │              │
         └──────┬───────┘
                │
        Shared Cookie (session)          ← Shared across tabs
                │
         ┌──────▼───────┐
         │   Backend    │
         │ Checks: User │
         │ authorized   │
         │ for asset in │
         │ ANY workspace│
         └──────────────┘
```

**For asset auth** (/view endpoints):

- Cookie authenticates USER (not workspace)
- Backend logic: "Does this user have access to asset in any of their workspaces?"
- No frontend changes needed

**For API calls**:

- Use Bearer token in Authorization header (workspace-specific JWT)
- Per-tab via sessionStorage + in-memory refs

**Verdict**: No new cookie mechanism needed. Use existing session cookies + sessionStorage for workspace context.

---

## Revised Risk Assessment

| Risk                       | Severity       | Mitigation                                                      |
| -------------------------- | -------------- | --------------------------------------------------------------- |
| "Always logged in" breaks  | ❌ **None**    | Keep Firebase in localStorage, only workspace in sessionStorage |
| SessionStorage compat      | 🟡 **Low**     | 97%+ support, fallback for private mode                         |
| Per-tab cookies needed     | ❌ **None**    | Not required - use sessionStorage for per-tab state             |
| User confusion (multi-tab) | 🟡 **Low-Med** | Clear UI indicators for current workspace                       |
| Token refresh complexity   | 🟡 **Low-Med** | Need to handle workspace token refresh flow                     |
| **API Key fallback auth**  | 🔴 **High**    | **API keys don't support per-tab workspaces** (see below)       |

---

## ⚠️ CRITICAL: API Key Auth Fallback Path

### Current Fallback Hierarchy

```typescript
// firebaseAuthStore.ts:163-173
getAuthHeader():
  1. Firebase token (localStorage) → Bearer
  2. API Key (localStorage) → X-API-KEY  // ← Problem
```

### The Problem

**API Key auth uses localStorage (apiKeyAuthStore.ts:19):**

```typescript
const apiKey = useLocalStorage<string | null>(STORAGE_KEY, null)
```

**Implications:**

- API keys are **shared across all tabs** (localStorage)
- API keys are **static strings** with no workspace metadata
- **Cannot achieve per-tab workspace isolation** with API key auth

### Scenario Analysis

#### Scenario 1: API Key User Opens Multiple Tabs

```
Tab A                           Tab B
┌─────────────────┐            ┌─────────────────┐
│ API Key: xyz123 │            │ API Key: xyz123 │  ← Same key (localStorage)
│ Workspace: ???  │            │ Workspace: ???  │  ← No workspace context
└─────────────────┘            └─────────────────┘
```

**Question:** Which workspace should API key requests target?

#### Scenario 2: Mixed Auth (Firebase in Tab A, API Key in Tab B)

```
Tab A (Firebase)                Tab B (API Key)
┌─────────────────┐            ┌─────────────────┐
│ User: alice     │            │ API Key: xyz123 │
│ Workspace: ws_1 │            │ Workspace: ???  │  ← No isolation
└─────────────────┘            └─────────────────┘
```

### Recommended Solutions

#### **Option A: API Keys = Personal Workspace Only** ⭐ (Recommended)

**Approach:** API key users can only access their personal workspace (no multi-workspace support).

**Implementation:**

```typescript
const getAuthHeader = async (): Promise<AuthHeader | null> => {
  // 1. Workspace token (per-tab, Firebase users only)
  const workspaceAuth = useWorkspaceAuth()
  if (workspaceAuth.workspaceToken.value) {
    return { Authorization: `Bearer ${workspaceAuth.workspaceToken.value}` }
  }

  // 2. Firebase token (fallback to personal workspace)
  const firebaseToken = await getIdToken()
  if (firebaseToken) {
    return { Authorization: `Bearer ${firebaseToken}` }
  }

  // 3. API Key (always personal workspace, no per-tab support)
  return useApiKeyAuthStore().getAuthHeader()
}
```

**Backend behavior:**

- `X-API-KEY` header → Always routes to user's personal workspace
- No workspace switching allowed for API key auth

**Trade-offs:**

- ✅ Simple to implement
- ✅ Clear limitation for API key users
- ❌ API key users miss out on workspace features

---

#### **Option B: Workspace-Scoped API Keys**

**Approach:** Generate separate API keys per workspace.

**Implementation:**

```
Personal workspace: comfy_personal_abc123xyz
Team workspace A:   comfy_ws_team_a_def456uvw
Team workspace B:   comfy_ws_team_b_ghi789rst
```

**Backend changes:**

- Parse workspace ID from API key prefix
- Store workspace association in API key metadata

**Trade-offs:**

- ✅ Enables per-tab workspaces for API key users
- ❌ Complex key management (users must switch keys manually)
- ❌ More backend work
- ❌ Security concern (multiple keys to manage)

---

#### **Option C: Force Firebase Auth for Workspaces** ⭐ (Recommended)

**Approach:** Multi-workspace features require Firebase auth. API keys remain for single-workspace/automation use cases.

**Implementation:**

```typescript
// When switching workspaces
const switchWorkspace = async (workspaceId: string) => {
  const apiKeyStore = useApiKeyAuthStore()

  if (apiKeyStore.isAuthenticated) {
    // Block workspace switching for API key users
    const shouldUpgrade = await showConfirmDialog({
      title: 'Sign In Required',
      message: 'Multi-workspace access requires signing in with your account.',
      confirmText: 'Sign In',
      cancelText: 'Cancel'
    })

    if (shouldUpgrade) {
      router.push('/signin?redirect=/workspaces')
    }
    return
  }

  // Normal workspace switching for Firebase users
  await workspaceAuth.switchWorkspace(workspaceId)
}
```

**Trade-offs:**

- ✅ Clear user education (API keys = automation, Firebase = full features)
- ✅ Simpler mental model
- ✅ Better security (API keys for CI/CD, not interactive use)
- ❌ API key users must upgrade for workspace features

---

### Recommended Approach

**Combine Option A + Option C:**

1. **API Key Auth** → Personal workspace only (backend enforced)
2. **Workspace Switching UI** → Hidden/disabled for API key users
3. **Upgrade Prompt** → Show banner: "Sign in to access team workspaces"

**Benefits:**

- ✅ No breaking changes for existing API key users
- ✅ Clear feature differentiation
- ✅ Simple implementation
- ✅ Maintains per-tab isolation for Firebase users

**Drawbacks:**

- ❌ API key users can't use workspace features (acceptable trade-off for automation use case)

---

## Recommended Implementation

### Phase 1: Workspace Context (No Firebase Changes)

1. Keep Firebase auth as-is (localStorage)
2. Create `useWorkspaceAuth()` composable:
   - sessionStorage: workspace ID (survives refresh)
   - Ref (in-memory): workspace access token
3. Update `getAuthHeader()` to prioritize workspace token

### Phase 2: Backend Integration

1. `POST /api/auth/token` - Exchange Firebase token for workspace JWT
2. Backend signs JWT with workspace claims: `{ workspaceId, role }`
3. Session cookie logic unchanged (already correct)

### Phase 3: UI/UX

1. Workspace selector UI
2. Visual indicator of current workspace
3. Handle workspace switching (semantic re-auth)

---

## Sources

- [Manage User Sessions | Firebase Authentication](https://firebase.google.com/docs/auth/admin/manage-sessions)
- [SessionStorage Browser Compatibility | Can I use](https://caniuse.com/mdn-api_window_sessionstorage)
- [Storage Quotas and Browser Compatibility](https://app.studyraid.com/en/read/12382/399839/storage-size-limitations-and-browser-compatibility)
- [iOS Safari SessionStorage in Private Mode](https://developer.apple.com/forums/thread/652815)
- [Session Cookies Shared Between Tabs](https://www.quora.com/Are-session-cookies-shared-between-tabs-within-the-browser)
- [Firefox Bug: Per-Tab Cookie Scoping](https://bugzilla.mozilla.org/show_bug.cgi?id=117222)
- [Using HTTP Cookies | MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)

---

## Key Corrections to Original Assessment

1. ✅ Firebase refresh tokens persist indefinitely (not 30 days)
2. ✅ Can maintain "always logged in" with hybrid storage approach
3. ✅ SessionStorage is production-ready (97%+ compat, only private mode edge case)
4. ✅ Don't need per-tab cookies - use sessionStorage for workspace context
5. ✅ Existing cookie implementation already handles asset auth correctly

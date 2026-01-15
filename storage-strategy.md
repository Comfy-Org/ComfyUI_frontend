# Storage Strategy for Workspace Auth

**Purpose**: Define where different auth/state data should be stored for proper per-tab workspace isolation.

---

## Storage Locations

### 📦 localStorage (Shared Across Tabs, Persistent)

Data stored in `localStorage` is:

- ✅ **Shared across all tabs** on same origin
- ✅ **Persists after browser close/restart**
- ✅ **Available immediately on page load**

**What to Store:**

| Data Type               | Example Key                    | Purpose                                         |
| ----------------------- | ------------------------------ | ----------------------------------------------- |
| ✅ Firebase auth tokens | `firebase:authUser`            | User authentication (managed by Firebase SDK)   |
| ✅ User preferences     | `Comfy.MenuPosition`           | Theme, UI layout, personal settings             |
| ✅ Global app state     | `Comfy.ConflictModalDismissed` | User-level flags, acknowledgments               |
| ✅ API keys (fallback)  | `comfy_api_key`                | Automation/CI-CD auth (personal workspace only) |

**What NOT to Store:**

| Data Type                   | Why Not                          | Use Instead                     |
| --------------------------- | -------------------------------- | ------------------------------- |
| ❌ Workspace context        | Breaks per-tab isolation         | sessionStorage                  |
| ❌ Workspace tokens         | Security risk (long-lived)       | sessionStorage cache + memory   |
| ❌ Workspace refresh tokens | Security risk + breaks isolation | Don't issue them (use Firebase) |

---

### 🗂️ sessionStorage (Per-Tab, Lost on Tab Close)

Data stored in `sessionStorage` is:

- ✅ **Isolated per browser tab**
- ✅ **Persists across page refresh** (in same tab)
- ❌ **Lost when tab closes**

**What to Store:**

| Data Type                 | Key                         | Purpose                                 | TTL             |
| ------------------------- | --------------------------- | --------------------------------------- | --------------- |
| ✅ Current workspace ID   | `Comfy.Workspace.Current`   | Which workspace this tab is viewing     | Until tab close |
| ✅ Workspace access token | `Comfy.Workspace.Token`     | Cached JWT for API calls (optimization) | 1 hour          |
| ✅ Token expiry timestamp | `Comfy.Workspace.ExpiresAt` | When to refresh token                   | 1 hour          |
| ✅ ClientId               | `clientId`                  | Tab identifier for WebSocket            | Until tab close |
| ✅ Preserved query params | `Comfy.PreservedQuery.*`    | Navigation state                        | Until tab close |

**What NOT to Store:**

| Data Type                   | Why Not                       | Use Instead             |
| --------------------------- | ----------------------------- | ----------------------- |
| ❌ Workspace refresh tokens | Security risk (XSS can steal) | Don't issue them        |
| ❌ User authentication      | Would force re-login per tab  | localStorage (Firebase) |
| ❌ User preferences         | Would be lost on tab close    | localStorage            |

---

### 💾 In-Memory Refs (Per-Tab, Lost on Page Refresh)

Data stored in Vue `ref()` is:

- ✅ **Isolated per browser tab**
- ❌ **Lost on page refresh**
- ❌ **Not persisted anywhere**

**What to Store:**

| Data Type                 | Purpose                             | Why Not Persist                    |
| ------------------------- | ----------------------------------- | ---------------------------------- |
| ✅ Decoded token claims   | Avoid re-parsing JWT                | Can re-decode from cached token    |
| ✅ Ephemeral UI state     | Open/closed panels, scroll position | User expects fresh state on reload |
| ✅ In-progress operations | Loading states, pending requests    | Should reset on page load          |
| ✅ WebSocket connection   | Real-time connection object         | Must reconnect on page load anyway |

---

## Decision Matrix

**When deciding where to store data, ask:**

```
Is it user-level or workspace-level?
├─ User-level (theme, preferences)
│  └─> localStorage (shared, persistent)
│
└─ Workspace-level (workspace context, tokens)
   └─> Is it per-tab or shared?
      ├─ Per-tab (current workspace)
      │  └─> sessionStorage (per-tab, survives refresh)
      │
      └─ Shared (shouldn't exist - defeats per-tab isolation)
```

**For tokens specifically:**

```
Is it a credential or an access token?
├─ Credential (Firebase refresh token)
│  └─> localStorage (Firebase SDK manages it)
│
└─ Access token (workspace JWT)
   └─> Is it long-lived or short-lived?
      ├─ Long-lived (30 days)
      │  └─> ❌ DON'T ISSUE (security risk)
      │
      └─ Short-lived (1 hour)
         └─> sessionStorage cache (optimization) + memory
```

---

## Example: Workspace Token Lifecycle

### Initial Tab Open

```typescript
// 1. Check URL for workspace
const urlWorkspace = new URLSearchParams(location.search).get('workspace')
if (urlWorkspace) {
  await switchWorkspace(urlWorkspace) // Sets sessionStorage
  return
}

// 2. Check sessionStorage (e.g., after page refresh in same tab)
const sessionWorkspace = sessionStorage.getItem('Comfy.Workspace.Current')
if (sessionWorkspace) {
  // Check if cached token still valid
  const cachedToken = sessionStorage.getItem('Comfy.Workspace.Token')
  const expiresAt = sessionStorage.getItem('Comfy.Workspace.ExpiresAt')

  if (cachedToken && Date.now() < parseInt(expiresAt) - 5 * 60 * 1000) {
    // Token still valid, reuse it
    workspaceToken.value = cachedToken
    return
  }

  // Token expired, get fresh one
  await switchWorkspace(sessionWorkspace)
  return
}

// 3. No workspace context - show selector or default
await showWorkspaceSelector()
```

### Switch Workspace

```typescript
const switchWorkspace = async (workspaceId: string) => {
  // Get Firebase token (from localStorage via Firebase SDK)
  const firebaseToken = await useFirebaseAuthStore().getIdToken()

  // Exchange for workspace token
  const response = await fetch('/api/auth/token', {
    method: 'POST',
    headers: { Authorization: `Bearer ${firebaseToken}` },
    body: JSON.stringify({ workspaceId })
  })

  const { accessToken, expiresIn } = await response.json()
  const expiresAt = Date.now() + expiresIn * 1000

  // Store in memory (primary)
  workspaceToken.value = accessToken
  currentWorkspaceId.value = workspaceId

  // Cache in sessionStorage (optimization for page refresh)
  sessionStorage.setItem('Comfy.Workspace.Current', workspaceId)
  sessionStorage.setItem('Comfy.Workspace.Token', accessToken)
  sessionStorage.setItem('Comfy.Workspace.ExpiresAt', expiresAt.toString())
}
```

### Page Refresh (F5)

```
Before refresh:
- sessionStorage: { 'Comfy.Workspace.Current': 'ws_123', 'Comfy.Workspace.Token': 'jwt...' }
- memory: { workspaceToken: 'jwt...', currentWorkspaceId: 'ws_123' }

After refresh:
- sessionStorage: Still there (persists in same tab)
- memory: Cleared (refs lost)

On mount:
1. Read from sessionStorage
2. Check token expiry
3. If valid: Reuse cached token
4. If expired: Get fresh token with Firebase auth
5. User stays in same workspace (seamless)
```

### Tab Close

```
User closes tab:
- sessionStorage: Cleared (tab session ended)
- memory: Cleared (tab closed)

User opens new tab:
- sessionStorage: Empty
- No workspace context
- Shows workspace selector OR loads default/personal
- User explicitly chooses workspace (fresh start)
```

---

## Security Considerations

### Why Not Store Workspace Refresh Tokens?

**If we stored workspace refresh tokens in sessionStorage:**

```typescript
// BAD - Don't do this
sessionStorage.setItem('workspace_refresh_token', longLivedToken)
```

**Problems:**

1. **XSS Attack Surface**:
   - Attacker injects script via XSS
   - Reads `sessionStorage.getItem('workspace_refresh_token')`
   - Can generate workspace tokens for 30 days

2. **Lost on Page Refresh** (if stored in memory):
   - User refreshes page
   - Refresh token lost
   - Must re-authenticate anyway
   - Defeats purpose of having refresh token

3. **Multi-Tab Conflicts**:
   - Tab A rotates refresh token
   - Tab B has old refresh token (invalid)
   - Tab B must fall back to Firebase token anyway

**Better: Use Firebase token as "refresh token"**

- Firebase SDK manages refresh tokens securely
- Frontend only uses short-lived tokens (1 hour max)
- Less attack surface

### XSS Mitigation

**Current approach minimizes XSS risk:**

| Token Type             | Storage                     | Lifetime   | XSS Impact                       |
| ---------------------- | --------------------------- | ---------- | -------------------------------- |
| Firebase refresh token | httpOnly cookie (Firebase)  | Indefinite | ✅ Cannot steal via XSS          |
| Firebase ID token      | localStorage (Firebase SDK) | 1 hour     | ⚠️ Can steal, but auto-refreshes |
| Workspace access token | sessionStorage (cached)     | 1 hour     | ⚠️ Can steal, short window       |

**If XSS occurs:**

- Attacker gets 1-hour window of workspace access
- Cannot generate new tokens after expiry (no refresh token)
- User password change revokes Firebase tokens

---

## Migration Checklist

When implementing workspace auth:

- [ ] **Audit existing localStorage usage**
  - Identify workspace-specific data (if any)
  - Move to sessionStorage or scope by workspaceId

- [ ] **Update storage utilities**
  - `getStorageValue()` / `setStorageValue()` already use hybrid approach
  - Verify no workspace data leaks across tabs

- [ ] **Implement workspace auth composable**
  - `useWorkspaceAuth()` with sessionStorage cache
  - Auto-refresh 5 min before token expiry
  - Handle token refresh failures gracefully

- [ ] **Test multi-tab scenarios**
  - Different workspaces in different tabs
  - Page refresh in each tab (should stay in same workspace)
  - Close and reopen tab (should prompt for workspace)

- [ ] **Add error handling**
  - sessionStorage quota exceeded (iOS private mode)
  - Token refresh failures (workspace access revoked)
  - Firebase token expired (re-login prompt)

---

## Related Documentation

- See `workspace-token-refresh-analysis.md` for token refresh strategy
- See `per-tab-auth-analysis.md` for original requirements
- See `per-tab-auth-thread-analysis.md` for implementation decisions

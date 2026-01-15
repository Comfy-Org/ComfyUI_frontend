# Workspace Authentication Implementation Guide

**Version**: 1.0
**Last Updated**: 2026-01-14
**Status**: Ready for Implementation

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Design](#architecture-design)
3. [Storage Strategy](#storage-strategy)
4. [API Specification](#api-specification)
5. [Frontend Implementation](#frontend-implementation)
6. [Error Handling](#error-handling)
7. [Security Considerations](#security-considerations)
8. [Test Plan](#test-plan)
9. [Migration Guide](#migration-guide)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### Goals

Implement per-tab workspace authentication that allows:
- Users to work in different workspaces in different browser tabs
- Seamless workspace switching without losing unsaved work
- Persistent login experience ("always logged in")
- Backward compatibility with API key authentication

### Key Requirements

1. **Per-Tab Isolation**: Each browser tab can view a different workspace
2. **Persistent Authentication**: User stays logged in across sessions
3. **Page Refresh Resilience**: Tab maintains workspace context after F5
4. **Multi-Tab Support**: Multiple tabs can be open with different workspaces
5. **Workspace Access Revocation**: Immediate effect on next token refresh
6. **API Key Fallback**: Existing API key users continue to work (personal workspace only)

### Non-Goals

- Cross-tab workspace synchronization (each tab independent)
- Workspace refresh tokens (security/complexity trade-off)
- API key users accessing multiple workspaces (require Firebase auth upgrade)

---

## Architecture Design

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     User Authentication                      │
│              (Firebase - localStorage, Persistent)           │
└─────────────────────────────────────────────────────────────┘
                              │
                    getIdToken() (always fresh)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Tab A                  │         Tab B          │
│  Workspace: team_alpha              │  Workspace: personal   │
│  ┌────────────────────────────┐    │  ┌───────────────────┐ │
│  │ sessionStorage:            │    │  │ sessionStorage:   │ │
│  │ - workspaceId: team_alpha  │    │  │ - workspaceId:    │ │
│  │ - workspaceToken: jwt_A    │    │  │     personal      │ │
│  │ - expiresAt: timestamp     │    │  │ - workspaceToken: │ │
│  └────────────────────────────┘    │  │     jwt_B         │ │
│               │                     │  └───────────────────┘ │
└───────────────┼─────────────────────┴────────────┼──────────┘
                │                                   │
                └──────────┬────────────────────────┘
                           │
                  API calls with workspace JWT
                           │
                           ▼
                  ┌──────────────────┐
                  │  Backend API     │
                  │  - Validates JWT │
                  │  - Checks role   │
                  └──────────────────┘
```

### Token Architecture

**Two-Token System:**

1. **Firebase Token** (User Authentication)
   - Stored: localStorage (managed by Firebase SDK)
   - Lifetime: 1 hour (auto-refreshes)
   - Purpose: Authenticate user identity
   - Shared: Across all tabs (persistent login)

2. **Workspace Token** (Workspace Authorization)
   - Stored: sessionStorage (cached) + memory
   - Lifetime: 1 hour
   - Purpose: Authorize workspace access
   - Isolated: Per browser tab

**Token Exchange Flow:**

```typescript
// User logged in (Firebase) → Has Firebase token in localStorage
// User switches to Workspace X in Tab A

POST /api/auth/token
Headers: { Authorization: Bearer <firebase_jwt> }
Body: { workspaceId: "ws_x" }

→ Backend validates Firebase token
→ Backend checks user membership in workspace
→ Backend issues workspace-scoped JWT

Response: {
  accessToken: <workspace_jwt>,  // Contains workspaceId, role
  expiresIn: 3600,
  workspace: { id, name, role }
}

// Tab A now has workspace token for Workspace X
// Tab B can independently get token for Workspace Y
```

### Why Firebase as Refresh Token?

**Decision**: Use Firebase token to refresh workspace tokens (no separate workspace refresh token).

**Rationale:**

1. **Simplicity**: Single endpoint for both initial and refresh
2. **Multi-Tab Support**: All tabs share Firebase auth (no token rotation conflicts)
3. **Page Refresh Resilience**: Firebase persists in localStorage
4. **Security**: Firebase SDK manages long-lived credentials securely
5. **Immediate Revocation**: Backend validates workspace membership on every refresh
6. **No Additional Complexity**: No need to store/manage/rotate workspace refresh tokens

**Trade-off**: Workspace token refresh requires Firebase token validation (adds ~50-100ms per refresh, 24x/day per user = negligible).

---

## Storage Strategy

### localStorage (Shared, Persistent)

**Characteristics:**
- Shared across all tabs on same origin
- Persists after browser close/restart
- ~5-10MB storage limit

**What to Store:**

| Data | Key | Managed By |
|------|-----|------------|
| Firebase auth tokens | `firebase:authUser` | Firebase SDK |
| User preferences | `Comfy.MenuPosition`, etc. | App |
| Global flags | `Comfy.ConflictModalDismissed` | App |
| API keys (fallback) | `comfy_api_key` | App |

**What NOT to Store:**
- ❌ Workspace context (breaks per-tab isolation)
- ❌ Workspace tokens (use sessionStorage cache)
- ❌ Workspace refresh tokens (don't issue them)

### sessionStorage (Per-Tab, Survives Page Refresh)

**Characteristics:**
- Isolated per browser tab
- Persists across page refresh in same tab
- Cleared when tab closes
- ~2.5-5MB storage limit (Safari mobile)

**What to Store:**

| Data | Key | Purpose |
|------|-----|---------|
| Current workspace ID | `Comfy.Workspace.Current` | Track which workspace tab is viewing |
| Workspace access token | `Comfy.Workspace.Token` | Cache for API calls (optimization) |
| Token expiry | `Comfy.Workspace.ExpiresAt` | Know when to refresh |
| ClientId | `clientId` | WebSocket identifier (existing) |

**What NOT to Store:**
- ❌ Workspace refresh tokens (security risk)
- ❌ User authentication (would require re-login per tab)

### In-Memory Refs (Per-Tab, Lost on Page Refresh)

**Characteristics:**
- Vue `ref()` or plain variables
- Lost on page refresh
- No persistence

**What to Store:**
- Decoded token claims (can re-decode from cache)
- Ephemeral UI state (modals, panels)
- In-progress operations (loading states)

---

## API Specification

### Endpoint: Exchange Firebase Token for Workspace Token

```
POST /api/auth/token
```

**Purpose**: Exchange Firebase JWT for workspace-scoped access token. Used for both initial token acquisition and refresh.

**Request:**

```typescript
Headers:
  Authorization: Bearer <firebase_jwt>  // Required
  Content-Type: application/json

Body:
  {
    workspaceId: string  // Required - workspace to access
  }
```

**Response (200 OK):**

```typescript
{
  accessToken: string,   // JWT signed by backend
  expiresIn: number,     // Seconds until expiry (3600 = 1 hour)
  workspace: {           // Optional metadata
    id: string,
    name: string,
    role: "owner" | "member" | "viewer"
  }
}
```

**Error Responses:**

| Status | Error | Reason |
|--------|-------|--------|
| 401 | `Invalid Firebase token` | Firebase JWT verification failed |
| 403 | `User not in workspace` | User lacks access to requested workspace |
| 404 | `Workspace not found` | WorkspaceId doesn't exist |

**Workspace JWT Claims:**

```typescript
{
  sub: string,         // User ID (from Firebase)
  workspaceId: string, // Workspace being accessed
  role: string,        // User's role in workspace
  iat: number,         // Issued at (Unix timestamp)
  exp: number          // Expires at (iat + 3600)
}
```

**Backend Implementation Notes:**

1. Verify Firebase token signature (call Firebase API or cache public keys)
2. Query database for workspace membership: `SELECT role FROM workspace_members WHERE user_id = ? AND workspace_id = ?`
3. If not found, return 403
4. Sign JWT with backend secret (NOT Firebase secret)
5. Return workspace token + metadata

**Token TTL: 1 hour (3600 seconds)**

- Standard OAuth2 practice
- Aligns with Firebase ID token lifetime
- Frontend auto-refreshes 5 minutes before expiry
- 24 refreshes/day per user (not a performance concern)

---

## Frontend Implementation

### Step 1: Create Workspace Auth Composable

**File**: `src/platform/auth/workspace/useWorkspaceAuth.ts`

```typescript
import { ref, onMounted, onUnmounted, watchEffect } from 'vue'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

interface WorkspaceMetadata {
  id: string
  name: string
  role: 'owner' | 'member' | 'viewer'
}

const TOKEN_REFRESH_BUFFER = 5 * 60 * 1000 // 5 minutes

export const useWorkspaceAuth = () => {
  // In-memory state
  const workspaceToken = ref<string | null>(null)
  const tokenExpiresAt = ref<number | null>(null)
  const currentWorkspace = ref<WorkspaceMetadata | null>(null)

  // Session storage keys
  const STORAGE_KEYS = {
    WORKSPACE_ID: 'Comfy.Workspace.Current',
    TOKEN: 'Comfy.Workspace.Token',
    EXPIRES_AT: 'Comfy.Workspace.ExpiresAt'
  }

  /**
   * Exchange Firebase token for workspace token
   */
  const switchWorkspace = async (workspaceId: string): Promise<void> => {
    const firebaseAuth = useFirebaseAuthStore()
    const firebaseToken = await firebaseAuth.getIdToken()

    if (!firebaseToken) {
      throw new Error('User not authenticated')
    }

    const response = await fetch('/api/auth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firebaseToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ workspaceId })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      if (response.status === 403) {
        throw new Error('You do not have access to this workspace')
      }
      throw new Error(error.message || 'Failed to switch workspace')
    }

    const { accessToken, expiresIn, workspace } = await response.json()
    const expiresAt = Date.now() + (expiresIn * 1000)

    // Update in-memory state
    workspaceToken.value = accessToken
    tokenExpiresAt.value = expiresAt
    currentWorkspace.value = workspace

    // Cache in sessionStorage (optimization for page refresh)
    try {
      sessionStorage.setItem(STORAGE_KEYS.WORKSPACE_ID, workspaceId)
      sessionStorage.setItem(STORAGE_KEYS.TOKEN, accessToken)
      sessionStorage.setItem(STORAGE_KEYS.EXPIRES_AT, expiresAt.toString())
    } catch (error) {
      // sessionStorage quota exceeded (iOS private mode) - continue with in-memory only
      console.warn('Failed to cache workspace token in sessionStorage:', error)
    }
  }

  /**
   * Refresh workspace token using current workspace ID
   */
  const refreshWorkspaceToken = async (): Promise<void> => {
    const workspaceId = currentWorkspace.value?.id ||
                        sessionStorage.getItem(STORAGE_KEYS.WORKSPACE_ID)

    if (!workspaceId) {
      throw new Error('No workspace context to refresh')
    }

    // Re-exchange Firebase token for fresh workspace token
    await switchWorkspace(workspaceId)
  }

  /**
   * Get current workspace token for API calls
   */
  const getWorkspaceToken = (): string | null => {
    return workspaceToken.value
  }

  /**
   * Clear workspace context (logout from workspace)
   */
  const clearWorkspace = (): void => {
    workspaceToken.value = null
    tokenExpiresAt.value = null
    currentWorkspace.value = null

    try {
      sessionStorage.removeItem(STORAGE_KEYS.WORKSPACE_ID)
      sessionStorage.removeItem(STORAGE_KEYS.TOKEN)
      sessionStorage.removeItem(STORAGE_KEYS.EXPIRES_AT)
    } catch (error) {
      // Ignore errors
    }
  }

  /**
   * Restore workspace context from sessionStorage (on page load)
   */
  const restoreFromCache = async (): Promise<boolean> => {
    try {
      const cachedToken = sessionStorage.getItem(STORAGE_KEYS.TOKEN)
      const expiresAtStr = sessionStorage.getItem(STORAGE_KEYS.EXPIRES_AT)
      const workspaceId = sessionStorage.getItem(STORAGE_KEYS.WORKSPACE_ID)

      if (!cachedToken || !expiresAtStr || !workspaceId) {
        return false
      }

      const expiresAt = parseInt(expiresAtStr, 10)
      const now = Date.now()

      // Check if token still valid (with 5 min buffer)
      if (now < expiresAt - TOKEN_REFRESH_BUFFER) {
        // Token still valid, restore from cache
        workspaceToken.value = cachedToken
        tokenExpiresAt.value = expiresAt
        // Note: We don't have cached workspace metadata, will need to decode JWT or fetch
        return true
      }

      // Token expired or about to expire, need to refresh
      await switchWorkspace(workspaceId)
      return true
    } catch (error) {
      console.warn('Failed to restore workspace from cache:', error)
      return false
    }
  }

  /**
   * Initialize workspace context on mount
   */
  onMounted(async () => {
    // Priority 1: Check URL for workspace parameter
    const urlParams = new URLSearchParams(window.location.search)
    const urlWorkspace = urlParams.get('workspace')
    if (urlWorkspace) {
      await switchWorkspace(urlWorkspace)
      return
    }

    // Priority 2: Restore from sessionStorage cache
    const restored = await restoreFromCache()
    if (restored) {
      return
    }

    // Priority 3: No workspace context - show selector or load default
    // (Let parent component handle this)
  })

  /**
   * Auto-refresh token 5 minutes before expiry
   */
  watchEffect(() => {
    if (!tokenExpiresAt.value) return

    const refreshAt = tokenExpiresAt.value - TOKEN_REFRESH_BUFFER
    const delay = refreshAt - Date.now()

    if (delay <= 0) {
      // Token already expired or should refresh now
      void refreshWorkspaceToken()
      return
    }

    const timerId = setTimeout(() => {
      void refreshWorkspaceToken().catch((error) => {
        console.error('Failed to auto-refresh workspace token:', error)
        // Could emit event or show notification here
      })
    }, delay)

    // Cleanup on unmount or when token changes
    onUnmounted(() => clearTimeout(timerId))
  })

  return {
    // State
    workspaceToken,
    currentWorkspace,
    tokenExpiresAt,

    // Actions
    switchWorkspace,
    refreshWorkspaceToken,
    getWorkspaceToken,
    clearWorkspace
  }
}
```

### Step 2: Update Firebase Auth Store

**File**: `src/stores/firebaseAuthStore.ts`

Update `getAuthHeader()` to prioritize workspace token:

```typescript
// Add near top of file
import { useWorkspaceAuth } from '@/platform/auth/workspace/useWorkspaceAuth'

// Update getAuthHeader() method around line 163
const getAuthHeader = async (): Promise<AuthHeader | null> => {
  // Priority 1: Workspace token (if in workspace context)
  try {
    const workspaceAuth = useWorkspaceAuth()
    const workspaceToken = workspaceAuth.getWorkspaceToken()
    if (workspaceToken) {
      return {
        Authorization: `Bearer ${workspaceToken}`
      }
    }
  } catch (error) {
    // Workspace auth not initialized, fall through to Firebase token
  }

  // Priority 2: Firebase token (personal workspace or no workspace context)
  const firebaseToken = await getIdToken()
  if (firebaseToken) {
    return {
      Authorization: `Bearer ${firebaseToken}`
    }
  }

  // Priority 3: API key (legacy fallback)
  return useApiKeyAuthStore().getAuthHeader()
}
```

### Step 3: Create Workspace Selector Component

**File**: `src/components/workspace/WorkspaceSelector.vue`

```vue
<template>
  <Dialog v-model:visible="visible" header="Select Workspace" :modal="true">
    <div class="workspace-list">
      <div
        v-for="workspace in workspaces"
        :key="workspace.id"
        class="workspace-item"
        @click="selectWorkspace(workspace.id)"
      >
        <div class="workspace-name">{{ workspace.name }}</div>
        <div class="workspace-role">{{ workspace.role }}</div>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Dialog from 'primevue/dialog'
import { useWorkspaceAuth } from '@/platform/auth/workspace/useWorkspaceAuth'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

const visible = ref(true)
const workspaces = ref<Array<{ id: string; name: string; role: string }>>([])
const workspaceAuth = useWorkspaceAuth()

onMounted(async () => {
  // Fetch user's workspaces
  const firebaseAuth = useFirebaseAuthStore()
  const token = await firebaseAuth.getIdToken()

  const response = await fetch('/api/workspaces', {
    headers: { Authorization: `Bearer ${token}` }
  })

  const data = await response.json()
  workspaces.value = data.workspaces
})

const selectWorkspace = async (workspaceId: string) => {
  await workspaceAuth.switchWorkspace(workspaceId)
  visible.value = false

  // Reload app with workspace context
  window.location.href = `/?workspace=${workspaceId}`
}
</script>

<style scoped>
.workspace-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.workspace-item {
  padding: 1rem;
  border: 1px solid var(--surface-border);
  border-radius: 4px;
  cursor: pointer;
}

.workspace-item:hover {
  background: var(--surface-hover);
}

.workspace-name {
  font-weight: 600;
}

.workspace-role {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}
</style>
```

### Step 4: Add Workspace Switcher to Topbar

**File**: `src/components/topbar/WorkspaceSwitcher.vue`

```vue
<template>
  <Button
    v-if="currentWorkspace"
    :label="currentWorkspace.name"
    icon="pi pi-briefcase"
    @click="showSelector = true"
  />

  <WorkspaceSelector v-if="showSelector" @close="showSelector = false" />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Button from 'primevue/button'
import { useWorkspaceAuth } from '@/platform/auth/workspace/useWorkspaceAuth'
import WorkspaceSelector from './WorkspaceSelector.vue'

const workspaceAuth = useWorkspaceAuth()
const showSelector = ref(false)

const currentWorkspace = computed(() => workspaceAuth.currentWorkspace.value)
</script>
```

Integrate into topbar (e.g., `src/components/topbar/ComfyTopbar.vue`):

```vue
<template>
  <div class="topbar">
    <!-- Existing topbar content -->
    <WorkspaceSwitcher />
    <CurrentUserButton />
  </div>
</template>
```

### Step 5: Handle Workspace Switching with Unsaved Changes

**File**: `src/composables/useWorkspaceSwitch.ts`

```typescript
import { useWorkspaceAuth } from '@/platform/auth/workspace/useWorkspaceAuth'
import { useWorkflowStore } from '@/stores/workflowStore'
import { useDialogService } from '@/services/dialogService'

export const useWorkspaceSwitch = () => {
  const workspaceAuth = useWorkspaceAuth()
  const workflowStore = useWorkflowStore()
  const dialogService = useDialogService()

  const switchWorkspace = async (workspaceId: string): Promise<void> => {
    // Check for unsaved changes
    if (workflowStore.hasUnsavedChanges()) {
      const action = await dialogService.showConfirmDialog({
        title: 'Save Changes?',
        message: 'You have unsaved changes. What would you like to do?',
        options: [
          { label: 'Save & Switch', value: 'save' },
          { label: 'Discard & Switch', value: 'discard' },
          { label: 'Cancel', value: 'cancel' }
        ]
      })

      if (action === 'cancel') {
        return
      }

      if (action === 'save') {
        await workflowStore.save()
      }
    }

    // Full page reload with workspace context
    window.location.href = `/?workspace=${workspaceId}`
  }

  return { switchWorkspace }
}
```

Update `WorkspaceSelector` to use this:

```typescript
import { useWorkspaceSwitch } from '@/composables/useWorkspaceSwitch'

const { switchWorkspace } = useWorkspaceSwitch()

const selectWorkspace = async (workspaceId: string) => {
  await switchWorkspace(workspaceId)
  visible.value = false
}
```

---

## Error Handling

### Token Refresh Failures

**Scenario**: Workspace token refresh fails (user removed from workspace, token expired, etc.)

**Implementation**:

```typescript
// In useWorkspaceAuth.ts
const refreshWorkspaceToken = async (): Promise<void> => {
  try {
    const workspaceId = currentWorkspace.value?.id ||
                        sessionStorage.getItem(STORAGE_KEYS.WORKSPACE_ID)

    if (!workspaceId) {
      throw new Error('No workspace context to refresh')
    }

    await switchWorkspace(workspaceId)
  } catch (error) {
    console.error('Workspace token refresh failed:', error)

    // Clear workspace context
    clearWorkspace()

    // Notify user
    useToastStore().add({
      severity: 'error',
      summary: 'Workspace Access Lost',
      detail: 'You no longer have access to this workspace. Please select another workspace.',
      life: 5000
    })

    // Redirect to workspace selector
    // (Or let parent component handle via event)
    throw error
  }
}
```

### SessionStorage Quota Exceeded

**Scenario**: iOS Safari private mode blocks sessionStorage writes

**Implementation**:

```typescript
// Wrapper function for sessionStorage operations
function safeSessionStorage(operation: () => void): void {
  try {
    operation()
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('sessionStorage quota exceeded, using in-memory fallback')
      // Continue with in-memory state only
      // App still works, just loses persistence across page refresh
    } else {
      throw error
    }
  }
}

// Usage
safeSessionStorage(() => {
  sessionStorage.setItem(STORAGE_KEYS.TOKEN, accessToken)
})
```

### Firebase Token Unavailable

**Scenario**: Firebase auto-refresh fails (rare edge case)

**Implementation**:

```typescript
const switchWorkspace = async (workspaceId: string): Promise<void> => {
  const firebaseAuth = useFirebaseAuthStore()
  const firebaseToken = await firebaseAuth.getIdToken()

  if (!firebaseToken) {
    // Firebase token unavailable - force re-login
    useToastStore().add({
      severity: 'warn',
      summary: 'Session Expired',
      detail: 'Please sign in again to continue.',
      life: 5000
    })

    await firebaseAuth.logout()
    router.push('/signin')
    return
  }

  // ... continue with token exchange
}
```

### API Call Failures with Workspace Token

**Scenario**: API call fails with 401 (token expired/invalid)

**Implementation**:

```typescript
// In API client (src/scripts/api.ts or similar)
async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const authHeader = await useFirebaseAuthStore().getAuthHeader()

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...authHeader
    }
  })

  if (response.status === 401) {
    // Token expired or invalid - try to refresh
    const workspaceAuth = useWorkspaceAuth()

    try {
      await workspaceAuth.refreshWorkspaceToken()

      // Retry original request with new token
      const newAuthHeader = await useFirebaseAuthStore().getAuthHeader()
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          ...newAuthHeader
        }
      })
    } catch (error) {
      // Refresh failed - handle as workspace access lost
      console.error('Token refresh failed after 401:', error)
      throw error
    }
  }

  return response
}
```

---

## Security Considerations

### XSS Protection

**Risk**: XSS attack can steal tokens from sessionStorage or memory

**Current Mitigation**:
1. Workspace tokens are short-lived (1 hour max)
2. No long-lived refresh tokens in frontend
3. Firebase refresh tokens in httpOnly cookies (cannot be stolen via XSS)
4. Token theft gives attacker 1-hour window (better than 30-day refresh token)

**Additional Mitigations**:
- Enable Content Security Policy (CSP) headers
- Sanitize all user-generated content with DOMPurify
- Regular security audits for XSS vulnerabilities

### Token Storage Best Practices

| Token Type | Storage Location | Rationale |
|------------|------------------|-----------|
| Firebase refresh token | httpOnly cookie (Firebase manages) | Cannot be accessed by JavaScript |
| Firebase ID token | localStorage (Firebase SDK) | Needed for getIdToken() calls, short-lived |
| Workspace token | sessionStorage (cached) + memory | Per-tab isolation, survives page refresh, short-lived |

**Why NOT httpOnly cookies for workspace tokens?**
- Need to send different tokens per tab (cookies are shared across tabs)
- Would require per-tab cookie names (complex, non-standard)
- sessionStorage provides natural per-tab isolation

### Workspace Access Revocation

**Scenario**: Admin removes user from workspace while user is active

**How It Works**:
1. User's workspace token expires (max 1 hour)
2. Frontend attempts auto-refresh: `POST /api/auth/token`
3. Backend checks membership: `SELECT ... WHERE user_id = ? AND workspace_id = ?`
4. No membership found → Backend returns 403
5. Frontend clears workspace context and shows error

**Revocation Latency**: Maximum 1 hour (token TTL)

**Immediate Revocation** (if needed in future):
- Backend maintains list of revoked workspace tokens (Redis)
- Validate against revocation list on every API call
- Trade-off: Performance overhead vs. immediate revocation

---

## Test Plan

### Unit Tests

**File**: `src/platform/auth/workspace/useWorkspaceAuth.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useWorkspaceAuth } from './useWorkspaceAuth'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

vi.mock('@/stores/firebaseAuthStore')

describe('useWorkspaceAuth', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  it('should switch workspace successfully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        accessToken: 'mock-token',
        expiresIn: 3600,
        workspace: { id: 'ws_1', name: 'Test Workspace', role: 'owner' }
      })
    })
    global.fetch = mockFetch

    vi.mocked(useFirebaseAuthStore).mockReturnValue({
      getIdToken: vi.fn().mockResolvedValue('firebase-token')
    } as any)

    const { switchWorkspace, currentWorkspace } = useWorkspaceAuth()
    await switchWorkspace('ws_1')

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/token', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer firebase-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ workspaceId: 'ws_1' })
    })

    expect(currentWorkspace.value).toEqual({
      id: 'ws_1',
      name: 'Test Workspace',
      role: 'owner'
    })
  })

  it('should restore workspace from sessionStorage cache', async () => {
    const futureTime = Date.now() + (3600 * 1000) // 1 hour from now
    sessionStorage.setItem('Comfy.Workspace.Current', 'ws_1')
    sessionStorage.setItem('Comfy.Workspace.Token', 'cached-token')
    sessionStorage.setItem('Comfy.Workspace.ExpiresAt', futureTime.toString())

    const { getWorkspaceToken } = useWorkspaceAuth()

    // Trigger restore (simulate component mount)
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(getWorkspaceToken()).toBe('cached-token')
  })

  it('should handle 403 error when user lacks workspace access', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ message: 'Forbidden' })
    })
    global.fetch = mockFetch

    vi.mocked(useFirebaseAuthStore).mockReturnValue({
      getIdToken: vi.fn().mockResolvedValue('firebase-token')
    } as any)

    const { switchWorkspace } = useWorkspaceAuth()

    await expect(switchWorkspace('ws_forbidden')).rejects.toThrow(
      'You do not have access to this workspace'
    )
  })

  it('should auto-refresh token before expiry', async () => {
    vi.useFakeTimers()

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        accessToken: 'refreshed-token',
        expiresIn: 3600,
        workspace: { id: 'ws_1', name: 'Test', role: 'owner' }
      })
    })
    global.fetch = mockFetch

    vi.mocked(useFirebaseAuthStore).mockReturnValue({
      getIdToken: vi.fn().mockResolvedValue('firebase-token')
    } as any)

    const { switchWorkspace, getWorkspaceToken } = useWorkspaceAuth()
    await switchWorkspace('ws_1')

    expect(getWorkspaceToken()).toBe('refreshed-token')

    // Fast-forward to 5 minutes before expiry
    vi.advanceTimersByTime((3600 - 5 * 60) * 1000)

    // Should have triggered refresh
    await vi.runAllTimersAsync()

    expect(mockFetch).toHaveBeenCalledTimes(2) // Initial + refresh

    vi.useRealTimers()
  })
})
```

### Integration Tests

**File**: `browser_tests/tests/workspaceAuth.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Workspace Authentication', () => {
  test('should switch between workspaces in different tabs', async ({ context }) => {
    // Create two tabs
    const page1 = await context.newPage()
    const page2 = await context.newPage()

    // Login in first tab
    await page1.goto('/')
    await page1.fill('[data-testid="email"]', 'test@example.com')
    await page1.fill('[data-testid="password"]', 'password')
    await page1.click('[data-testid="login-button"]')

    // Switch to Workspace A in Tab 1
    await page1.click('[data-testid="workspace-selector"]')
    await page1.click('[data-testid="workspace-alpha"]')
    await expect(page1.locator('[data-testid="current-workspace"]')).toHaveText('Workspace Alpha')

    // Tab 2 should still require workspace selection (new tab)
    await page2.goto('/')
    await expect(page2.locator('[data-testid="workspace-selector-dialog"]')).toBeVisible()

    // Switch to Workspace B in Tab 2
    await page2.click('[data-testid="workspace-beta"]')
    await expect(page2.locator('[data-testid="current-workspace"]')).toHaveText('Workspace Beta')

    // Verify tabs are independent
    await expect(page1.locator('[data-testid="current-workspace"]')).toHaveText('Workspace Alpha')
    await expect(page2.locator('[data-testid="current-workspace"]')).toHaveText('Workspace Beta')
  })

  test('should persist workspace across page refresh', async ({ page }) => {
    await page.goto('/')
    // Login and select workspace
    await page.fill('[data-testid="email"]', 'test@example.com')
    await page.fill('[data-testid="password"]', 'password')
    await page.click('[data-testid="login-button"]')
    await page.click('[data-testid="workspace-alpha"]')

    await expect(page.locator('[data-testid="current-workspace"]')).toHaveText('Workspace Alpha')

    // Refresh page
    await page.reload()

    // Should still be in Workspace Alpha
    await expect(page.locator('[data-testid="current-workspace"]')).toHaveText('Workspace Alpha')
  })

  test('should prompt to save unsaved changes before switching workspace', async ({ page }) => {
    await page.goto('/')
    // Login and setup
    await page.fill('[data-testid="email"]', 'test@example.com')
    await page.fill('[data-testid="password"]', 'password')
    await page.click('[data-testid="login-button"]')
    await page.click('[data-testid="workspace-alpha"]')

    // Make unsaved changes
    await page.click('[data-testid="new-node-button"]')

    // Try to switch workspace
    await page.click('[data-testid="workspace-selector"]')
    await page.click('[data-testid="workspace-beta"]')

    // Should show save prompt
    await expect(page.locator('[data-testid="save-dialog"]')).toBeVisible()
    await expect(page.locator('text=You have unsaved changes')).toBeVisible()

    // Cancel switch
    await page.click('[data-testid="cancel-button"]')
    await expect(page.locator('[data-testid="current-workspace"]')).toHaveText('Workspace Alpha')
  })

  test('should handle workspace access revocation', async ({ page }) => {
    await page.goto('/')
    // Login and select workspace
    await page.fill('[data-testid="email"]', 'test@example.com')
    await page.fill('[data-testid="password"]', 'password')
    await page.click('[data-testid="login-button"]')
    await page.click('[data-testid="workspace-alpha"]')

    // Simulate backend revoking access (mock API to return 403)
    await page.route('/api/**', (route) => {
      if (route.request().url().includes('/api/auth/token')) {
        route.fulfill({
          status: 403,
          body: JSON.stringify({ message: 'Forbidden' })
        })
      } else {
        route.continue()
      }
    })

    // Wait for token to expire and auto-refresh to trigger
    await page.waitForTimeout(10000) // Wait for refresh attempt

    // Should show error and redirect to workspace selector
    await expect(page.locator('text=You no longer have access')).toBeVisible()
    await expect(page.locator('[data-testid="workspace-selector-dialog"]')).toBeVisible()
  })
})
```

### Manual Test Scenarios

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| **Basic workspace switch** | 1. Login<br>2. Select Workspace A<br>3. Click workspace switcher<br>4. Select Workspace B | Workspace switches, page reloads with Workspace B context |
| **Multi-tab isolation** | 1. Open Tab A, select Workspace X<br>2. Open Tab B, select Workspace Y<br>3. Verify both tabs | Tab A shows Workspace X, Tab B shows Workspace Y independently |
| **Page refresh persistence** | 1. Select Workspace A<br>2. Press F5<br>3. Check current workspace | Still in Workspace A after refresh |
| **Tab close clears context** | 1. Select Workspace A<br>2. Close tab<br>3. Open new tab | New tab requires workspace selection (no cached context) |
| **Unsaved changes prompt** | 1. Edit workflow (unsaved)<br>2. Try to switch workspace | Shows save prompt with options: Save & Switch, Discard & Switch, Cancel |
| **Token auto-refresh** | 1. Select workspace<br>2. Wait 56 minutes<br>3. Monitor network tab | Should see POST /api/auth/token after ~55 minutes (auto-refresh) |
| **Access revocation** | 1. Admin removes user from workspace<br>2. User waits for token expiry (~1hr)<br>3. User tries to make API call | Gets 403 error, redirected to workspace selector |
| **API key fallback** | 1. Login with API key (not Firebase)<br>2. Try to access workspace switcher | Workspace switcher disabled or shows "Sign in required for workspaces" |
| **URL workspace parameter** | 1. Visit `/?workspace=ws_123` | Automatically switches to workspace ws_123 |
| **iOS Safari private mode** | 1. Open Safari private mode<br>2. Login and select workspace<br>3. Refresh page | May lose workspace context (sessionStorage blocked), falls back to in-memory |

---

## Migration Guide

### Pre-Migration Checklist

- [ ] Backend endpoint `/api/auth/token` implemented and tested
- [ ] Backend endpoint `/api/workspaces` implemented (list user workspaces)
- [ ] Database schema includes workspace membership tables
- [ ] Firebase token verification working on backend
- [ ] Feature flag created for workspace auth (optional)

### Migration Steps

**Phase 1: Backend Setup**

1. Implement `/api/auth/token` endpoint
2. Implement `/api/workspaces` endpoint
3. Update API middleware to accept workspace JWTs
4. Test token exchange flow in Postman/curl

**Phase 2: Frontend Foundation**

1. Create `src/platform/auth/workspace/` directory
2. Implement `useWorkspaceAuth` composable
3. Add unit tests for composable
4. Update `firebaseAuthStore.getAuthHeader()` to prioritize workspace token

**Phase 3: UI Components**

1. Create `WorkspaceSelector` component
2. Create `WorkspaceSwitcher` component (topbar)
3. Add workspace indicator to UI
4. Implement unsaved changes prompt

**Phase 4: Integration**

1. Integrate `WorkspaceSwitcher` into topbar
2. Add workspace initialization to app mount
3. Test multi-tab scenarios
4. Test page refresh persistence

**Phase 5: Error Handling**

1. Add token refresh error handling
2. Add sessionStorage quota error handling
3. Add workspace access revocation handling
4. Test error scenarios

**Phase 6: Testing & QA**

1. Run unit tests
2. Run integration tests
3. Manual QA testing (see test scenarios above)
4. Cross-browser testing (Chrome, Firefox, Safari)
5. Mobile testing (iOS Safari, Chrome mobile)

**Phase 7: Rollout**

1. Deploy behind feature flag (if using)
2. Enable for internal users (dogfooding)
3. Monitor error logs and user feedback
4. Gradual rollout to all users
5. Remove feature flag after stable

### Backward Compatibility

**API Key Users:**
- Existing API key authentication continues to work
- `getAuthHeader()` falls back to API key if no Firebase/workspace token
- API key users limited to personal workspace (no workspace switcher UI)
- Show upgrade prompt: "Sign in to access team workspaces"

**Existing Firebase Users:**
- No breaking changes to authentication flow
- Workspace context optional (defaults to personal workspace)
- All existing API calls continue to work with Firebase token
- Workspace token only used when explicitly switched to a workspace

### Rollback Plan

If critical issues arise:

1. **Feature Flag Disable** (if implemented):
   - Toggle feature flag off
   - Users revert to Firebase-only auth
   - No data loss

2. **Code Rollback**:
   - Revert `getAuthHeader()` changes
   - Remove workspace UI components
   - Keep backend endpoints (no-op if not called)

3. **Database Rollback**:
   - No database changes required (workspace tables can remain)
   - No data migration needed

---

## Troubleshooting

### Issue: Token Refresh Loops

**Symptom**: Frontend repeatedly calls `/api/auth/token` in quick succession

**Causes**:
1. Token expiry check logic incorrect
2. Auto-refresh timer not cleaning up properly
3. Multiple instances of `useWorkspaceAuth()` running

**Debug**:
```typescript
// Add logging to refreshWorkspaceToken
console.log('[WorkspaceAuth] Refreshing token at', new Date().toISOString())
console.log('[WorkspaceAuth] Current token expires at', new Date(tokenExpiresAt.value).toISOString())
```

**Fix**:
- Ensure auto-refresh timer is properly cleaned up in `onUnmounted`
- Use singleton pattern for `useWorkspaceAuth` if needed
- Add debouncing to refresh calls

### Issue: Workspace Context Lost on Page Refresh

**Symptom**: User selects workspace, refreshes page, forced to select workspace again

**Causes**:
1. sessionStorage not being written
2. sessionStorage cleared by browser extension
3. iOS Safari private mode blocking sessionStorage

**Debug**:
```typescript
// Check sessionStorage after workspace switch
console.log('sessionStorage.Comfy.Workspace.Current:',
  sessionStorage.getItem('Comfy.Workspace.Current'))
```

**Fix**:
- Add error handling for sessionStorage writes (try/catch)
- Check browser extensions (disable and test)
- For iOS private mode: Add banner "Private mode detected, workspace context may not persist"

### Issue: 403 Errors After Workspace Switch

**Symptom**: API calls return 403 Forbidden after switching workspace

**Causes**:
1. Backend not accepting workspace JWT format
2. Workspace JWT missing required claims
3. User actually lacks access to workspace

**Debug**:
```typescript
// Decode and log workspace token
import { jwtDecode } from 'jwt-decode'

const token = getWorkspaceToken()
console.log('Workspace token claims:', jwtDecode(token))
```

**Backend Debug**:
```python
# Log incoming token and validation
print(f"Token: {token}")
print(f"Decoded claims: {decode_jwt(token)}")
print(f"User workspace membership: {get_membership(user_id, workspace_id)}")
```

**Fix**:
- Verify JWT signature algorithm matches (HS256, RS256, etc.)
- Ensure backend extracts `workspaceId` and `role` from JWT
- Check database for actual membership records

### Issue: Multi-Tab Token Conflicts

**Symptom**: Opening second tab breaks first tab's workspace context

**Causes**:
1. Using localStorage instead of sessionStorage
2. Tabs sharing same workspace token (shouldn't happen)
3. WebSocket connection conflicts

**Debug**:
```typescript
// Add tab identifier to logs
const tabId = Math.random().toString(36).substring(7)
console.log(`[Tab ${tabId}] Current workspace:`, currentWorkspace.value)
```

**Fix**:
- Verify using sessionStorage (not localStorage) for workspace context
- Each tab should have independent `useWorkspaceAuth()` instance
- WebSocket clientId should already be per-tab (in sessionStorage)

### Issue: Firebase Token Expired Error

**Symptom**: Cannot switch workspace, error "Invalid Firebase token"

**Causes**:
1. Firebase SDK not auto-refreshing token
2. Network issue preventing Firebase token refresh
3. User's Firebase session actually expired (rare)

**Debug**:
```typescript
const firebaseAuth = useFirebaseAuthStore()
const token = await firebaseAuth.getIdToken()
const decoded = jwtDecode(token)
console.log('Firebase token expiry:', new Date(decoded.exp * 1000))
console.log('Current time:', new Date())
```

**Fix**:
- Firebase SDK should auto-refresh - verify Firebase initialization
- Call `getIdToken(true)` to force refresh: `getIdToken(/* forceRefresh */ true)`
- As last resort, prompt user to re-login

---

## Performance Considerations

### Token Refresh Frequency

- Workspace tokens expire: 1 hour
- Auto-refresh trigger: 5 minutes before expiry (55 min mark)
- Daily refreshes per user: 24 (if user active all day)
- Network cost: ~500 bytes/refresh = 12 KB/day/user

**Not a concern** - 24 API calls/day is negligible.

### sessionStorage Size

Current usage per tab:
- Workspace ID: ~50 bytes
- Workspace JWT: ~500-1000 bytes
- Token expiry timestamp: ~15 bytes
- ClientId: ~50 bytes

**Total: ~1.5 KB per tab**

**Browser limits:**
- Desktop: 5-10 MB
- Safari Mobile: 2.5-5 MB

**Headroom: ~1,600-6,000 tabs** - Not a concern.

### Firebase Token Validation (Backend)

Backend must verify Firebase token on every workspace token exchange:

**Option 1: Call Firebase API** (simple, slower)
- Latency: ~100-200ms
- Rate limits: 10,000 verifications/day per project (low limit!)

**Option 2: Cache Firebase Public Keys** (faster, recommended)
- Latency: ~5-10ms (local JWT verification)
- Refresh public keys every 24 hours
- Standard practice, used by most Firebase integrations

**Recommendation**: Implement Option 2 (public key caching) to avoid Firebase rate limits.

---

## Future Enhancements

### Nice-to-Have Features

1. **Workspace Favorites/Recent**
   - Store recently accessed workspaces in localStorage
   - Show at top of workspace selector

2. **Workspace Notifications**
   - Show badge when user added to new workspace
   - Show notification when removed from workspace

3. **Workspace Shortcuts**
   - Keyboard shortcuts to switch workspaces (Cmd+1, Cmd+2, etc.)
   - Quick switcher (Cmd+K → type workspace name)

4. **Offline Workspace Switching**
   - Pre-fetch workspace tokens for all user's workspaces
   - Allow switching while offline (if tokens not expired)

5. **Workspace-Scoped Settings**
   - Per-workspace UI preferences
   - Per-workspace recent files/templates

6. **Telemetry**
   - Track workspace switch frequency
   - Monitor token refresh failures
   - Identify common error patterns

### Known Limitations

1. **No Cross-Tab Sync**: Tabs are independent, no state synchronization
   - If user edits workflow in Tab A, Tab B won't see changes
   - Each tab must save independently

2. **1-Hour Revocation Latency**: User removed from workspace can access for up to 1 hour
   - Mitigation: Implement token revocation list (future enhancement)

3. **API Key Users Limited**: Cannot access multiple workspaces
   - Mitigation: Prompt to upgrade to Firebase auth

4. **Full Page Reload on Switch**: Workspace switch requires full page reload
   - Mitigation: Future enhancement - selective store reset (complex)

---

## Appendix

### Related Files

**New Files** (to be created):
- `src/platform/auth/workspace/useWorkspaceAuth.ts` - Workspace auth composable
- `src/platform/auth/workspace/useWorkspaceAuth.test.ts` - Unit tests
- `src/components/workspace/WorkspaceSelector.vue` - Workspace picker
- `src/components/topbar/WorkspaceSwitcher.vue` - Topbar switcher
- `src/composables/useWorkspaceSwitch.ts` - Switch with unsaved changes handling
- `browser_tests/tests/workspaceAuth.spec.ts` - Integration tests

**Modified Files**:
- `src/stores/firebaseAuthStore.ts` - Update `getAuthHeader()` to prioritize workspace token
- `src/components/topbar/ComfyTopbar.vue` - Add `WorkspaceSwitcher`
- `src/router.ts` - Handle `?workspace=` query parameter (optional)

### Backend Endpoints Required

```
POST /api/auth/token
  - Exchange Firebase token for workspace token
  - Request: { workspaceId: string }
  - Response: { accessToken: string, expiresIn: number, workspace: {...} }

GET /api/workspaces
  - List user's workspaces
  - Headers: Authorization: Bearer <firebase_token>
  - Response: { workspaces: [{ id, name, role }, ...] }

GET /api/workspaces/:id
  - Get workspace details (optional)
  - Headers: Authorization: Bearer <workspace_token>
  - Response: { id, name, members, ... }
```

### Glossary

- **Firebase Token**: JWT issued by Firebase, authenticates user identity, 1-hour lifetime
- **Workspace Token**: JWT issued by backend, authorizes workspace access, 1-hour lifetime
- **Personal Workspace**: Default workspace for each user, fallback when no workspace selected
- **Tab Context**: Workspace currently active in a browser tab (per-tab via sessionStorage)
- **Token Refresh**: Exchange Firebase token for new workspace token before expiry
- **Token Revocation**: Backend invalidates token before natural expiry (e.g., user removed from workspace)

### Resources

- [Firebase Auth Documentation](https://firebase.google.com/docs/auth)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [sessionStorage MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage)
- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)

---

**End of Implementation Guide**

For questions or issues during implementation, refer to:
- `storage-strategy.md` - Detailed storage decision matrix
- `workspace-token-refresh-analysis.md` - Token refresh architecture analysis
- `per-tab-auth-analysis.md` - Requirements and risk analysis
- `per-tab-auth-thread-analysis.md` - Team discussion summary

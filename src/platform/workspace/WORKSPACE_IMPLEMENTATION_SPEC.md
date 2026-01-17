# Workspaces System: Complete Implementation Spec

## Overview

ComfyUI is moving from a 1:1 User↔Plan billing model to a Workspace-centric model. Users will have a personal workspace (auto-created) and can create/join shared workspaces with other users.

This document is the single source of truth for implementing the frontend workspace system. It covers the authentication flow, storage strategy, store architecture, and step-by-step implementation instructions.

---

## Part 1: Core Concepts

### Workspace Model

- **Personal Workspace**: Auto-created for every user on the backend (already backfilled). Default fallback. Cannot be deleted.
- **Shared Workspace**: User-created. Can have multiple members with roles.
- **Roles**: `owner` (full access) or `member` (limited access). Permissions-based flows planned for future.

### Storage Strategy

| Storage            | Scope        | Contents             | Lifetime        |
| ------------------ | ------------ | -------------------- | --------------- |
| **localStorage**   | Browser-wide | Firebase auth token  | Until logout    |
| **sessionStorage** | Per-tab      | Current workspace ID | Until tab close |

This enables:

- Single auth source (Firebase token in localStorage)
- Independent workspace contexts per tab

---

## Part 2: Authentication & Session Flow

### On App Boot

```
1. Check localStorage for Firebase auth token
   └─ No token? → Redirect to login

2. Fetch GET /workspaces with Bearer token
   └─ Returns array of workspaces (always includes personal)

3. Check sessionStorage for workspace ID
   └─ If exists AND user has access → use it
   └─ Otherwise → fallback to personal workspace

4. Set active workspace ID in sessionStorage

5. App ready with workspace context
```

### On Workspace Switch

```
1. Verify target workspace exists (GET /workspaces/:id)
   └─ 404/403? → Show error, refresh workspace list

2. Set new workspace ID in sessionStorage

3. Full page reload
   └─ Clears all in-memory state
   └─ App boots fresh with new workspace context
```

**Why reload?** Workspace-scoped data (assets, settings, etc.) lives in various stores. Reload guarantees clean slate. Simple > clever.

### Edge Cases

| Scenario                           | Behavior                                        |
| ---------------------------------- | ----------------------------------------------- |
| Tab refresh                        | sessionStorage persists → same workspace        |
| Tab/browser close                  | sessionStorage cleared → falls back to personal |
| Logout in any tab                  | localStorage cleared → all tabs lose auth       |
| Removed from workspace mid-session | Next API call fails → redirect to personal      |

---

## Part 3: Architecture

### Layer Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Vue Components                           │
│(WorkspaceSwitcherPopover, CRUD Dialogs, WorkspacePanelContent, etc.) │
└─────────────────────────────┬───────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────────┐
│   useWorkspaceUI()       │    │   useWorkspaceStore()        │
│   - uiConfig computed    │    │   - Pinia store              │
│   - Role-based UI flags  │    │   - State + Actions          │
└──────────────────────────┘    └──────────────┬───────────────┘
                                               │
                              ┌────────────────┴────────────────┐
                              ▼                                 ▼
               ┌──────────────────────────┐    ┌─────────────────────────────┐
               │   workspaceApi           │    │   sessionManager            │
               │   - Pure HTTP calls      │    │   - sessionStorage r/w      │
               │   - Returns promises     │    │   - Reload trigger          │
               └──────────────────────────┘    └─────────────────────────────┘
```

### File Structure

```
workspaces/
├── services/
│   ├── workspaceApi.ts          # KEEP EXISTING (but update if needed) - already good
│   └── session-manager.ts        # CREATE NEW
├── stores/
│   └── workspace-store.ts        # CREATE NEW (Pinia)
└── composables/
    └── use-workspace-ui.ts       # CREATE NEW
```

---

## Part 4: Implementation

### Step 1: Create `sessionManager.ts`

Location: `src/services/sessionManager.ts`

```typescript
// src/services/sessionManager.ts

const WORKSPACE_SESSION_KEY = 'currentWorkspaceId'

export const sessionManager = {
  /**
   * Get Firebase auth token.
   * IMPORTANT: Look at existing workspaceAuthStore.ts to see how
   * the Firebase token is currently retrieved. Match that approach here.
   * It's likely either:
   * - Direct localStorage read
   * - Firebase Auth SDK call like firebase.auth().currentUser?.getIdToken()
   */
  getFirebaseToken(): string | null {
    // TODO: Extract from existing code
    // Example: return localStorage.getItem('firebaseToken');
    throw new Error('Implement based on existing Firebase token retrieval')
  },

  getCurrentWorkspaceId(): string | null {
    return sessionStorage.getItem(WORKSPACE_SESSION_KEY)
  },

  setCurrentWorkspaceId(workspaceId: string): void {
    sessionStorage.setItem(WORKSPACE_SESSION_KEY, workspaceId)
  },

  clearCurrentWorkspaceId(): void {
    sessionStorage.removeItem(WORKSPACE_SESSION_KEY)
  },

  /**
   * THE way to switch workspaces. Sets ID and reloads.
   * Code after calling this won't execute (page is gone).
   */
  switchWorkspaceAndReload(workspaceId: string): void {
    this.setCurrentWorkspaceId(workspaceId)
    window.location.reload()
  },

  /**
   * For bailing to personal workspace (e.g., after deletion).
   */
  clearAndReload(): void {
    this.clearCurrentWorkspaceId()
    window.location.reload()
  }
}
```

---

### Step 2: Create `workspaceStore.ts`

Location: `src/stores/workspaceStore.ts`

```typescript
// src/stores/workspaceStore.ts

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { workspaceApi, ApiError } from '@/services/workspace-api'
import { sessionManager } from '@/services/session-manager'

// Import Workspace type from existing workspaceApi.ts
import type { Workspace, InviteLink } from '@/services/workspaceApi'

type InitState = 'uninitialized' | 'loading' | 'ready' | 'error'

export const useWorkspaceStore = defineStore('workspace', () => {
  // ════════════════════════════════════════════════════════════
  // STATE
  // ════════════════════════════════════════════════════════════

  const initState = ref<InitState>('uninitialized')
  const workspaces = ref<Workspace[]>([])
  const activeWorkspaceId = ref<string | null>(null)
  const error = ref<Error | null>(null)

  // Loading states for UI
  const isCreating = ref(false)
  const isDeleting = ref(false)
  const isSwitching = ref(false)

  // ════════════════════════════════════════════════════════════
  // COMPUTED
  // ════════════════════════════════════════════════════════════

  const activeWorkspace = computed(
    () => workspaces.value.find((w) => w.id === activeWorkspaceId.value) ?? null
  )

  const personalWorkspace = computed(
    () => workspaces.value.find((w) => w.isPersonal) ?? null
  )

  const isInPersonalWorkspace = computed(
    () => activeWorkspace.value?.isPersonal ?? false
  )

  const sharedWorkspaces = computed(() =>
    workspaces.value.filter((w) => !w.isPersonal)
  )

  // ════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ════════════════════════════════════════════════════════════

  /**
   * Call once on app boot.
   * Fetches workspaces, resolves active workspace.
   */
  async function initialize(): Promise<void> {
    if (initState.value !== 'uninitialized') return

    initState.value = 'loading'
    error.value = null

    try {
      // 1. Fetch all workspaces
      workspaces.value = await workspaceApi.list()

      // 2. Determine active workspace
      const sessionId = sessionManager.getCurrentWorkspaceId()
      let target: Workspace | undefined

      if (sessionId) {
        target = workspaces.value.find((w) => w.id === sessionId)
      }

      if (!target) {
        target = workspaces.value.find((w) => w.isPersonal)
      }

      if (!target) {
        throw new Error('No workspace available')
      }

      // 3. Set active
      activeWorkspaceId.value = target.id
      sessionManager.setCurrentWorkspaceId(target.id)

      initState.value = 'ready'
    } catch (e) {
      error.value = e instanceof Error ? e : new Error('Unknown error')
      initState.value = 'error'
      throw e
    }
  }

  // ════════════════════════════════════════════════════════════
  // ACTIONS
  // ════════════════════════════════════════════════════════════

  /**
   * Switch to a different workspace.
   * Verifies it exists, then reloads.
   */
  async function switchWorkspace(workspaceId: string): Promise<void> {
    if (workspaceId === activeWorkspaceId.value) return

    isSwitching.value = true

    try {
      // Verify workspace exists and user has access
      await workspaceApi.get(workspaceId)

      // Success → switch and reload
      sessionManager.switchWorkspaceAndReload(workspaceId)
      // Code after this won't run
    } catch (e) {
      isSwitching.value = false

      if (e instanceof ApiError && (e.status === 404 || e.status === 403)) {
        // Workspace gone or access revoked
        workspaces.value = await workspaceApi.list()
        throw new Error('Workspace no longer available')
      }
      throw e
    }
  }

  /**
   * Create a new workspace and switch to it.
   */
  async function createWorkspace(name: string): Promise<void> {
    isCreating.value = true

    try {
      const newWorkspace = await workspaceApi.create(name)
      sessionManager.switchWorkspaceAndReload(newWorkspace.id)
      // Code after this won't run
    } catch (e) {
      isCreating.value = false
      throw e
    }
  }

  /**
   * Delete a workspace.
   * If deleting active → switches to personal.
   */
  async function deleteWorkspace(workspaceId: string): Promise<void> {
    const workspace = workspaces.value.find((w) => w.id === workspaceId)

    if (!workspace) throw new Error('Workspace not found')
    if (workspace.isPersonal)
      throw new Error('Cannot delete personal workspace')

    isDeleting.value = true

    try {
      await workspaceApi.delete(workspaceId)

      if (workspaceId === activeWorkspaceId.value) {
        // Deleted active → go to personal
        const personal = personalWorkspace.value
        if (personal) {
          sessionManager.switchWorkspaceAndReload(personal.id)
        } else {
          sessionManager.clearAndReload()
        }
        // Code after this won't run
      } else {
        // Deleted non-active → just update local list
        workspaces.value = workspaces.value.filter((w) => w.id !== workspaceId)
        isDeleting.value = false
      }
    } catch (e) {
      isDeleting.value = false
      throw e
    }
  }

  /**
   * Rename a workspace. No reload needed.
   */
  async function renameWorkspace(
    workspaceId: string,
    newName: string
  ): Promise<void> {
    const updated = await workspaceApi.update(workspaceId, { name: newName })

    const index = workspaces.value.findIndex((w) => w.id === workspaceId)
    if (index !== -1) {
      workspaces.value[index] = updated
    }
  }

  /**
   * Create invite link for current workspace.
   */
  async function createInvite(email: string): Promise<InviteLink> {
    if (!activeWorkspaceId.value) {
      throw new Error('No active workspace')
    }
    return workspaceApi.createInvite(activeWorkspaceId.value, email)
  }

  /**
   * Accept invite. Does NOT auto-switch.
   * Returns workspace so UI can offer "View Workspace" button.
   */
  async function acceptInvite(token: string): Promise<Workspace> {
    const workspace = await workspaceApi.acceptInvite(token)

    if (!workspaces.value.find((w) => w.id === workspace.id)) {
      workspaces.value.push(workspace)
    }

    return workspace
  }

  /**
   * Leave a workspace (remove self).
   * If leaving active → switches to personal.
   */
  async function leaveWorkspace(
    workspaceId: string,
    userId: string
  ): Promise<void> {
    await workspaceApi.removeMember(workspaceId, userId)

    if (workspaceId === activeWorkspaceId.value) {
      const personal = personalWorkspace.value
      if (personal) {
        sessionManager.switchWorkspaceAndReload(personal.id)
      }
    } else {
      workspaces.value = workspaces.value.filter((w) => w.id !== workspaceId)
    }
  }

  // ════════════════════════════════════════════════════════════
  // RETURN
  // ════════════════════════════════════════════════════════════

  return {
    // State
    initState,
    workspaces,
    activeWorkspaceId,
    error,
    isCreating,
    isDeleting,
    isSwitching,

    // Computed
    activeWorkspace,
    personalWorkspace,
    isInPersonalWorkspace,
    sharedWorkspaces,

    // Actions
    initialize,
    switchWorkspace,
    createWorkspace,
    deleteWorkspace,
    renameWorkspace,
    createInvite,
    acceptInvite,
    leaveWorkspace
  }
})
```

---

### Step 3: Create `useWorkspaceUI.ts`

Location: `src/composables/useWorkspaceUI.ts`

This composable extracts UI configuration logic from the existing `useWorkspace.ts`. It computes role-based UI flags from the store state.

```typescript
// src/composables/use-workspace-ui.ts

import { computed } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace-store'

/**
 * UI configuration derived from workspace state.
 * Controls what UI elements are visible/enabled based on role and workspace type.
 */
export interface WorkspaceUIConfig {
  // Workspace management
  canInviteMembers: boolean
  canDeleteWorkspace: boolean
  canRenameWorkspace: boolean
  canManageMembers: boolean
  canLeaveWorkspace: boolean

  // Add any other UI flags from existing use-workspace.ts uiConfig here
  // Example:
  // canViewBilling: boolean;
  // canChangeSettings: boolean;
  // showMemberList: boolean;
}

function getDefaultUIConfig(): WorkspaceUIConfig {
  return {
    canInviteMembers: false,
    canDeleteWorkspace: false,
    canRenameWorkspace: false,
    canManageMembers: false,
    canLeaveWorkspace: false
  }
}

export function useWorkspaceUI() {
  const store = useWorkspaceStore()

  const uiConfig = computed<WorkspaceUIConfig>(() => {
    const workspace = store.activeWorkspace

    if (!workspace) {
      return getDefaultUIConfig()
    }

    const isOwner = workspace.role === 'owner'
    const isPersonal = workspace.isPersonal

    return {
      canInviteMembers: isOwner && !isPersonal,
      canDeleteWorkspace: isOwner && !isPersonal,
      canRenameWorkspace: isOwner,
      canManageMembers: isOwner && !isPersonal,
      canLeaveWorkspace: !isPersonal && !isOwner

      // IMPORTANT: Add all other UI flags from existing use-workspace.ts
      // Look for the existing uiConfig object and migrate ALL properties here
    }
  })

  // Convenience re-exports so components don't need both imports
  return {
    uiConfig,
    activeWorkspace: computed(() => store.activeWorkspace),
    workspaces: computed(() => store.workspaces),
    personalWorkspace: computed(() => store.personalWorkspace),
    isLoading: computed(() => store.initState === 'loading'),
    isReady: computed(() => store.initState === 'ready'),
    isError: computed(() => store.initState === 'error')
  }
}
```

**IMPORTANT:** The existing `useWorkspace.ts` has a `uiConfig` object with specific properties. Extract ALL of them into this composable. The properties I listed are examples—the real implementation should include every UI flag the existing code uses.

---

### Step 4: Update Component Imports

Find all components importing from old files and update:

**Before:**

```typescript
import { useWorkspace } from '@/composables/use-workspace'
import { useWorkspaceAuthStore } from '@/stores/workspace-auth-store'
```

**After:**

```typescript
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useWorkspaceUI } from '@/composables/use-workspace-ui'
```

**Usage patterns:**

For actions (create, switch, delete, etc.):

```typescript
const store = useWorkspaceStore()

async function handleCreate() {
  try {
    await store.createWorkspace(name)
    // Won't reach here - page reloads
  } catch (e) {
    showError(e.message)
  }
}
```

For UI config and display:

```typescript
const { uiConfig, activeWorkspace, isLoading } = useWorkspaceUI()

// In template:
// <Button v-if="uiConfig.canInviteMembers">Invite</Button>
// <span>{{ activeWorkspace?.name }}</span>
```

---

### Step 5: Wire Up App Initialization

Find where the app initializes (likely `App.vue`, `main.ts`, or a router guard) and add:

```typescript
import { useWorkspaceStore } from '@/stores/workspace-store'

// In App.vue setup:
const workspaceStore = useWorkspaceStore()

onMounted(async () => {
  try {
    await workspaceStore.initialize()
  } catch (e) {
    // Handle failure - show error screen or redirect to login
    console.error('Workspace initialization failed:', e)
  }
})

// Or as a router guard:
router.beforeEach(async (to, from, next) => {
  const store = useWorkspaceStore()

  if (store.initState === 'uninitialized') {
    try {
      await store.initialize()
    } catch (e) {
      return next('/login')
    }
  }

  next()
})
```

---

### Step 6: Handle Invite URL Flow

If there's a route handling `?invite=TOKEN`:

```typescript
// In the component or route handler

import { useRoute, useRouter } from 'vue-router'
import { useWorkspaceStore } from '@/stores/workspace-store'

const route = useRoute()
const router = useRouter()
const store = useWorkspaceStore()

const inviteToken = route.query.invite as string

if (inviteToken) {
  try {
    const workspace = await store.acceptInvite(inviteToken)

    // Show success dialog
    showDialog({
      title: 'Invite Accepted',
      message: `You've joined ${workspace.name}`,
      actions: [
        {
          label: 'View Workspace',
          onClick: () => store.switchWorkspace(workspace.id)
        },
        { label: 'Stay Here', onClick: () => {} }
      ]
    })
  } catch (e) {
    showError('Invite is invalid or expired')
  }

  // Clean URL
  router.replace({ query: {} })
}
```

---

### Step 7: Delete Old Files

Once everything works:

1. ❌ Delete `workspaceAuthStore.ts`
2. ❌ Delete `useWorkspace.ts`
3. ✅ Keep `workspaceApi.ts`

---

## Part 5: Testing Checklist

### Core Flows

- [ ] App boot → workspaces load → personal workspace active
- [ ] Create workspace → page reloads → new workspace active
- [ ] Switch workspace → page reloads → correct workspace active
- [ ] Delete active workspace → page reloads → personal workspace active
- [ ] Delete non-active workspace → list updates → no reload
- [ ] Rename workspace → name updates → no reload

### Session Behavior

- [ ] Refresh tab → same workspace (sessionStorage persists)
- [ ] Close tab, reopen → personal workspace (sessionStorage cleared)
- [ ] Close browser, reopen → personal workspace (sessionStorage cleared)
- [ ] Multiple tabs → each can have different workspace

### Invite Flow

- [ ] Create invite → returns URL with token
- [ ] Accept invite → workspace added to list
- [ ] Click "View Workspace" after accept → switches and reloads

### UI Config

- [ ] Owner of shared workspace → all actions enabled
- [ ] Member of shared workspace → limited actions
- [ ] Personal workspace → cannot delete, cannot leave

### Error Handling

- [ ] Workspace deleted while viewing → graceful redirect to personal
- [ ] Network error during create → error shown, no reload
- [ ] Invalid invite token → error shown

---

## Part 6: Reference - The Reload Pattern

| Operation               | After Success                                   |
| ----------------------- | ----------------------------------------------- |
| Create workspace        | Set session ID → **Reload**                     |
| Switch workspace        | Set session ID → **Reload**                     |
| Delete active workspace | Set personal ID → **Reload**                    |
| Delete other workspace  | Update local list (no reload)                   |
| Rename workspace        | Update local state (no reload)                  |
| Accept invite           | Add to list (no reload, user chooses to switch) |
| Leave active workspace  | Set personal ID → **Reload**                    |
| Leave other workspace   | Remove from list (no reload)                    |

**Rule:** If active workspace changes → reload. Otherwise → just update local state.

---

## Part 7: Things to Watch For

1. **Firebase Token Retrieval**
   - Look at existing `workspaceAuthStore.ts` to see how it gets the Firebase token
   - It might be `localStorage`, Firebase SDK, or a custom auth service
   - Match that in `sessionManager.getFirebaseToken()`

2. **Token Refresh/Expiry**
   - Old code may have timer-based token refresh
   - With reload pattern, this may not be needed—each reload gets fresh token
   - Test to confirm

3. **Existing uiConfig Properties**
   - The existing `useWorkspace.ts` has specific `uiConfig` properties
   - Extract ALL of them—don't miss any or components will break

4. **API Endpoint Paths**
   - The `workspaceApi.ts` file already has the correct endpoints
   - Don't change them unless the backend changed

5. **Type Definitions**
   - `Workspace`, `InviteLink`, etc. should already exist in `workspaceApi.ts`
   - Import from there, don't redefine

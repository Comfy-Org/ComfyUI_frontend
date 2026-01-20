import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import { TOKEN_REFRESH_BUFFER_MS } from '@/platform/auth/workspace/workspaceConstants'

import { sessionManager } from '../services/sessionManager'
import type {
  ExchangeTokenResponse,
  ListMembersParams,
  Member,
  PendingInvite as ApiPendingInvite,
  WorkspaceWithRole
} from '../api/workspaceApi'
import { workspaceApi, WorkspaceApiError } from '../api/workspaceApi'

// Extended member type for UI (adds joinDate as Date)
export interface WorkspaceMember {
  id: string
  name: string
  email: string
  joinDate: Date
}

// Extended invite type for UI (adds dates as Date objects)
export interface PendingInvite {
  id: string
  email: string
  token: string
  inviteDate: Date
  expiryDate: Date
}

type SubscriptionPlan = 'PRO_MONTHLY' | 'PRO_YEARLY' | null

interface WorkspaceState extends WorkspaceWithRole {
  isSubscribed: boolean
  subscriptionPlan: SubscriptionPlan
  members: WorkspaceMember[]
  pendingInvites: PendingInvite[]
}

export type InitState = 'uninitialized' | 'loading' | 'ready' | 'error'

function mapApiMemberToWorkspaceMember(member: Member): WorkspaceMember {
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    joinDate: new Date(member.joined_at)
  }
}

function mapApiInviteToPendingInvite(invite: ApiPendingInvite): PendingInvite {
  return {
    id: invite.id,
    email: invite.email,
    token: invite.token,
    inviteDate: new Date(invite.invited_at),
    expiryDate: new Date(invite.expires_at)
  }
}

function createWorkspaceState(workspace: WorkspaceWithRole): WorkspaceState {
  return {
    ...workspace,
    isSubscribed: false,
    subscriptionPlan: null,
    members: [],
    pendingInvites: []
  }
}

// Workspace limits
const MAX_OWNED_WORKSPACES = 10
const MAX_WORKSPACE_MEMBERS = 50

export const useTeamWorkspaceStore = defineStore('teamWorkspace', () => {
  // ════════════════════════════════════════════════════════════
  // STATE
  // ════════════════════════════════════════════════════════════

  const initState = ref<InitState>('uninitialized')
  const workspaces = shallowRef<WorkspaceState[]>([])
  const activeWorkspaceId = ref<string | null>(null)
  const error = ref<Error | null>(null)

  // Loading states for UI
  const isCreating = ref(false)
  const isDeleting = ref(false)
  const isSwitching = ref(false)
  const isFetchingWorkspaces = ref(false)

  // Token refresh timer state
  let refreshTimerId: ReturnType<typeof setTimeout> | null = null
  // Request ID to prevent stale refresh operations from overwriting newer workspace contexts
  let tokenRefreshRequestId = 0

  // ════════════════════════════════════════════════════════════
  // COMPUTED
  // ════════════════════════════════════════════════════════════

  const activeWorkspace = computed(
    () => workspaces.value.find((w) => w.id === activeWorkspaceId.value) ?? null
  )

  const personalWorkspace = computed(
    () => workspaces.value.find((w) => w.type === 'personal') ?? null
  )

  const isInPersonalWorkspace = computed(
    () => activeWorkspace.value?.type === 'personal'
  )

  const sharedWorkspaces = computed(() =>
    workspaces.value.filter((w) => w.type !== 'personal')
  )

  const ownedWorkspacesCount = computed(
    () => workspaces.value.filter((w) => w.role === 'owner').length
  )

  const canCreateWorkspace = computed(
    () => ownedWorkspacesCount.value < MAX_OWNED_WORKSPACES
  )

  const members = computed<WorkspaceMember[]>(
    () => activeWorkspace.value?.members ?? []
  )

  const pendingInvites = computed<PendingInvite[]>(
    () => activeWorkspace.value?.pendingInvites ?? []
  )

  const totalMemberSlots = computed(
    () => members.value.length + pendingInvites.value.length
  )

  const isInviteLimitReached = computed(
    () => totalMemberSlots.value >= MAX_WORKSPACE_MEMBERS
  )

  const workspaceId = computed(() => activeWorkspace.value?.id ?? null)

  const workspaceName = computed(() => activeWorkspace.value?.name ?? '')

  const isWorkspaceSubscribed = computed(
    () => activeWorkspace.value?.isSubscribed ?? false
  )

  const subscriptionPlan = computed(
    () => activeWorkspace.value?.subscriptionPlan ?? null
  )

  // ════════════════════════════════════════════════════════════
  // INTERNAL HELPERS
  // ════════════════════════════════════════════════════════════

  function updateWorkspace(
    workspaceId: string,
    updates: Partial<WorkspaceState>
  ) {
    const index = workspaces.value.findIndex((w) => w.id === workspaceId)
    if (index === -1) return

    const current = workspaces.value[index]
    const updated = { ...current, ...updates }
    workspaces.value = [
      ...workspaces.value.slice(0, index),
      updated,
      ...workspaces.value.slice(index + 1)
    ]
  }

  function updateActiveWorkspace(updates: Partial<WorkspaceState>) {
    if (!activeWorkspaceId.value) return
    updateWorkspace(activeWorkspaceId.value, updates)
  }

  // ════════════════════════════════════════════════════════════
  // TOKEN MANAGEMENT
  // ════════════════════════════════════════════════════════════

  function stopRefreshTimer(): void {
    if (refreshTimerId !== null) {
      clearTimeout(refreshTimerId)
      refreshTimerId = null
    }
  }

  function scheduleTokenRefresh(expiresAt: number): void {
    stopRefreshTimer()
    const now = Date.now()
    const refreshAt = expiresAt - TOKEN_REFRESH_BUFFER_MS
    const delay = Math.max(0, refreshAt - now)

    refreshTimerId = setTimeout(() => {
      void refreshWorkspaceToken()
    }, delay)
  }

  /**
   * Exchange Firebase token for workspace-scoped token.
   * Stores the token in sessionStorage and schedules refresh.
   */
  async function exchangeAndStoreToken(
    workspaceId: string
  ): Promise<ExchangeTokenResponse> {
    const response = await workspaceApi.exchangeToken(workspaceId)
    const expiresAt = new Date(response.expires_at).getTime()

    if (isNaN(expiresAt)) {
      throw new Error('Invalid token expiry timestamp from server')
    }

    // Store token in sessionStorage
    sessionManager.setWorkspaceToken(response.token, expiresAt)

    // Schedule refresh before expiry
    scheduleTokenRefresh(expiresAt)

    return response
  }

  /**
   * Refresh the workspace token.
   * Called automatically before token expires.
   * Includes retry logic for transient failures.
   */
  async function refreshWorkspaceToken(): Promise<void> {
    if (!activeWorkspaceId.value) return

    const workspaceId = activeWorkspaceId.value
    const capturedRequestId = tokenRefreshRequestId
    const maxRetries = 3
    const baseDelayMs = 1000

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Check if workspace context changed during refresh
      if (capturedRequestId !== tokenRefreshRequestId) {
        console.warn(
          '[workspaceStore] Aborting stale token refresh: workspace context changed'
        )
        return
      }

      try {
        await exchangeAndStoreToken(workspaceId)
        return
      } catch (err) {
        const isApiError = err instanceof WorkspaceApiError

        // Permanent errors - don't retry
        const isPermanentError =
          isApiError &&
          (err.code === 'ACCESS_DENIED' ||
            err.code === 'WORKSPACE_NOT_FOUND' ||
            err.code === 'INVALID_FIREBASE_TOKEN' ||
            err.code === 'NOT_AUTHENTICATED')

        if (isPermanentError) {
          if (capturedRequestId === tokenRefreshRequestId) {
            console.error(
              '[workspaceStore] Workspace access revoked or auth invalid:',
              err
            )
            clearTokenContext()
          }
          return
        }

        // Transient errors - retry with backoff
        if (attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt)
          console.warn(
            `[workspaceStore] Token refresh failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`,
            err
          )
          await new Promise((resolve) => setTimeout(resolve, delay))
          continue
        }

        // All retries exhausted
        if (capturedRequestId === tokenRefreshRequestId) {
          console.error(
            '[workspaceStore] Failed to refresh token after retries:',
            err
          )
          clearTokenContext()
        }
      }
    }
  }

  /**
   * Clear token context (on auth failure or workspace switch).
   */
  function clearTokenContext(): void {
    tokenRefreshRequestId++
    stopRefreshTimer()
    sessionManager.clearWorkspaceToken()
  }

  /**
   * Check if we have a valid token in sessionStorage (for page refresh).
   * If valid, schedule refresh timer. If expired, return false.
   */
  function initializeTokenFromSession(): boolean {
    const tokenData = sessionManager.getWorkspaceToken()
    if (!tokenData) return false

    const { expiresAt } = tokenData
    if (Date.now() >= expiresAt) {
      // Token expired, clear it
      sessionManager.clearWorkspaceToken()
      return false
    }

    // Token still valid, schedule refresh
    scheduleTokenRefresh(expiresAt)
    return true
  }

  // ════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ════════════════════════════════════════════════════════════

  /**
   * Initialize the workspace store.
   * Fetches workspaces and resolves the active workspace from session/localStorage.
   * Call once on app boot.
   */
  async function initialize(): Promise<void> {
    if (initState.value !== 'uninitialized') return

    initState.value = 'loading'
    isFetchingWorkspaces.value = true
    error.value = null

    try {
      // 1. Fetch all workspaces
      const response = await workspaceApi.list()
      workspaces.value = response.workspaces.map(createWorkspaceState)

      if (workspaces.value.length === 0) {
        throw new Error('No workspaces available')
      }

      // 2. Determine active workspace (priority: sessionStorage > localStorage > personal)
      let targetWorkspaceId: string | null = null

      // Try sessionStorage first (page refresh)
      const sessionId = sessionManager.getCurrentWorkspaceId()
      if (sessionId && workspaces.value.some((w) => w.id === sessionId)) {
        targetWorkspaceId = sessionId
      }

      // Try localStorage (cross-session persistence)
      if (!targetWorkspaceId) {
        const lastId = sessionManager.getLastWorkspaceId()
        if (lastId && workspaces.value.some((w) => w.id === lastId)) {
          targetWorkspaceId = lastId
        }
      }

      // Fall back to personal workspace
      if (!targetWorkspaceId) {
        const personal = workspaces.value.find((w) => w.type === 'personal')
        targetWorkspaceId = personal?.id ?? workspaces.value[0].id
      }

      // 3. Set active workspace
      activeWorkspaceId.value = targetWorkspaceId
      sessionManager.setCurrentWorkspaceId(targetWorkspaceId)
      sessionManager.setLastWorkspaceId(targetWorkspaceId)

      // 4. Initialize workspace token
      // First check if we have a valid token from session (page refresh case)
      const hasValidToken = initializeTokenFromSession()

      if (!hasValidToken) {
        // No valid token - exchange Firebase token for workspace token
        try {
          await exchangeAndStoreToken(targetWorkspaceId)
        } catch (tokenError) {
          // Log but don't fail initialization - API calls will fall back to Firebase token
          console.error(
            '[workspaceStore] Token exchange failed during init:',
            tokenError
          )
        }
      }

      initState.value = 'ready'
    } catch (e) {
      error.value = e instanceof Error ? e : new Error('Unknown error')
      initState.value = 'error'
      throw e
    } finally {
      isFetchingWorkspaces.value = false
    }
  }

  /**
   * Re-fetch workspaces from API without changing active workspace.
   */
  async function refreshWorkspaces(): Promise<void> {
    isFetchingWorkspaces.value = true
    try {
      const response = await workspaceApi.list()
      workspaces.value = response.workspaces.map(createWorkspaceState)
    } finally {
      isFetchingWorkspaces.value = false
    }
  }

  // ════════════════════════════════════════════════════════════
  // WORKSPACE ACTIONS
  // ════════════════════════════════════════════════════════════

  /**
   * Switch to a different workspace.
   * Sets session storage and reloads the page.
   */
  async function switchWorkspace(workspaceId: string): Promise<void> {
    if (workspaceId === activeWorkspaceId.value) return

    // Invalidate any in-flight token refresh for the old workspace
    clearTokenContext()

    isSwitching.value = true

    try {
      // Verify workspace exists in our list (user has access)
      const workspace = workspaces.value.find((w) => w.id === workspaceId)
      if (!workspace) {
        // Workspace not in list - try refetching in case it was added
        await refreshWorkspaces()
        const refreshedWorkspace = workspaces.value.find(
          (w) => w.id === workspaceId
        )
        if (!refreshedWorkspace) {
          throw new Error('Workspace not found or access denied')
        }
      }

      // Success - switch and reload
      sessionManager.switchWorkspaceAndReload(workspaceId)
      // Code after this won't run (page reloads)
    } catch (e) {
      isSwitching.value = false
      throw e
    }
  }

  /**
   * Create a new workspace and switch to it.
   */
  async function createWorkspace(name: string): Promise<WorkspaceState> {
    isCreating.value = true

    try {
      const newWorkspace = await workspaceApi.create({ name })
      const workspaceState = createWorkspaceState(newWorkspace)

      // Add to local list
      workspaces.value = [...workspaces.value, workspaceState]

      // Switch to new workspace (triggers reload)
      sessionManager.switchWorkspaceAndReload(newWorkspace.id)

      // Code after this won't run (page reloads)
      return workspaceState
    } catch (e) {
      isCreating.value = false
      throw e
    }
  }

  /**
   * Delete a workspace.
   * If deleting active workspace, switches to personal.
   */
  async function deleteWorkspace(workspaceId?: string): Promise<void> {
    const targetId = workspaceId ?? activeWorkspaceId.value
    if (!targetId) throw new Error('No workspace to delete')

    const workspace = workspaces.value.find((w) => w.id === targetId)
    if (!workspace) throw new Error('Workspace not found')
    if (workspace.type === 'personal') {
      throw new Error('Cannot delete personal workspace')
    }

    isDeleting.value = true

    try {
      await workspaceApi.delete(targetId)

      if (targetId === activeWorkspaceId.value) {
        // Deleted active workspace - go to personal
        const personal = personalWorkspace.value
        if (personal) {
          sessionManager.switchWorkspaceAndReload(personal.id)
        } else {
          sessionManager.clearAndReload()
        }
        // Code after this won't run (page reloads)
      } else {
        // Deleted non-active workspace - just update local list
        workspaces.value = workspaces.value.filter((w) => w.id !== targetId)
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
    updateWorkspace(workspaceId, { name: updated.name })
  }

  /**
   * Update workspace name (convenience for current workspace).
   */
  async function updateWorkspaceName(name: string): Promise<void> {
    if (!activeWorkspaceId.value) {
      throw new Error('No active workspace')
    }
    await renameWorkspace(activeWorkspaceId.value, name)
  }

  /**
   * Leave the current workspace.
   * Switches to personal workspace after leaving.
   */
  async function leaveWorkspace(): Promise<void> {
    const current = activeWorkspace.value
    if (!current || current.type === 'personal') {
      throw new Error('Cannot leave personal workspace')
    }

    await workspaceApi.leave()

    // Go to personal workspace
    const personal = personalWorkspace.value
    if (personal) {
      sessionManager.switchWorkspaceAndReload(personal.id)
    } else {
      sessionManager.clearAndReload()
    }
    // Code after this won't run (page reloads)
  }

  // ════════════════════════════════════════════════════════════
  // MEMBER ACTIONS
  // ════════════════════════════════════════════════════════════

  /**
   * Fetch members for the current workspace.
   */
  async function fetchMembers(
    params?: ListMembersParams
  ): Promise<WorkspaceMember[]> {
    if (!activeWorkspaceId.value) return []
    if (activeWorkspace.value?.type === 'personal') return []

    const response = await workspaceApi.listMembers(params)
    const members = response.members.map(mapApiMemberToWorkspaceMember)
    updateActiveWorkspace({ members })
    return members
  }

  /**
   * Remove a member from the current workspace.
   */
  async function removeMember(userId: string): Promise<void> {
    await workspaceApi.removeMember(userId)
    const current = activeWorkspace.value
    if (current) {
      updateActiveWorkspace({
        members: current.members.filter((m) => m.id !== userId)
      })
    }
  }

  // ════════════════════════════════════════════════════════════
  // INVITE ACTIONS
  // ════════════════════════════════════════════════════════════

  /**
   * Fetch pending invites for the current workspace.
   */
  async function fetchPendingInvites(): Promise<PendingInvite[]> {
    if (!activeWorkspaceId.value) return []
    if (activeWorkspace.value?.type === 'personal') return []

    const response = await workspaceApi.listInvites()
    const invites = response.invites.map(mapApiInviteToPendingInvite)
    updateActiveWorkspace({ pendingInvites: invites })
    return invites
  }

  /**
   * Create an invite for the current workspace.
   */
  async function createInvite(email: string): Promise<PendingInvite> {
    const response = await workspaceApi.createInvite({ email })
    const invite = mapApiInviteToPendingInvite(response)

    const current = activeWorkspace.value
    if (current) {
      updateActiveWorkspace({
        pendingInvites: [...current.pendingInvites, invite]
      })
    }

    return invite
  }

  /**
   * Revoke a pending invite.
   */
  async function revokeInvite(inviteId: string): Promise<void> {
    await workspaceApi.revokeInvite(inviteId)
    const current = activeWorkspace.value
    if (current) {
      updateActiveWorkspace({
        pendingInvites: current.pendingInvites.filter((i) => i.id !== inviteId)
      })
    }
  }

  /**
   * Accept a workspace invite.
   * Returns workspace info so UI can offer "View Workspace" button.
   */
  async function acceptInvite(
    token: string
  ): Promise<{ workspaceId: string; workspaceName: string }> {
    const response = await workspaceApi.acceptInvite(token)

    // Refresh workspace list to include newly joined workspace
    await refreshWorkspaces()

    return {
      workspaceId: response.workspace_id,
      workspaceName: response.workspace_name
    }
  }

  // ════════════════════════════════════════════════════════════
  // INVITE LINK HELPERS
  // ════════════════════════════════════════════════════════════

  function buildInviteLink(token: string): string {
    const baseUrl = window.location.origin
    return `${baseUrl}?invite=${encodeURIComponent(token)}`
  }

  /**
   * Get the invite link for a pending invite.
   */
  function getInviteLink(inviteId: string): string | null {
    const invite = activeWorkspace.value?.pendingInvites.find(
      (i) => i.id === inviteId
    )
    return invite ? buildInviteLink(invite.token) : null
  }

  /**
   * Create an invite link for a given email.
   */
  async function createInviteLink(email: string): Promise<string> {
    const invite = await createInvite(email)
    return buildInviteLink(invite.token)
  }

  /**
   * Copy an invite link to clipboard.
   */
  async function copyInviteLink(inviteId: string): Promise<string> {
    const invite = activeWorkspace.value?.pendingInvites.find(
      (i) => i.id === inviteId
    )
    if (!invite) {
      throw new Error('Invite not found')
    }
    const inviteLink = buildInviteLink(invite.token)
    await navigator.clipboard.writeText(inviteLink)
    return inviteLink
  }

  // ════════════════════════════════════════════════════════════
  // SUBSCRIPTION (placeholder for future integration)
  // ════════════════════════════════════════════════════════════

  function subscribeWorkspace(plan: SubscriptionPlan = 'PRO_MONTHLY') {
    updateActiveWorkspace({
      isSubscribed: true,
      subscriptionPlan: plan
    })
  }

  // ════════════════════════════════════════════════════════════
  // CLEANUP
  // ════════════════════════════════════════════════════════════

  /**
   * Clean up store resources (timers, etc.).
   * Call when the store is no longer needed.
   */
  function destroy(): void {
    clearTokenContext()
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
    isFetchingWorkspaces,

    // Computed
    activeWorkspace,
    personalWorkspace,
    isInPersonalWorkspace,
    sharedWorkspaces,
    ownedWorkspacesCount,
    canCreateWorkspace,
    members,
    pendingInvites,
    totalMemberSlots,
    isInviteLimitReached,
    workspaceId,
    workspaceName,
    isWorkspaceSubscribed,
    subscriptionPlan,

    // Initialization & Cleanup
    initialize,
    destroy,
    refreshWorkspaces,

    // Workspace Actions
    switchWorkspace,
    createWorkspace,
    deleteWorkspace,
    renameWorkspace,
    updateWorkspaceName,
    leaveWorkspace,

    // Member Actions
    fetchMembers,
    removeMember,

    // Invite Actions
    fetchPendingInvites,
    createInvite,
    revokeInvite,
    acceptInvite,
    getInviteLink,
    createInviteLink,
    copyInviteLink,

    // Subscription
    subscribeWorkspace
  }
})

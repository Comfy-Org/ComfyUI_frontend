import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { WORKSPACE_STORAGE_KEYS } from '@/platform/workspace/workspaceConstants'
import { clearPreservedQuery } from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'

import type {
  ListMembersParams,
  Member,
  PendingInvite as ApiPendingInvite,
  SubscriptionTier,
  WorkspaceWithRole
} from '../api/workspaceApi'
import { workspaceApi } from '../api/workspaceApi'

export interface WorkspaceMember {
  id: string
  name: string
  email: string
  joinDate: Date
  role: 'owner' | 'member'
  isOriginalOwner: boolean
}

export interface PendingInvite {
  id: string
  email: string
  inviteDate: Date
  expiryDate: Date
}

type SubscriptionPlan = string | null

interface WorkspaceState extends WorkspaceWithRole {
  isSubscribed: boolean
  subscriptionPlan: SubscriptionPlan
  subscriptionTier: SubscriptionTier | null
  members: WorkspaceMember[]
  pendingInvites: PendingInvite[]
}

type InitState = 'uninitialized' | 'loading' | 'ready' | 'error'

function mapApiMemberToWorkspaceMember(member: Member): WorkspaceMember {
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    joinDate: new Date(member.joined_at),
    role: member.role,
    isOriginalOwner: member.is_original_owner ?? false
  }
}

function mapApiInviteToPendingInvite(invite: ApiPendingInvite): PendingInvite {
  return {
    id: invite.id,
    email: invite.email,
    inviteDate: new Date(invite.invited_at),
    expiryDate: new Date(invite.expires_at)
  }
}

function createWorkspaceState(workspace: WorkspaceWithRole): WorkspaceState {
  return {
    ...workspace,
    // Personal workspaces use user-scoped subscription from useSubscription()
    isSubscribed:
      workspace.type === 'personal' || !!workspace.subscription_tier,
    subscriptionPlan: null,
    subscriptionTier: workspace.subscription_tier ?? null,
    members: [],
    pendingInvites: []
  }
}

export function sortWorkspaces<T extends WorkspaceWithRole>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    if (a.type === 'personal') return -1
    if (b.type === 'personal') return 1
    const dateA = a.role === 'owner' ? a.created_at : a.joined_at
    const dateB = b.role === 'owner' ? b.created_at : b.joined_at
    return dateA.localeCompare(dateB)
  })
}

function getLastWorkspaceId(): string | null {
  try {
    return localStorage.getItem(WORKSPACE_STORAGE_KEYS.LAST_WORKSPACE_ID)
  } catch {
    return null
  }
}

function setLastWorkspaceId(workspaceId: string): void {
  try {
    localStorage.setItem(WORKSPACE_STORAGE_KEYS.LAST_WORKSPACE_ID, workspaceId)
  } catch {
    console.warn('Failed to persist last workspace ID to localStorage')
  }
}

function clearLastWorkspaceId(): void {
  try {
    localStorage.removeItem(WORKSPACE_STORAGE_KEYS.LAST_WORKSPACE_ID)
  } catch {
    console.warn('Failed to clear last workspace ID from localStorage')
  }
}

const MAX_OWNED_WORKSPACES = 10
export const MAX_WORKSPACE_MEMBERS = 30
const MAX_INIT_RETRIES = 3
const BASE_RETRY_DELAY_MS = 1000

export const useTeamWorkspaceStore = defineStore('teamWorkspace', () => {
  const initState = ref<InitState>('uninitialized')
  const workspaces = shallowRef<WorkspaceState[]>([])
  const activeWorkspaceId = ref<string | null>(null)
  const error = ref<Error | null>(null)

  const isCreating = ref(false)
  const isDeleting = ref(false)
  const isSwitching = ref(false)
  const isFetchingWorkspaces = ref(false)
  let identityGeneration = 0

  function isStaleIdentity(generation: number): boolean {
    return generation !== identityGeneration
  }

  function isStaleWorkspace(generation: number, workspaceId: string): boolean {
    return (
      isStaleIdentity(generation) || activeWorkspaceId.value !== workspaceId
    )
  }

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

  // The active workspace's original owner (creator). Prefers the
  // `is_original_owner` flag; without it, falls back to the earliest-joined
  // owner — never a plain member, who must stay role-changeable.
  const originalOwnerId = computed<string | null>(() => {
    const flagged = members.value.find((m) => m.isOriginalOwner)
    if (flagged) return flagged.id
    const owners = members.value.filter((m) => m.role === 'owner')
    if (owners.length === 0) return null
    return owners.reduce((earliest, m) =>
      m.joinDate < earliest.joinDate ? m : earliest
    ).id
  })

  // True when the current user is that original owner. Single-sourced from
  // `originalOwnerId` so the two creator signals can never disagree. Matches the
  // self-row by email (the stable current-user join key; member.id is a cloud
  // user id, not the Firebase uid) and fails closed until members load.
  const isCurrentUserOriginalOwner = computed(() => {
    const email = useCurrentUser().userEmail.value?.toLowerCase()
    if (!email) return false
    const selfRow = members.value.find((m) => m.email.toLowerCase() === email)
    return !!selfRow && selfRow.id === originalOwnerId.value
  })

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

  /**
   * Initialize the workspace store.
   * Fetches workspaces and resolves the active workspace from session/localStorage.
   * Delegates token management to workspaceAuthStore.
   * Retries on transient failures with exponential backoff.
   * Call once on app boot.
   */
  async function initialize(): Promise<void> {
    if (initState.value !== 'uninitialized') return

    const generation = identityGeneration
    initState.value = 'loading'
    isFetchingWorkspaces.value = true
    error.value = null

    const workspaceAuthStore = useWorkspaceAuthStore()

    for (let attempt = 0; attempt <= MAX_INIT_RETRIES; attempt++) {
      try {
        const { useSessionCookie } =
          await import('@/platform/auth/session/useSessionCookie')
        await useSessionCookie().ensureSessionCookie()
        if (isStaleIdentity(generation)) return

        // 1. Try to restore workspace context from session (page refresh case)
        const hasValidSession = workspaceAuthStore.initializeFromSession()

        if (hasValidSession && workspaceAuthStore.currentWorkspace) {
          // Valid session exists - fetch workspace list and verify access
          const response = await workspaceApi.list()
          if (isStaleIdentity(generation)) return
          workspaces.value = sortWorkspaces(
            response.workspaces.map(createWorkspaceState)
          )

          if (workspaces.value.length === 0) {
            throw new Error('No workspaces available')
          }

          // Verify session workspace exists in fetched list
          const sessionWorkspaceId = workspaceAuthStore.currentWorkspace.id
          const sessionWorkspaceExists = workspaces.value.some(
            (w) => w.id === sessionWorkspaceId
          )

          if (sessionWorkspaceExists) {
            activeWorkspaceId.value = sessionWorkspaceId
            initState.value = 'ready'
            isFetchingWorkspaces.value = false
            return
          }

          // Session workspace not found (deleted/access revoked) - fallback to default
          workspaceAuthStore.clearWorkspaceContext()

          const personal = workspaces.value.find((w) => w.type === 'personal')
          const fallbackWorkspaceId = personal?.id ?? workspaces.value[0].id

          try {
            await workspaceAuthStore.switchWorkspace(fallbackWorkspaceId)
          } catch {
            if (isStaleIdentity(generation)) return
            console.error(
              '[teamWorkspaceStore] Token exchange failed during fallback'
            )
          }

          if (isStaleIdentity(generation)) return

          activeWorkspaceId.value = fallbackWorkspaceId
          setLastWorkspaceId(fallbackWorkspaceId)
          initState.value = 'ready'
          isFetchingWorkspaces.value = false
          return
        }

        // 2. No valid session - fetch workspaces and pick default
        const response = await workspaceApi.list()
        if (isStaleIdentity(generation)) return
        workspaces.value = sortWorkspaces(
          response.workspaces.map(createWorkspaceState)
        )

        if (workspaces.value.length === 0) {
          throw new Error('No workspaces available')
        }

        // 3. Determine target workspace (priority: localStorage > personal)
        let targetWorkspaceId: string | null = null

        const lastId = getLastWorkspaceId()
        if (lastId && workspaces.value.some((w) => w.id === lastId)) {
          targetWorkspaceId = lastId
        }

        if (!targetWorkspaceId) {
          const personal = workspaces.value.find((w) => w.type === 'personal')
          targetWorkspaceId = personal?.id ?? workspaces.value[0].id
        }

        // 4. Exchange Firebase token for workspace token
        try {
          await workspaceAuthStore.switchWorkspace(targetWorkspaceId)
        } catch {
          if (isStaleIdentity(generation)) return
          // Log but don't fail initialization - API calls will fall back to Firebase token
          console.error(
            '[teamWorkspaceStore] Token exchange failed during init'
          )
        }

        if (isStaleIdentity(generation)) return

        // 5. Set active workspace
        activeWorkspaceId.value = targetWorkspaceId
        setLastWorkspaceId(targetWorkspaceId)

        initState.value = 'ready'
        isFetchingWorkspaces.value = false
        return
      } catch (e) {
        if (isStaleIdentity(generation)) return
        const isNoWorkspacesError =
          e instanceof Error && e.message === 'No workspaces available'

        // Don't retry on permanent errors (no workspaces available)
        if (isNoWorkspacesError || attempt >= MAX_INIT_RETRIES) {
          error.value = e instanceof Error ? e : new Error('Unknown error')
          initState.value = 'error'
          isFetchingWorkspaces.value = false
          throw e
        }

        // Retry with exponential backoff for transient errors
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt)
        const errorMessage = e instanceof Error ? e.message : String(e)
        console.warn(
          `[teamWorkspaceStore] Init failed (attempt ${attempt + 1}/${MAX_INIT_RETRIES + 1}), retrying in ${delay}ms: ${errorMessage}`
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
        if (isStaleIdentity(generation)) return
      }
    }

    if (isStaleIdentity(generation)) return
    isFetchingWorkspaces.value = false
  }

  /**
   * Re-fetch workspaces from API without changing active workspace.
   */
  async function refreshWorkspaces(): Promise<void> {
    const generation = identityGeneration
    isFetchingWorkspaces.value = true
    try {
      const response = await workspaceApi.list()
      if (isStaleIdentity(generation)) return
      workspaces.value = sortWorkspaces(
        response.workspaces.map(createWorkspaceState)
      )
    } finally {
      if (!isStaleIdentity(generation)) {
        isFetchingWorkspaces.value = false
      }
    }
  }

  /**
   * Drop a revoked/deleted active workspace and reload so init falls back to the
   * personal workspace. Skips the personal workspace to avoid a reload loop.
   */
  function forgetRevokedActiveWorkspace(workspaceId: string): void {
    if (activeWorkspaceId.value !== workspaceId) return

    const revoked = workspaces.value.find((w) => w.id === workspaceId)
    if (revoked?.type === 'personal') return

    clearLastWorkspaceId()
    window.location.reload()
  }

  /**
   * Switch to a different workspace.
   * Clears workspace context and reloads the page.
   */
  async function switchWorkspace(workspaceId: string): Promise<void> {
    if (workspaceId === activeWorkspaceId.value) return

    const generation = identityGeneration
    const workspaceAuthStore = useWorkspaceAuthStore()

    isSwitching.value = true

    try {
      // Verify workspace exists in our list (user has access)
      const workspace = workspaces.value.find((w) => w.id === workspaceId)
      if (!workspace) {
        // Workspace not in list - try refetching in case it was added
        await refreshWorkspaces()
        if (isStaleIdentity(generation)) return
        const refreshedWorkspace = workspaces.value.find(
          (w) => w.id === workspaceId
        )
        if (!refreshedWorkspace) {
          throw new Error('Workspace not found or access denied')
        }
      }

      if (isStaleIdentity(generation)) return

      // Clear current workspace context and persist new workspace ID
      workspaceAuthStore.clearWorkspaceContext()
      setLastWorkspaceId(workspaceId)

      // Reload to reinitialize with new workspace
      window.location.reload()
      // Code after this won't run (page reloads)
    } catch (e) {
      if (!isStaleIdentity(generation)) {
        isSwitching.value = false
      }
      throw e
    }
  }

  /**
   * Create a new workspace and switch to it.
   */
  async function createWorkspace(name: string): Promise<WorkspaceState> {
    const generation = identityGeneration
    const workspaceAuthStore = useWorkspaceAuthStore()

    isCreating.value = true

    try {
      const newWorkspace = await workspaceApi.create({ name })
      const workspaceState = createWorkspaceState(newWorkspace)
      if (isStaleIdentity(generation)) return workspaceState

      // Add to local list
      workspaces.value = [...workspaces.value, workspaceState]

      // Clear context and switch to new workspace
      workspaceAuthStore.clearWorkspaceContext()
      // Clear any preserved invite query to prevent stale invites from being
      // processed after the reload (prevents owner adding themselves as member)
      clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.INVITE)
      setLastWorkspaceId(newWorkspace.id)
      window.location.reload()

      // Code after this won't run (page reloads)
      return workspaceState
    } catch (e) {
      if (!isStaleIdentity(generation)) {
        isCreating.value = false
      }
      throw e
    }
  }

  /**
   * Delete a workspace.
   * If deleting active workspace, switches to personal.
   */
  async function deleteWorkspace(workspaceId?: string): Promise<void> {
    const generation = identityGeneration
    const targetId = workspaceId ?? activeWorkspaceId.value
    if (!targetId) throw new Error('No workspace to delete')

    const workspace = workspaces.value.find((w) => w.id === targetId)
    if (!workspace) throw new Error('Workspace not found')
    if (workspace.type === 'personal') {
      throw new Error('Cannot delete personal workspace')
    }

    const workspaceAuthStore = useWorkspaceAuthStore()

    isDeleting.value = true

    try {
      await workspaceApi.delete(targetId)
      if (isStaleIdentity(generation)) return

      if (targetId === activeWorkspaceId.value) {
        // Deleted active workspace - go to personal
        const personal = personalWorkspace.value
        workspaceAuthStore.clearWorkspaceContext()
        if (personal) {
          setLastWorkspaceId(personal.id)
        }
        window.location.reload()
        // Code after this won't run (page reloads)
      } else {
        // Deleted non-active workspace - just update local list
        workspaces.value = workspaces.value.filter((w) => w.id !== targetId)
        isDeleting.value = false
      }
    } catch (e) {
      if (!isStaleIdentity(generation)) {
        isDeleting.value = false
      }
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
    const generation = identityGeneration
    const updated = await workspaceApi.update(workspaceId, { name: newName })
    if (isStaleIdentity(generation)) return
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

  async function leaveWorkspace(): Promise<void> {
    const generation = identityGeneration
    const current = activeWorkspace.value
    if (!current) throw new Error('No active workspace')

    const workspaceAuthStore = useWorkspaceAuthStore()

    await workspaceApi.leave()
    if (isStaleIdentity(generation)) return

    const personal = workspaces.value.find(
      (workspace) =>
        workspace.type === 'personal' && workspace.id !== current.id
    )
    workspaceAuthStore.clearWorkspaceContext()
    if (personal) {
      setLastWorkspaceId(personal.id)
    } else {
      clearLastWorkspaceId()
    }
    window.location.reload()
    // Code after this won't run (page reloads)
  }

  /**
   * Fetch members for the current workspace.
   */
  async function fetchMembers(
    params?: ListMembersParams
  ): Promise<WorkspaceMember[]> {
    const generation = identityGeneration
    const workspaceId = activeWorkspaceId.value
    if (!workspaceId) return []

    const response = await workspaceApi.listMembers(params)
    const members = response.members.map(mapApiMemberToWorkspaceMember)
    if (!isStaleWorkspace(generation, workspaceId)) {
      updateWorkspace(workspaceId, { members })
    }
    return members
  }

  // Tracks which workspaces have already loaded their members so the
  // lifecycle gate resolves without redundant or duplicate fetches.
  const loadedMemberWorkspaceIds = new Set<string>()
  let inFlightMembersRequest: {
    generation: number
    workspaceId: string
  } | null = null

  /**
   * Load the active workspace's members once. No-ops for already-loaded
   * workspaces and dedupes concurrent calls. A failed request is logged and
   * leaves the workspace unloaded so a later call retries.
   */
  async function ensureMembersLoaded(): Promise<void> {
    const workspaceId = activeWorkspaceId.value
    const generation = identityGeneration
    if (!workspaceId) return
    if (loadedMemberWorkspaceIds.has(workspaceId)) return
    if (
      inFlightMembersRequest?.generation === generation &&
      inFlightMembersRequest.workspaceId === workspaceId
    ) {
      return
    }

    const request = { generation, workspaceId }
    inFlightMembersRequest = request
    try {
      await fetchMembers()
      if (!isStaleWorkspace(generation, workspaceId)) {
        loadedMemberWorkspaceIds.add(workspaceId)
      }
    } catch (e) {
      if (!isStaleIdentity(generation)) {
        console.error('Failed to load workspace members', e)
      }
    } finally {
      if (inFlightMembersRequest === request) {
        inFlightMembersRequest = null
      }
    }
  }

  /**
   * Remove a member from the current workspace.
   */
  async function removeMember(userId: string): Promise<void> {
    const generation = identityGeneration
    const workspaceId = activeWorkspaceId.value
    if (!workspaceId) return

    await workspaceApi.removeMember(userId)
    if (isStaleWorkspace(generation, workspaceId)) {
      return
    }
    const current = workspaces.value.find((w) => w.id === workspaceId)
    if (current) {
      updateWorkspace(workspaceId, {
        members: current.members.filter((m) => m.id !== userId)
      })
    }
  }

  /**
   * Change a member's role in the current workspace.
   */
  async function changeMemberRole(
    userId: string,
    role: WorkspaceMember['role']
  ): Promise<void> {
    const generation = identityGeneration
    const workspaceId = activeWorkspaceId.value
    if (!workspaceId) return
    if (
      activeWorkspace.value?.type === 'personal' &&
      userId === originalOwnerId.value
    ) {
      throw new Error("Cannot change the workspace creator's role")
    }
    // Only the role changes; merge it onto the existing row rather than trusting
    // the PATCH response to echo a full Member (a 204/partial body would
    // otherwise drop joined_at / is_original_owner).
    await workspaceApi.updateMemberRole(userId, role)
    if (isStaleWorkspace(generation, workspaceId)) {
      return
    }
    const current = workspaces.value.find((w) => w.id === workspaceId)
    if (current) {
      updateWorkspace(workspaceId, {
        members: current.members.map((m) =>
          m.id === userId ? { ...m, role } : m
        )
      })
    }
  }

  /**
   * Fetch pending invites for the current workspace.
   */
  async function fetchPendingInvites(): Promise<PendingInvite[]> {
    const generation = identityGeneration
    const workspaceId = activeWorkspaceId.value
    if (!workspaceId) return []

    const response = await workspaceApi.listInvites()
    const invites = response.invites.map(mapApiInviteToPendingInvite)
    if (!isStaleWorkspace(generation, workspaceId)) {
      updateWorkspace(workspaceId, { pendingInvites: invites })
    }
    return invites
  }

  /**
   * Create an invite for the current workspace.
   */
  async function createInvite(email: string): Promise<PendingInvite> {
    const generation = identityGeneration
    const workspaceId = activeWorkspaceId.value
    const response = await workspaceApi.createInvite({ email })
    const invite = mapApiInviteToPendingInvite(response)

    if (!workspaceId || isStaleWorkspace(generation, workspaceId)) {
      return invite
    }
    const current = workspaces.value.find((w) => w.id === workspaceId)
    if (current) {
      updateWorkspace(workspaceId, {
        pendingInvites: [...current.pendingInvites, invite]
      })
    }

    return invite
  }

  /**
   * Revoke a pending invite.
   */
  async function revokeInvite(inviteId: string): Promise<void> {
    const generation = identityGeneration
    const workspaceId = activeWorkspaceId.value
    await workspaceApi.revokeInvite(inviteId)
    if (!workspaceId || isStaleWorkspace(generation, workspaceId)) {
      return
    }
    const current = workspaces.value.find((w) => w.id === workspaceId)
    if (current) {
      updateWorkspace(workspaceId, {
        pendingInvites: current.pendingInvites.filter((i) => i.id !== inviteId)
      })
    }
  }

  const resendingInviteIds = new Set<string>()

  /**
   * Resend a pending invite by issuing a fresh one before revoking the old.
   * Create-first so a failed resend never destroys the original invite. If the
   * revoke fails, the store is resynced (so the leftover original surfaces) and
   * the error is rethrown so the caller can report the partial failure rather
   * than show success over two live invites for the same email.
   */
  async function resendInvite(inviteId: string): Promise<PendingInvite> {
    const generation = identityGeneration
    const resendKey = `${generation}:${inviteId}`
    if (resendingInviteIds.has(resendKey)) {
      throw new Error('Invite resend already in progress')
    }
    const invite = activeWorkspace.value?.pendingInvites.find(
      (i) => i.id === inviteId
    )
    if (!invite) {
      throw new Error('Invite not found')
    }
    resendingInviteIds.add(resendKey)
    try {
      const newInvite = await createInvite(invite.email)
      if (isStaleIdentity(generation)) return newInvite
      try {
        await revokeInvite(inviteId)
      } catch (error) {
        if (isStaleIdentity(generation)) throw error
        await fetchPendingInvites()
        throw error
      }
      return newInvite
    } finally {
      resendingInviteIds.delete(resendKey)
    }
  }

  /**
   * Accept a workspace invite.
   * Returns workspace info so UI can offer "View Workspace" button.
   */
  async function acceptInvite(
    token: string
  ): Promise<{ workspaceId: string; workspaceName: string }> {
    const generation = identityGeneration
    const response = await workspaceApi.acceptInvite(token)

    // Refresh workspace list to include newly joined workspace
    if (!isStaleIdentity(generation)) {
      await refreshWorkspaces()
    }

    return {
      workspaceId: response.workspace_id,
      workspaceName: response.workspace_name
    }
  }

  //TODO: when billing lands update this
  function subscribeWorkspace(plan: SubscriptionPlan = 'PRO_MONTHLY') {
    console.warn(plan, 'Billing endpoint has not been added yet.')
  }

  /**
   * Clean up store resources.
   * Delegates to workspaceAuthStore for token cleanup.
   */
  function destroy(): void {
    const workspaceAuthStore = useWorkspaceAuthStore()
    workspaceAuthStore.destroy()
  }

  function resetForIdentityChange(): void {
    identityGeneration++
    initState.value = 'uninitialized'
    workspaces.value = []
    activeWorkspaceId.value = null
    error.value = null
    isCreating.value = false
    isDeleting.value = false
    isSwitching.value = false
    isFetchingWorkspaces.value = false
    loadedMemberWorkspaceIds.clear()
    inFlightMembersRequest = null
    resendingInviteIds.clear()
  }

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
    isCurrentUserOriginalOwner,
    pendingInvites,
    originalOwnerId,
    totalMemberSlots,
    isInviteLimitReached,
    workspaceId,
    workspaceName,
    isWorkspaceSubscribed,
    subscriptionPlan,

    // Initialization & Cleanup
    initialize,
    destroy,
    resetForIdentityChange,
    refreshWorkspaces,

    // Workspace Actions
    switchWorkspace,
    forgetRevokedActiveWorkspace,
    createWorkspace,
    deleteWorkspace,
    renameWorkspace,
    updateWorkspaceName,
    leaveWorkspace,

    // Member Actions
    fetchMembers,
    ensureMembersLoaded,
    removeMember,
    changeMemberRole,

    // Invite Actions
    fetchPendingInvites,
    createInvite,
    revokeInvite,
    resendInvite,
    acceptInvite,

    // Subscription
    subscribeWorkspace,
    updateActiveWorkspace
  }
})

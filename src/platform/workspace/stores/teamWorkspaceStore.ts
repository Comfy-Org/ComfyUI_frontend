import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { isCloud } from '@/platform/distribution/types'
import { WORKSPACE_STORAGE_KEYS } from '@/platform/workspace/workspaceConstants'
import { clearPreservedQuery } from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import {
  clearWorkflowRestoreState,
  prepareWorkflowWorkspaceTransition
} from '@/platform/workflow/persistence/base/storageIO'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'

import type {
  BillingRail,
  CurrentWorkspaceResponse,
  ListMembersParams,
  Member,
  PendingInvite as ApiPendingInvite,
  SubscriptionTier,
  WorkspaceWithRole
} from '../api/workspaceApi'
import { WorkspaceApiError, workspaceApi } from '../api/workspaceApi'

export interface WorkspaceMember {
  id: string
  name: string
  email: string
  joinDate: Date
  role: 'owner' | 'member'
  isOriginalOwner: boolean
  creditsUsedThisMonth?: number
  monthlyCreditLimit?: number | null
}

export interface WorkspacePendingInvite {
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
  pendingInvites: WorkspacePendingInvite[]
}

type InitState = 'uninitialized' | 'loading' | 'ready' | 'error'

function mapApiMemberToWorkspaceMember(member: Member): WorkspaceMember {
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    joinDate: new Date(member.joined_at),
    role: member.role,
    isOriginalOwner: member.is_original_owner ?? false,
    creditsUsedThisMonth: member.credits_used_this_month,
    monthlyCreditLimit: member.monthly_credit_limit
  }
}

function mapApiInviteToPendingInvite(
  invite: ApiPendingInvite
): WorkspacePendingInvite {
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

/**
 * Builds workspace state from GET /api/workspaces/current — the single
 * workspace bound to an API-key credential. The response carries no
 * membership timestamps (only sortWorkspaces reads them, and a one-entry list
 * never sorts) and may omit role, which fails closed to member so owner-only
 * billing actions stay hidden rather than 403 on click.
 */
function createWorkspaceStateFromCredential(
  current: CurrentWorkspaceResponse
): WorkspaceState {
  return createWorkspaceState({
    id: current.id,
    name: current.name,
    type: current.type,
    role: current.role ?? 'member',
    created_at: '',
    joined_at: ''
  })
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
const MAX_INIT_RETRIES = 3
const BASE_RETRY_DELAY_MS = 1000

export const useTeamWorkspaceStore = defineStore('teamWorkspace', () => {
  const initState = ref<InitState>('uninitialized')
  const workspaces = shallowRef<WorkspaceState[]>([])
  const mutableActiveWorkspaceId = ref<string | null>(null)
  const activeWorkspaceId = computed(() => mutableActiveWorkspaceId.value)
  const billingRailByWorkspaceId = shallowRef<Record<string, BillingRail>>({})
  const error = ref<Error | null>(null)

  const isCreating = ref(false)
  const isDeleting = ref(false)
  const isSwitching = ref(false)
  const isFetchingWorkspaces = ref(false)
  const mutableWorkspaceTransitionGeneration = ref(0)
  const workspaceTransitionGeneration = computed(
    () => mutableWorkspaceTransitionGeneration.value
  )
  let identityGeneration = 0
  let initializationPromise: Promise<void> | null = null
  let pendingWorkspaceSwitch: Promise<void> | null = null

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

  const activeWorkspaceBillingRail = computed(() => {
    const workspaceId = activeWorkspaceId.value
    return workspaceId
      ? (billingRailByWorkspaceId.value[workspaceId] ?? null)
      : null
  })

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

  const pendingInvites = computed<WorkspacePendingInvite[]>(
    () => activeWorkspace.value?.pendingInvites ?? []
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

  function setWorkspaceBillingRail(
    workspaceId: string,
    billingRail: BillingRail
  ) {
    billingRailByWorkspaceId.value = {
      ...billingRailByWorkspaceId.value,
      [workspaceId]: billingRail
    }
  }

  /**
   * Initialize the workspace store.
   * Fetches workspaces and resolves the active workspace from session/localStorage.
   * Delegates token management to workspaceAuthStore.
   * Retries on transient failures with exponential backoff.
   * Call once on app boot.
   */
  async function performInitialization(): Promise<void> {
    const generation = identityGeneration
    initState.value = 'loading'
    isFetchingWorkspaces.value = true
    error.value = null

    const workspaceAuthStore = useWorkspaceAuthStore()
    const isApiKeySession = useCurrentUser().isApiKeyLogin.value

    for (let attempt = 0; attempt <= MAX_INIT_RETRIES; attempt++) {
      try {
        // An API-key credential is bound to exactly one workspace on the
        // server. There is no discovery, switching, or token exchange for it:
        // the server echoes the binding back and the key itself authenticates
        // workspace-scoped calls.
        if (isApiKeySession) {
          const current = await workspaceApi.getCurrentWorkspace()
          if (isStaleIdentity(generation)) return
          workspaces.value = [createWorkspaceStateFromCredential(current)]
          mutableActiveWorkspaceId.value = current.id
          initState.value = 'ready'
          isFetchingWorkspaces.value = false
          return
        }

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
            mutableActiveWorkspaceId.value = sessionWorkspaceId
            initState.value = 'ready'
            isFetchingWorkspaces.value = false
            return
          }

          // Session workspace not found (deleted/access revoked) - fallback to default
          if (isCloud) clearWorkflowRestoreState()
          workspaceAuthStore.clearWorkspaceContext()

          const personal = workspaces.value.find((w) => w.type === 'personal')
          const fallbackWorkspaceId = personal?.id ?? workspaces.value[0].id

          await workspaceAuthStore.switchWorkspace(fallbackWorkspaceId)

          if (isStaleIdentity(generation)) return

          mutableActiveWorkspaceId.value = fallbackWorkspaceId
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
        await workspaceAuthStore.switchWorkspace(targetWorkspaceId)

        if (isStaleIdentity(generation)) return

        // 5. Set active workspace
        mutableActiveWorkspaceId.value = targetWorkspaceId
        setLastWorkspaceId(targetWorkspaceId)

        initState.value = 'ready'
        isFetchingWorkspaces.value = false
        return
      } catch (e) {
        if (isStaleIdentity(generation)) return
        const isNoWorkspacesError =
          e instanceof Error && e.message === 'No workspaces available'
        // A definitive 4xx on the credential lookup cannot be repaired by
        // resending the same key; retries stay reserved for transient
        // failures (network, 408/429, 5xx).
        const isPermanentCredentialError =
          isApiKeySession &&
          e instanceof WorkspaceApiError &&
          e.status !== undefined &&
          e.status >= 400 &&
          e.status < 500 &&
          e.status !== 408 &&
          e.status !== 429

        // Don't retry on permanent errors (no workspaces available)
        if (
          isNoWorkspacesError ||
          isPermanentCredentialError ||
          attempt >= MAX_INIT_RETRIES
        ) {
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

  function initialize(): Promise<void> {
    if (initializationPromise) return initializationPromise
    if (initState.value !== 'uninitialized' && initState.value !== 'error') {
      return Promise.resolve()
    }

    const promise = performInitialization()
    initializationPromise = promise
    void promise.then(
      () => {
        if (initializationPromise === promise) initializationPromise = null
      },
      () => {
        if (initializationPromise === promise) initializationPromise = null
      }
    )
    return promise
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

  /** Returns whether the revoked workspace was handled, with or without reload. */
  function forgetRevokedActiveWorkspace(workspaceId: string): boolean {
    if (activeWorkspaceId.value !== workspaceId) return false

    const revoked = workspaces.value.find((w) => w.id === workspaceId)
    if (revoked?.type === 'personal') return true

    if (!isCloud) {
      const personal = workspaces.value.find((w) => w.type === 'personal')
      workspaces.value = workspaces.value.filter((w) => w.id !== workspaceId)
      mutableActiveWorkspaceId.value = personal?.id ?? null
      if (personal) {
        setLastWorkspaceId(personal.id)
      } else {
        clearLastWorkspaceId()
      }
      return true
    }

    prepareWorkflowWorkspaceTransition()
    clearLastWorkspaceId()
    window.location.reload()
    return true
  }

  /**
   * Switch to a different workspace.
   * Clears workspace context and reloads the page.
   */
  async function executeWorkspaceSwitch(workspaceId: string): Promise<void> {
    const generation = identityGeneration
    const workspaceAuthStore = useWorkspaceAuthStore()

    mutableWorkspaceTransitionGeneration.value++
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

      if (!isCloud) {
        await workspaceAuthStore.switchWorkspace(workspaceId)
        if (isStaleIdentity(generation)) return
        if (workspaceAuthStore.currentWorkspace?.id !== workspaceId) {
          throw new Error('Workspace authentication did not switch')
        }
        mutableActiveWorkspaceId.value = workspaceId
        setLastWorkspaceId(workspaceId)
        isSwitching.value = false
        return
      }

      prepareWorkflowWorkspaceTransition()
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

  async function switchWorkspace(workspaceId: string): Promise<void> {
    if (workspaceId === activeWorkspaceId.value) return
    if (!isCloud && isSwitching.value)
      throw new Error('Workspace switch already in progress')

    const workspaceSwitch = executeWorkspaceSwitch(workspaceId)
    pendingWorkspaceSwitch = workspaceSwitch
    try {
      await workspaceSwitch
    } finally {
      if (pendingWorkspaceSwitch === workspaceSwitch) {
        pendingWorkspaceSwitch = null
      }
    }
  }

  function waitForWorkspaceSwitch(): Promise<void> {
    return pendingWorkspaceSwitch ?? Promise.resolve()
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
      prepareWorkflowWorkspaceTransition()
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
        prepareWorkflowWorkspaceTransition()
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
    prepareWorkflowWorkspaceTransition()
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
    params: ListMembersParams = {}
  ): Promise<WorkspaceMember[]> {
    const generation = identityGeneration
    const workspaceId = activeWorkspaceId.value
    if (!workspaceId) return []

    const response = await workspaceApi.listMembers({
      ...params,
      limit: params.limit ?? 100
    })
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
   * Set or clear a member's monthly credit limit. Local-only until backend
   * persistence lands in FE-1278; `null` removes the cap.
   */
  function setMemberCreditLimit(userId: string, limit: number | null): void {
    const current = activeWorkspace.value
    if (!current) return
    updateActiveWorkspace({
      members: current.members.map((m) =>
        m.id === userId ? { ...m, monthlyCreditLimit: limit } : m
      )
    })
  }

  /**
   * Fetch pending invites for the current workspace.
   */
  async function fetchPendingInvites(): Promise<WorkspacePendingInvite[]> {
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
  async function createInvite(email: string): Promise<WorkspacePendingInvite> {
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

  async function resendInvite(
    inviteId: string
  ): Promise<WorkspacePendingInvite> {
    const generation = identityGeneration
    const resendKey = `${generation}:${inviteId}`
    if (resendingInviteIds.has(resendKey)) {
      throw new Error('Invite resend already in progress')
    }
    const workspace = activeWorkspace.value
    if (!workspace?.pendingInvites.some((invite) => invite.id === inviteId)) {
      throw new Error('Invite not found')
    }
    resendingInviteIds.add(resendKey)
    try {
      const refreshed = mapApiInviteToPendingInvite(
        await workspaceApi.resendInvite(inviteId)
      )
      if (isStaleIdentity(generation)) return refreshed
      const currentWorkspace = workspaces.value.find(
        (candidate) => candidate.id === workspace.id
      )
      if (currentWorkspace) {
        updateWorkspace(workspace.id, {
          pendingInvites: currentWorkspace.pendingInvites.map((invite) =>
            invite.id === inviteId ? refreshed : invite
          )
        })
      }
      return refreshed
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
    mutableWorkspaceTransitionGeneration.value++
    pendingWorkspaceSwitch = null
    initializationPromise = null
    initState.value = 'uninitialized'
    workspaces.value = []
    mutableActiveWorkspaceId.value = null
    billingRailByWorkspaceId.value = {}
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
    workspaceTransitionGeneration,
    error,
    isCreating,
    isDeleting,
    isSwitching,
    isFetchingWorkspaces,

    // Computed
    activeWorkspace,
    personalWorkspace,
    isInPersonalWorkspace,
    activeWorkspaceBillingRail,
    sharedWorkspaces,
    ownedWorkspacesCount,
    canCreateWorkspace,
    members,
    isCurrentUserOriginalOwner,
    pendingInvites,
    originalOwnerId,
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
    waitForWorkspaceSwitch,
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
    setMemberCreditLimit,

    // Invite Actions
    fetchPendingInvites,
    createInvite,
    revokeInvite,
    resendInvite,
    acceptInvite,

    // Subscription
    subscribeWorkspace,
    updateActiveWorkspace,
    setWorkspaceBillingRail
  }
})

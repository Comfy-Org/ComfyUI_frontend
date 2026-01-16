import { computed, ref, shallowRef } from 'vue'
import { createSharedComposable } from '@vueuse/core'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import type {
  WorkspaceRole,
  WorkspaceType,
  WorkspaceWithRole
} from '../api/workspaceApi'

// Re-export API types for consumers
export type { WorkspaceRole, WorkspaceType, WorkspaceWithRole }

// Extended member type for UI (adds joinDate as Date)
export interface WorkspaceMember {
  id: string
  name: string
  email: string
  role?: WorkspaceRole
  joinDate: Date
}

// Extended invite type for UI (adds dates as Date objects)
export interface PendingInvite {
  id: string
  name: string
  email: string
  inviteDate: Date
  expiryDate: Date
  inviteLink: string
}

type SubscriptionPlan = 'PRO_MONTHLY' | 'PRO_YEARLY' | null

interface WorkspaceState extends WorkspaceWithRole {
  isSubscribed: boolean
  subscriptionPlan: SubscriptionPlan
  members: WorkspaceMember[]
  pendingInvites: PendingInvite[]
}

export interface AvailableWorkspace {
  id: string | null
  name: string
  type: WorkspaceType
  role: WorkspaceRole
}

/** Permission flags for workspace actions */
interface WorkspacePermissions {
  canViewOtherMembers: boolean
  canViewPendingInvites: boolean
  canInviteMembers: boolean
  canManageInvites: boolean
  canRemoveMembers: boolean
  canLeaveWorkspace: boolean
  canAccessWorkspaceMenu: boolean
  canManageSubscription: boolean
}

/** UI configuration for workspace role */
interface WorkspaceUIConfig {
  showMembersList: boolean
  showPendingTab: boolean
  showSearch: boolean
  showDateColumn: boolean
  showRoleBadge: boolean
  membersGridCols: string
  pendingGridCols: string
  headerGridCols: string
  showEditWorkspaceMenuItem: boolean
  workspaceMenuAction: 'leave' | 'delete' | null
  workspaceMenuDisabledTooltip: string | null
}

// Role-based permissions mapping
// Note: 'personal' type workspaces have owner role with restricted permissions
function getPermissions(
  type: WorkspaceType,
  role: WorkspaceRole
): WorkspacePermissions {
  if (type === 'personal') {
    return {
      canViewOtherMembers: false,
      canViewPendingInvites: false,
      canInviteMembers: false,
      canManageInvites: false,
      canRemoveMembers: false,
      canLeaveWorkspace: false,
      canAccessWorkspaceMenu: true,
      canManageSubscription: true
    }
  }

  if (role === 'owner') {
    return {
      canViewOtherMembers: true,
      canViewPendingInvites: true,
      canInviteMembers: true,
      canManageInvites: true,
      canRemoveMembers: true,
      canLeaveWorkspace: true,
      canAccessWorkspaceMenu: true,
      canManageSubscription: true
    }
  }

  // member role
  return {
    canViewOtherMembers: true,
    canViewPendingInvites: false,
    canInviteMembers: false,
    canManageInvites: false,
    canRemoveMembers: false,
    canLeaveWorkspace: true,
    canAccessWorkspaceMenu: true,
    canManageSubscription: false
  }
}

function getUIConfig(
  type: WorkspaceType,
  role: WorkspaceRole
): WorkspaceUIConfig {
  if (type === 'personal') {
    return {
      showMembersList: false,
      showPendingTab: false,
      showSearch: false,
      showDateColumn: false,
      showRoleBadge: false,
      membersGridCols: 'grid-cols-1',
      pendingGridCols: 'grid-cols-[50%_20%_20%_10%]',
      headerGridCols: 'grid-cols-1',
      showEditWorkspaceMenuItem: true,
      workspaceMenuAction: null,
      workspaceMenuDisabledTooltip: null
    }
  }

  if (role === 'owner') {
    return {
      showMembersList: true,
      showPendingTab: true,
      showSearch: true,
      showDateColumn: true,
      showRoleBadge: true,
      membersGridCols: 'grid-cols-[50%_40%_10%]',
      pendingGridCols: 'grid-cols-[50%_20%_20%_10%]',
      headerGridCols: 'grid-cols-[50%_40%_10%]',
      showEditWorkspaceMenuItem: true,
      workspaceMenuAction: 'delete',
      workspaceMenuDisabledTooltip:
        'workspacePanel.menu.deleteWorkspaceDisabledTooltip'
    }
  }

  // member role
  return {
    showMembersList: true,
    showPendingTab: false,
    showSearch: true,
    showDateColumn: true,
    showRoleBadge: true,
    membersGridCols: 'grid-cols-[1fr_auto]',
    pendingGridCols: 'grid-cols-[50%_20%_20%_10%]',
    headerGridCols: 'grid-cols-[1fr_auto]',
    showEditWorkspaceMenuItem: false,
    workspaceMenuAction: 'leave',
    workspaceMenuDisabledTooltip: null
  }
}

const MAX_OWNED_WORKSPACES = 10
const MAX_WORKSPACE_MEMBERS = 50

function generateId(): string {
  return Math.random().toString(36).substring(2, 10)
}

function createPersonalWorkspace(): WorkspaceState {
  return {
    id: 'personal',
    name: 'Personal workspace',
    type: 'personal',
    role: 'owner',
    isSubscribed: true,
    subscriptionPlan: null,
    members: [],
    pendingInvites: []
  }
}

// =============================================================================
// MODULE-LEVEL STATE
// Persists across component lifecycle - not disposed when components unmount
// =============================================================================
const _workspaces = shallowRef<WorkspaceState[]>([createPersonalWorkspace()])
const _currentWorkspaceIndex = ref(0)
const _activeTab = ref<string>('plan')

// Helper to get current workspace
function getCurrentWorkspace(): WorkspaceState {
  return _workspaces.value[_currentWorkspaceIndex.value]
}

// Helper to update current workspace immutably
function updateCurrentWorkspace(updates: Partial<WorkspaceState>) {
  const index = _currentWorkspaceIndex.value
  const updated = { ..._workspaces.value[index], ...updates }
  _workspaces.value = [
    ..._workspaces.value.slice(0, index),
    updated,
    ..._workspaces.value.slice(index + 1)
  ]
}

/**
 * Internal composable implementation for workspace management.
 * Uses module-level state to persist across component lifecycle.
 * Will integrate with useWorkspaceAuth once that PR lands.
 */
function useWorkspaceInternal() {
  const { userDisplayName, userEmail } = useCurrentUser()

  // Computed properties derived from module-level state
  const currentWorkspace = computed(() => getCurrentWorkspace())
  const workspaceId = computed(() => currentWorkspace.value?.id ?? null)
  const workspaceName = computed(
    () => currentWorkspace.value?.name ?? 'Personal workspace'
  )
  const workspaceType = computed(
    () => currentWorkspace.value?.type ?? 'personal'
  )
  const workspaceRole = computed(() => currentWorkspace.value?.role ?? 'owner')
  const activeTab = computed(() => _activeTab.value)

  const isPersonalWorkspace = computed(
    () => currentWorkspace.value?.type === 'personal'
  )

  const isWorkspaceSubscribed = computed(
    () => currentWorkspace.value?.isSubscribed ?? false
  )

  const subscriptionPlan = computed(
    () => currentWorkspace.value?.subscriptionPlan ?? null
  )

  const permissions = computed<WorkspacePermissions>(() =>
    getPermissions(workspaceType.value, workspaceRole.value)
  )

  const uiConfig = computed<WorkspaceUIConfig>(() =>
    getUIConfig(workspaceType.value, workspaceRole.value)
  )

  // For personal workspace, always show current user as the only member
  const members = computed<WorkspaceMember[]>(() => {
    if (isPersonalWorkspace.value) {
      return [
        {
          id: 'current-user',
          name: userDisplayName.value ?? 'You',
          email: userEmail.value ?? '',
          role: 'owner',
          joinDate: new Date()
        }
      ]
    }
    return currentWorkspace.value?.members ?? []
  })

  const pendingInvites = computed(
    () => currentWorkspace.value?.pendingInvites ?? []
  )

  const totalMemberSlots = computed(
    () => members.value.length + pendingInvites.value.length
  )

  const isInviteLimitReached = computed(
    () => totalMemberSlots.value >= MAX_WORKSPACE_MEMBERS
  )

  const availableWorkspaces = computed<AvailableWorkspace[]>(() =>
    _workspaces.value.map((w) => ({
      id: w.id,
      name: w.name,
      type: w.type,
      role: w.role
    }))
  )

  const ownedWorkspacesCount = computed(
    () => _workspaces.value.filter((w) => w.role === 'owner').length
  )

  const canCreateWorkspace = computed(
    () => ownedWorkspacesCount.value < MAX_OWNED_WORKSPACES
  )

  // Tab management
  function setActiveTab(tab: string | number) {
    _activeTab.value = String(tab)
  }

  /**
   * Switch to a different workspace by ID.
   * TODO: Integrate with useWorkspaceAuth.switchWorkspace() when PR lands
   */
  function switchWorkspace(workspace: AvailableWorkspace) {
    const index = _workspaces.value.findIndex((w) => w.id === workspace.id)
    if (index !== -1) {
      _currentWorkspaceIndex.value = index
    }
  }

  /**
   * Create a new workspace.
   * TODO: Replace with workspaceApi.create() call
   */
  function createWorkspace(name: string): WorkspaceState {
    const newWorkspace: WorkspaceState = {
      id: `workspace-${generateId()}`,
      name,
      type: 'team',
      role: 'owner',
      isSubscribed: false,
      subscriptionPlan: null,
      members: [],
      pendingInvites: [
        // Stub invite for testing
        {
          id: generateId(),
          name: 'PendingUser',
          email: 'pending@example.com',
          inviteDate: new Date(),
          expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          inviteLink: `https://cloud.comfy.org/workspace/invite/${generateId()}`
        }
      ]
    }

    _workspaces.value = [..._workspaces.value, newWorkspace]
    _currentWorkspaceIndex.value = _workspaces.value.length - 1

    return newWorkspace
  }

  /**
   * Subscribe the current workspace to a plan.
   * TODO: Replace with subscription API call
   */
  function subscribeWorkspace(plan: SubscriptionPlan = 'PRO_MONTHLY') {
    updateCurrentWorkspace({
      isSubscribed: true,
      subscriptionPlan: plan
    })
  }

  /**
   * Delete the current workspace (owner only).
   * TODO: Replace with workspaceApi.delete() call
   */
  function deleteWorkspace() {
    const current = getCurrentWorkspace()
    if (current.role === 'owner' && current.type === 'team') {
      _workspaces.value = _workspaces.value.filter((w) => w.id !== current.id)
      _currentWorkspaceIndex.value = 0
    }
  }

  /**
   * Leave the current workspace (member only).
   * TODO: Replace with workspaceApi.leave() call
   */
  function leaveWorkspace() {
    const current = getCurrentWorkspace()
    if (current.role === 'member') {
      _workspaces.value = _workspaces.value.filter((w) => w.id !== current.id)
      _currentWorkspaceIndex.value = 0
    }
  }

  /**
   * Update workspace name.
   * TODO: Replace with workspaceApi.update() call
   */
  function updateWorkspaceName(name: string) {
    updateCurrentWorkspace({ name })
  }

  /**
   * Add a member to the current workspace.
   * TODO: This happens via invite acceptance on backend
   */
  function addMember(member: Omit<WorkspaceMember, 'id' | 'joinDate'>) {
    const current = getCurrentWorkspace()
    const newMember: WorkspaceMember = {
      ...member,
      id: generateId(),
      joinDate: new Date()
    }
    updateCurrentWorkspace({
      members: [...current.members, newMember]
    })
  }

  /**
   * Remove a member from the current workspace.
   * TODO: Replace with workspaceApi.removeMember() call
   */
  function removeMember(memberId: string) {
    const current = getCurrentWorkspace()
    updateCurrentWorkspace({
      members: current.members.filter((m) => m.id !== memberId)
    })
  }

  /**
   * Revoke a pending invite.
   * TODO: Replace with workspaceApi.revokeInvite() call
   */
  function revokeInvite(inviteId: string) {
    const current = getCurrentWorkspace()
    updateCurrentWorkspace({
      pendingInvites: current.pendingInvites.filter((i) => i.id !== inviteId)
    })
  }

  /**
   * Accept a pending invite (for demo/testing).
   */
  function acceptInvite(inviteId: string) {
    const current = getCurrentWorkspace()
    const invite = current.pendingInvites.find((i) => i.id === inviteId)
    if (invite) {
      const updatedPending = current.pendingInvites.filter(
        (i) => i.id !== inviteId
      )
      const newMember: WorkspaceMember = {
        id: generateId(),
        name: invite.name,
        email: invite.email,
        role: 'member',
        joinDate: new Date()
      }
      updateCurrentWorkspace({
        pendingInvites: updatedPending,
        members: [...current.members, newMember]
      })
    }
  }

  // Async API methods (stubs for now)

  async function fetchMembers(): Promise<WorkspaceMember[]> {
    // TODO: Replace with workspaceApi.get() call
    return members.value
  }

  async function fetchPendingInvites(): Promise<PendingInvite[]> {
    // TODO: Replace with workspaceApi.get() call
    return pendingInvites.value
  }

  async function copyInviteLink(inviteId: string): Promise<string> {
    const invite = pendingInvites.value.find((i) => i.id === inviteId)
    if (invite) {
      await navigator.clipboard.writeText(invite.inviteLink)
      return invite.inviteLink
    }
    throw new Error('Invite not found')
  }

  /**
   * Copy invite link and simulate member accepting (for demo).
   */
  async function copyInviteLinkAndAccept(inviteId: string): Promise<string> {
    const invite = pendingInvites.value.find((i) => i.id === inviteId)
    if (invite) {
      await navigator.clipboard.writeText(invite.inviteLink)
      revokeInvite(inviteId)
      addMember({
        name: invite.name,
        email: invite.email,
        role: 'member'
      })
      return invite.inviteLink
    }
    throw new Error('Invite not found')
  }

  /**
   * Create an invite link for a given email.
   * TODO: Replace with workspaceApi.createInvite() call
   */
  async function createInviteLink(email: string): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, 500))

    const inviteId = generateId()
    const inviteLink = `https://cloud.comfy.org/workspace/invite/${inviteId}`

    const current = getCurrentWorkspace()
    const newInvite: PendingInvite = {
      id: inviteId,
      name: email.split('@')[0],
      email,
      inviteDate: new Date(),
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      inviteLink
    }
    updateCurrentWorkspace({
      pendingInvites: [...current.pendingInvites, newInvite]
    })

    return inviteLink
  }

  // Dev helpers for testing UI states
  function setMockRole(role: WorkspaceRole) {
    updateCurrentWorkspace({ role })
  }

  function setMockSubscribed(subscribed: boolean) {
    updateCurrentWorkspace({ isSubscribed: subscribed })
  }

  function setMockType(type: WorkspaceType) {
    updateCurrentWorkspace({ type })
  }

  // Expose to window for dev testing
  if (typeof window !== 'undefined') {
    const w = window as Window & {
      __setWorkspaceRole?: typeof setMockRole
      __setWorkspaceSubscribed?: typeof setMockSubscribed
      __setWorkspaceType?: typeof setMockType
    }
    w.__setWorkspaceRole = setMockRole
    w.__setWorkspaceSubscribed = setMockSubscribed
    w.__setWorkspaceType = setMockType
  }

  return {
    // Current workspace state
    workspaceId,
    workspaceName,
    workspaceType,
    workspaceRole,
    activeTab,
    isPersonalWorkspace,
    isWorkspaceSubscribed,
    subscriptionPlan,
    permissions,
    uiConfig,

    // Tab management
    setActiveTab,

    // Workspace switching/management
    availableWorkspaces,
    ownedWorkspacesCount,
    canCreateWorkspace,
    switchWorkspace,
    createWorkspace,
    subscribeWorkspace,
    deleteWorkspace,
    leaveWorkspace,
    updateWorkspaceName,

    // Members
    members,
    pendingInvites,
    totalMemberSlots,
    isInviteLimitReached,
    fetchMembers,
    fetchPendingInvites,
    revokeInvite,
    acceptInvite,
    copyInviteLink,
    copyInviteLinkAndAccept,
    createInviteLink,
    addMember,
    removeMember,

    // Dev helpers
    setMockRole,
    setMockSubscribed,
    setMockType
  }
}

/**
 * Shared composable for workspace management.
 * Uses module-level state to persist across component lifecycle.
 * The createSharedComposable wrapper ensures computed properties
 * are shared efficiently across components.
 *
 * Future integration:
 * - Will consume useWorkspaceAuth for authentication context
 * - Will use workspaceApi for backend calls
 */
export const useWorkspace = createSharedComposable(useWorkspaceInternal)

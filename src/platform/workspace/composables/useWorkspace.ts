import { computed, ref, shallowRef } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'

type WorkspaceRole = 'PERSONAL' | 'MEMBER' | 'OWNER'
type SubscriptionPlan = 'PRO_MONTHLY' | 'PRO_YEARLY' | null

export interface WorkspaceMember {
  id: string
  name: string
  email: string
  joinDate: Date
}

export interface PendingInvite {
  id: string
  name: string
  email: string
  inviteDate: Date
  expiryDate: Date
  inviteLink: string
}

interface Workspace {
  id: string | null
  name: string
  role: WorkspaceRole
  isSubscribed: boolean
  subscriptionPlan: SubscriptionPlan
  members: WorkspaceMember[]
  pendingInvites: PendingInvite[]
}

export interface AvailableWorkspace {
  id: string | null
  name: string
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

const ROLE_PERMISSIONS: Record<WorkspaceRole, WorkspacePermissions> = {
  PERSONAL: {
    canViewOtherMembers: false,
    canViewPendingInvites: false,
    canInviteMembers: false,
    canManageInvites: false,
    canRemoveMembers: false,
    canLeaveWorkspace: false,
    canAccessWorkspaceMenu: true,
    canManageSubscription: true
  },
  MEMBER: {
    canViewOtherMembers: true,
    canViewPendingInvites: false,
    canInviteMembers: false,
    canManageInvites: false,
    canRemoveMembers: false,
    canLeaveWorkspace: true,
    canAccessWorkspaceMenu: true,
    canManageSubscription: false
  },
  OWNER: {
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

const ROLE_UI_CONFIG: Record<WorkspaceRole, WorkspaceUIConfig> = {
  PERSONAL: {
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
  },
  MEMBER: {
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
  },
  OWNER: {
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

const MAX_OWNED_WORKSPACES = 10
const MAX_WORKSPACE_MEMBERS = 50

function generateId(): string {
  return Math.random().toString(36).substring(2, 10)
}

function createPersonalWorkspace(): Workspace {
  return {
    id: null,
    name: 'Personal workspace',
    role: 'PERSONAL',
    isSubscribed: true,
    subscriptionPlan: null,
    members: [],
    pendingInvites: []
  }
}

// Global state - start with personal workspace only
const _workspaces = shallowRef<Workspace[]>([createPersonalWorkspace()])
const _currentWorkspaceIndex = ref(0)
const _activeTab = ref<string>('plan')

// Helper to get current workspace
function getCurrentWorkspace(): Workspace {
  return _workspaces.value[_currentWorkspaceIndex.value]
}

// Helper to update current workspace
function updateCurrentWorkspace(updates: Partial<Workspace>) {
  const index = _currentWorkspaceIndex.value
  const updated = { ..._workspaces.value[index], ...updates }
  _workspaces.value = [
    ..._workspaces.value.slice(0, index),
    updated,
    ..._workspaces.value.slice(index + 1)
  ]
}

/**
 * Switch to a different workspace
 */
function switchWorkspace(workspace: AvailableWorkspace) {
  const index = _workspaces.value.findIndex((w) => w.id === workspace.id)
  if (index !== -1) {
    _currentWorkspaceIndex.value = index
  }
}

/**
 * Create a new workspace
 */
function createNewWorkspace(name: string): Workspace {
  const newWorkspace: Workspace = {
    id: `workspace-${generateId()}`,
    name,
    role: 'OWNER',
    isSubscribed: false,
    subscriptionPlan: null,
    members: [],
    pendingInvites: [
      // Add one pending invite for testing revoke
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
  // Switch to the new workspace
  _currentWorkspaceIndex.value = _workspaces.value.length - 1

  return newWorkspace
}

/**
 * Subscribe the current workspace to a plan
 */
function subscribeCurrentWorkspace(plan: SubscriptionPlan = 'PRO_MONTHLY') {
  updateCurrentWorkspace({
    isSubscribed: true,
    subscriptionPlan: plan
  })
}

/**
 * Delete the current workspace (OWNER only)
 */
function deleteCurrentWorkspace() {
  const current = getCurrentWorkspace()
  if (current.role === 'OWNER') {
    _workspaces.value = _workspaces.value.filter((w) => w.id !== current.id)
    _currentWorkspaceIndex.value = 0
  }
}

/**
 * Leave the current workspace (MEMBER only)
 */
function leaveCurrentWorkspace() {
  const current = getCurrentWorkspace()
  if (current.role === 'MEMBER') {
    _workspaces.value = _workspaces.value.filter((w) => w.id !== current.id)
    _currentWorkspaceIndex.value = 0
  }
}

/**
 * Add a member to the current workspace
 */
function addMemberToWorkspace(
  member: Omit<WorkspaceMember, 'id' | 'joinDate'>
) {
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
 * Remove a member from the current workspace
 */
function removeMemberFromWorkspace(memberId: string) {
  const current = getCurrentWorkspace()
  updateCurrentWorkspace({
    members: current.members.filter((m) => m.id !== memberId)
  })
}

/**
 * Update the current workspace name
 */
function updateWorkspaceNameFn(name: string) {
  updateCurrentWorkspace({ name })
}

/**
 * Revoke a pending invite
 */
function revokePendingInvite(inviteId: string) {
  const current = getCurrentWorkspace()
  updateCurrentWorkspace({
    pendingInvites: current.pendingInvites.filter((i) => i.id !== inviteId)
  })
}

/**
 * Accept a pending invite (move to active members)
 * For demo: simulates user accepting the invite
 */
function acceptPendingInvite(inviteId: string) {
  const current = getCurrentWorkspace()
  const invite = current.pendingInvites.find((i) => i.id === inviteId)
  if (invite) {
    // Remove from pending
    const updatedPending = current.pendingInvites.filter(
      (i) => i.id !== inviteId
    )
    // Add to active members
    const newMember: WorkspaceMember = {
      id: generateId(),
      name: invite.name,
      email: invite.email,
      joinDate: new Date()
    }
    updateCurrentWorkspace({
      pendingInvites: updatedPending,
      members: [...current.members, newMember]
    })
  }
}

/**
 * Set workspace mock state for testing UI
 * Usage in browser console: window.__setWorkspaceRole('OWNER')
 */
function setMockRole(role: WorkspaceRole) {
  updateCurrentWorkspace({ role })
}

/**
 * Set workspace subscription state for testing UI
 * Usage in browser console: window.__setWorkspaceSubscribed(false)
 */
function setMockSubscribed(subscribed: boolean) {
  updateCurrentWorkspace({ isSubscribed: subscribed })
}

// Expose to window for dev testing
if (typeof window !== 'undefined') {
  ;(
    window as Window & {
      __setWorkspaceRole?: typeof setMockRole
      __setWorkspaceSubscribed?: typeof setMockSubscribed
    }
  ).__setWorkspaceRole = setMockRole
  ;(
    window as Window & { __setWorkspaceSubscribed?: typeof setMockSubscribed }
  ).__setWorkspaceSubscribed = setMockSubscribed
}

/**
 * Composable for handling workspace data
 * TODO: Replace stubbed data with actual API call
 */
export function useWorkspace() {
  const { userDisplayName, userEmail } = useCurrentUser()

  // Computed from current workspace
  const currentWorkspace = computed(() => getCurrentWorkspace())
  const workspaceId = computed(() => currentWorkspace.value?.id ?? null)
  const workspaceName = computed(
    () => currentWorkspace.value?.name ?? 'Personal workspace'
  )
  const workspaceRole = computed(
    () => currentWorkspace.value?.role ?? 'PERSONAL'
  )
  const activeTab = computed(() => _activeTab.value)

  const isPersonalWorkspace = computed(
    () => currentWorkspace.value?.role === 'PERSONAL'
  )

  const isWorkspaceSubscribed = computed(
    () => currentWorkspace.value?.isSubscribed ?? false
  )

  const subscriptionPlan = computed(
    () => currentWorkspace.value?.subscriptionPlan ?? null
  )

  const permissions = computed<WorkspacePermissions>(
    () => ROLE_PERMISSIONS[workspaceRole.value]
  )

  const uiConfig = computed<WorkspaceUIConfig>(
    () => ROLE_UI_CONFIG[workspaceRole.value]
  )

  function setActiveTab(tab: string | number) {
    _activeTab.value = String(tab)
  }

  // For personal workspace, always show current user as the only member
  const members = computed<WorkspaceMember[]>(() => {
    if (isPersonalWorkspace.value) {
      return [
        {
          id: 'current-user',
          name: userDisplayName.value ?? 'You',
          email: userEmail.value ?? '',
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

  // Fetch members - returns current user for personal workspace
  async function fetchMembers(): Promise<WorkspaceMember[]> {
    if (isPersonalWorkspace.value) {
      return [
        {
          id: 'current-user',
          name: userDisplayName.value ?? 'You',
          email: userEmail.value ?? '',
          joinDate: new Date()
        }
      ]
    }
    return members.value
  }

  async function fetchPendingInvites(): Promise<PendingInvite[]> {
    return pendingInvites.value
  }

  async function revokeInvite(inviteId: string): Promise<void> {
    revokePendingInvite(inviteId)
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
   * Copy invite link and simulate member accepting (for demo)
   * When copy link is clicked, the invited user "accepts" and becomes a member
   */
  async function copyInviteLinkAndAccept(inviteId: string): Promise<string> {
    const invite = pendingInvites.value.find((i) => i.id === inviteId)
    if (invite) {
      await navigator.clipboard.writeText(invite.inviteLink)

      // Simulate user accepting invite: move from pending to active
      revokePendingInvite(inviteId)
      addMemberToWorkspace({
        name: invite.name,
        email: invite.email
      })

      return invite.inviteLink
    }
    throw new Error('Invite not found')
  }

  /**
   * Create an invite link for a given email
   */
  async function createInviteLink(email: string): Promise<string> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500))

    const inviteId = generateId()
    const inviteLink = `https://cloud.comfy.org/workspace/invite/${inviteId}`

    // Add to pending invites
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

  const availableWorkspaces = computed<AvailableWorkspace[]>(() =>
    _workspaces.value.map((w) => ({
      id: w.id,
      name: w.name,
      role: w.role
    }))
  )
  const ownedWorkspacesCount = computed(
    () => _workspaces.value.filter((w) => w.role === 'OWNER').length
  )
  const canCreateWorkspace = computed(
    () => ownedWorkspacesCount.value < MAX_OWNED_WORKSPACES
  )

  return {
    workspaceId,
    workspaceName,
    workspaceRole,
    activeTab,
    isPersonalWorkspace,
    isWorkspaceSubscribed,
    subscriptionPlan,
    permissions,
    uiConfig,
    setActiveTab,
    // Workspace switching
    availableWorkspaces,
    ownedWorkspacesCount,
    canCreateWorkspace,
    switchWorkspace,
    // Workspace management
    createWorkspace: createNewWorkspace,
    subscribeWorkspace: subscribeCurrentWorkspace,
    deleteWorkspace: deleteCurrentWorkspace,
    leaveWorkspace: leaveCurrentWorkspace,
    // Members
    members,
    pendingInvites,
    totalMemberSlots,
    isInviteLimitReached,
    fetchMembers,
    fetchPendingInvites,
    revokeInvite,
    acceptInvite: acceptPendingInvite,
    copyInviteLink,
    copyInviteLinkAndAccept,
    createInviteLink,
    addMember: addMemberToWorkspace,
    removeMember: removeMemberFromWorkspace,
    updateWorkspaceName: updateWorkspaceNameFn,
    // Dev helpers
    setMockRole,
    setMockSubscribed
  }
}

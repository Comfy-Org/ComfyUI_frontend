import { computed, ref } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'

export type WorkspaceRole = 'PERSONAL' | 'MEMBER' | 'OWNER'

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

interface WorkspaceMockData {
  id: string | null
  name: string
  role: WorkspaceRole
}

export interface AvailableWorkspace {
  id: string | null
  name: string
  role: WorkspaceRole
}

/** Permission flags for workspace actions */
export interface WorkspacePermissions {
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
export interface WorkspaceUIConfig {
  showMembersList: boolean
  showPendingTab: boolean
  showSearch: boolean
  showDateColumn: boolean
  showRoleBadge: boolean
  membersGridCols: string
  pendingGridCols: string
  headerGridCols: string
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
    canAccessWorkspaceMenu: false,
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
    workspaceMenuAction: 'delete',
    workspaceMenuDisabledTooltip:
      'workspacePanel.menu.deleteWorkspaceDisabledTooltip'
  }
}

const MOCK_DATA: Record<WorkspaceRole, WorkspaceMockData> = {
  PERSONAL: {
    id: null,
    name: 'Personal',
    role: 'PERSONAL'
  },
  MEMBER: {
    id: 'workspace-abc-123',
    name: 'Acme Corp',
    role: 'MEMBER'
  },
  OWNER: {
    id: 'workspace-xyz-789',
    name: 'Acme Corp',
    role: 'OWNER'
  }
}

/** Mock list of all available workspaces for the current user */
const MOCK_AVAILABLE_WORKSPACES: AvailableWorkspace[] = [
  { id: null, name: 'Personal workspace', role: 'PERSONAL' },
  { id: 'workspace-comfy-001', name: 'Team Comfy', role: 'OWNER' },
  { id: 'workspace-orange-002', name: 'OrangeDesignStudio', role: 'MEMBER' },
  { id: 'workspace-001', name: 'Workspace001', role: 'MEMBER' },
  { id: 'workspace-002', name: 'Workspace002', role: 'MEMBER' }
]

const MAX_OWNED_WORKSPACES = 10

const MOCK_MEMBERS: WorkspaceMember[] = [
  {
    id: '1',
    name: 'Alice',
    email: 'alice@example.com',
    joinDate: new Date('2025-11-15')
  },
  {
    id: '2',
    name: 'Bob',
    email: 'bob@example.com',
    joinDate: new Date('2025-12-01')
  },
  {
    id: '3',
    name: 'Charlie',
    email: 'charlie@example.com',
    joinDate: new Date('2026-01-05')
  }
]

const MOCK_PENDING_INVITES: PendingInvite[] = [
  {
    id: '1',
    name: 'John',
    email: 'john@gmail.com',
    inviteDate: new Date('2026-01-02'),
    expiryDate: new Date('2026-01-09'),
    inviteLink: 'https://example.com/invite/abc123'
  },
  {
    id: '2',
    name: 'User102',
    email: 'user102@gmail.com',
    inviteDate: new Date('2026-01-01'),
    expiryDate: new Date('2026-01-08'),
    inviteLink: 'https://example.com/invite/def456'
  },
  {
    id: '3',
    name: 'User944',
    email: 'user944@gmail.com',
    inviteDate: new Date('2026-01-01'),
    expiryDate: new Date('2026-01-08'),
    inviteLink: 'https://example.com/invite/ghi789'
  },
  {
    id: '4',
    name: 'User45',
    email: 'user45@gmail.com',
    inviteDate: new Date('2025-12-15'),
    expiryDate: new Date('2025-12-22'),
    inviteLink: 'https://example.com/invite/jkl012'
  },
  {
    id: '5',
    name: 'User944',
    email: 'user944@gmail.com',
    inviteDate: new Date('2025-12-05'),
    expiryDate: new Date('2025-12-22'),
    inviteLink: 'https://example.com/invite/mno345'
  }
]

// Constants
const MAX_WORKSPACE_MEMBERS = 50

// Shared state for workspace
const _workspaceId = ref<string | null>(null)
const _workspaceName = ref<string>('Personal workspace')
const _workspaceRole = ref<WorkspaceRole>('PERSONAL')
const _isWorkspaceSubscribed = ref<boolean>(true)
const _activeTab = ref<string>('plan')
const _members = ref<WorkspaceMember[]>([])
const _pendingInvites = ref<PendingInvite[]>([])
const _availableWorkspaces = ref<AvailableWorkspace[]>(
  MOCK_AVAILABLE_WORKSPACES
)

/**
 * Set workspace mock state for testing UI
 * Usage in browser console: window.__setWorkspaceRole('OWNER')
 */
function setMockRole(role: WorkspaceRole) {
  const data = MOCK_DATA[role]
  _workspaceId.value = data.id
  _workspaceName.value = data.name
  _workspaceRole.value = data.role
}

/**
 * Set workspace subscription state for testing UI
 * Usage in browser console: window.__setWorkspaceSubscribed(false)
 */
function setMockSubscribed(subscribed: boolean) {
  _isWorkspaceSubscribed.value = subscribed
}

/**
 * Switch to a different workspace
 */
function switchWorkspace(workspace: AvailableWorkspace) {
  _workspaceId.value = workspace.id
  _workspaceName.value = workspace.name
  _workspaceRole.value = workspace.role
  // Reset members/invites when switching
  _members.value = []
  _pendingInvites.value = []
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

  const workspaceId = computed(() => _workspaceId.value)
  const workspaceName = computed(() => _workspaceName.value)
  const workspaceRole = computed(() => _workspaceRole.value)
  const activeTab = computed(() => _activeTab.value)

  const isPersonalWorkspace = computed(
    () => _workspaceRole.value === 'PERSONAL'
  )

  const isWorkspaceSubscribed = computed(() => _isWorkspaceSubscribed.value)

  const permissions = computed<WorkspacePermissions>(
    () => ROLE_PERMISSIONS[_workspaceRole.value]
  )

  const uiConfig = computed<WorkspaceUIConfig>(
    () => ROLE_UI_CONFIG[_workspaceRole.value]
  )

  function setActiveTab(tab: string | number) {
    _activeTab.value = String(tab)
  }

  const members = computed(() => _members.value)
  const pendingInvites = computed(() => _pendingInvites.value)

  const totalMemberSlots = computed(
    () => _members.value.length + _pendingInvites.value.length
  )
  const isInviteLimitReached = computed(
    () => totalMemberSlots.value >= MAX_WORKSPACE_MEMBERS
  )

  // TODO: Replace with actual API calls
  async function fetchMembers(): Promise<WorkspaceMember[]> {
    if (_workspaceRole.value === 'PERSONAL') {
      _members.value = [
        {
          id: 'current-user',
          name: userDisplayName.value ?? 'You',
          email: userEmail.value ?? '',
          joinDate: new Date()
        }
      ]
    } else {
      _members.value = MOCK_MEMBERS
    }
    return _members.value
  }

  async function fetchPendingInvites(): Promise<PendingInvite[]> {
    if (_workspaceRole.value === 'PERSONAL') {
      _pendingInvites.value = []
    } else {
      _pendingInvites.value = MOCK_PENDING_INVITES
    }
    return _pendingInvites.value
  }

  async function revokeInvite(_inviteId: string): Promise<void> {
    // TODO: API call to revoke invite
  }

  async function copyInviteLink(inviteId: string): Promise<string> {
    const invite = _pendingInvites.value.find((i) => i.id === inviteId)
    if (invite) {
      await navigator.clipboard.writeText(invite.inviteLink)
      return invite.inviteLink
    }
    throw new Error('Invite not found')
  }

  /**
   * Create an invite link for a given email
   * TODO: Replace with actual API call
   */
  async function createInviteLink(email: string): Promise<string> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Generate mock invite link
    const inviteId = Math.random().toString(36).substring(2, 10)
    const inviteLink = `https://cloud.comfy.org/workspace?3423532/invite/hi789jkl012mno345pq`

    // Add to pending invites (mock)
    const newInvite: PendingInvite = {
      id: inviteId,
      name: email.split('@')[0],
      email,
      inviteDate: new Date(),
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      inviteLink
    }
    _pendingInvites.value = [..._pendingInvites.value, newInvite]

    return inviteLink
  }

  const availableWorkspaces = computed(() => _availableWorkspaces.value)
  const ownedWorkspacesCount = computed(
    () => _availableWorkspaces.value.filter((w) => w.role === 'OWNER').length
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
    permissions,
    uiConfig,
    setActiveTab,
    // Workspace switching
    availableWorkspaces,
    ownedWorkspacesCount,
    canCreateWorkspace,
    switchWorkspace,
    // Members
    members,
    pendingInvites,
    totalMemberSlots,
    isInviteLimitReached,
    fetchMembers,
    fetchPendingInvites,
    revokeInvite,
    copyInviteLink,
    createInviteLink,
    // Dev helpers
    setMockRole,
    setMockSubscribed
  }
}

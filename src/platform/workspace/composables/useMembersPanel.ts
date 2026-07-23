import type { MenuItem } from 'primevue/menuitem'
import { storeToRefs } from 'pinia'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import type { WorkspaceRole } from '@/platform/workspace/api/workspaceApi'
import { useTeamPlan } from '@/platform/workspace/composables/useTeamPlan'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import type {
  PendingInvite,
  WorkspaceMember
} from '@/platform/workspace/stores/teamWorkspaceStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogService } from '@/services/dialogService'

type ActiveView = 'active' | 'pending'
type SortField = 'inviteDate' | 'expiryDate' | 'role'
type SortDirection = 'asc' | 'desc'

export function sortMembers(
  members: WorkspaceMember[],
  currentUserEmail: string | null,
  sortDirection: SortDirection,
  originalOwnerId: string | null = null
): WorkspaceMember[] {
  return [...members].sort((a, b) => {
    const aIsOriginalOwner = a.id === originalOwnerId
    const bIsOriginalOwner = b.id === originalOwnerId
    if (aIsOriginalOwner && !bIsOriginalOwner) return -1
    if (!aIsOriginalOwner && bIsOriginalOwner) return 1

    if (a.role !== b.role) {
      const ownerFirst = a.role === 'owner' ? -1 : 1
      return sortDirection === 'desc' ? ownerFirst : -ownerFirst
    }

    const aIsCurrent = a.email.toLowerCase() === currentUserEmail?.toLowerCase()
    const bIsCurrent = b.email.toLowerCase() === currentUserEmail?.toLowerCase()
    if (aIsCurrent && !bIsCurrent) return -1
    if (!aIsCurrent && bIsCurrent) return 1

    const aValue = a.joinDate.getTime()
    const bValue = b.joinDate.getTime()
    return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
  })
}

export function filterBySearch<T extends { email: string; name?: string }>(
  items: T[],
  query: string
): T[] {
  if (!query) return items
  const q = query.toLowerCase()
  return items.filter(
    (item) =>
      item.email.toLowerCase().includes(q) ||
      ('name' in item && item.name?.toLowerCase().includes(q))
  )
}

type InviteSortField = 'inviteDate' | 'expiryDate'

// Pending invites carry no role, so the members' 'role' sort has no equivalent
// here and falls back to the invite date.
function toInviteSortField(sortField: SortField): InviteSortField {
  return sortField === 'expiryDate' ? 'expiryDate' : 'inviteDate'
}

export function sortPendingInvites(
  invites: PendingInvite[],
  sortField: SortField,
  sortDirection: SortDirection
): PendingInvite[] {
  const field = toInviteSortField(sortField)
  return [...invites].sort((a, b) => {
    const aDate = a[field]
    const bDate = b[field]
    if (!aDate || !bDate) return 0
    const aValue = aDate.getTime()
    const bValue = bDate.getTime()
    return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
  })
}

export function useMembersPanel() {
  const { t } = useI18n()
  const toast = useToast()
  const { userPhotoUrl, userEmail, userDisplayName } = useCurrentUser()
  const {
    showRemoveMemberDialog,
    showRevokeInviteDialog,
    showChangeMemberRoleDialog,
    showInviteMemberDialog,
    showInviteMemberUpsellDialog
  } = useDialogService()
  const workspaceStore = useTeamWorkspaceStore()
  const { activeWorkspace, members, pendingInvites, originalOwnerId } =
    storeToRefs(workspaceStore)
  const { resendInvite } = workspaceStore
  const {
    permissions: workspacePermissions,
    uiConfig: workspaceUiConfig,
    workspaceRole
  } = useWorkspaceUI()
  const {
    hasTeamPlan,
    isOnTeamPlan,
    isCancelled,
    hasLapsedTeamPlan,
    isPlanLoading
  } = useTeamPlan()
  const subscriptionDialog = useSubscriptionDialog()
  const { maxSeats, occupiedSeats } = useBillingContext()

  const permissions = computed(() => {
    const canManageMembers =
      hasTeamPlan.value && workspaceRole.value === 'owner'

    return {
      ...workspacePermissions.value,
      canViewOtherMembers: hasTeamPlan.value,
      canViewPendingInvites: canManageMembers,
      canInviteMembers: canManageMembers,
      canManageInvites: canManageMembers,
      canManageMembers
    }
  })

  const uiConfig = computed(() => {
    if (!hasTeamPlan.value) {
      return {
        ...workspaceUiConfig.value,
        showMembersList: false,
        showPendingTab: false,
        showSearch: false,
        showRoleColumn: false,
        membersGridCols: 'grid-cols-1',
        pendingGridCols: 'grid-cols-[50%_20%_20%_10%]',
        headerGridCols: 'grid-cols-1'
      }
    }

    if (workspaceRole.value === 'owner') {
      return {
        ...workspaceUiConfig.value,
        showMembersList: true,
        showPendingTab: true,
        showSearch: true,
        showRoleColumn: true,
        membersGridCols: 'grid-cols-[50%_40%_10%]',
        pendingGridCols: 'grid-cols-[50%_20%_20%_10%]',
        headerGridCols: 'grid-cols-[50%_40%_10%]'
      }
    }

    return {
      ...workspaceUiConfig.value,
      showMembersList: true,
      showPendingTab: false,
      showSearch: true,
      showRoleColumn: true,
      membersGridCols: 'grid-cols-[1fr_auto]',
      pendingGridCols: 'grid-cols-[50%_20%_20%_10%]',
      headerGridCols: 'grid-cols-[1fr_auto]'
    }
  })

  const hasMultipleMembers = computed(() => members.value.length > 1)

  const showSearch = computed(
    () => uiConfig.value.showSearch && hasMultipleMembers.value
  )

  const showViewTabs = computed(
    () =>
      isOnTeamPlan.value &&
      (hasMultipleMembers.value || pendingInvites.value.length > 0)
  )

  const showInviteButton = computed(() => workspaceRole.value === 'owner')

  const isMemberLimitReached = computed(
    () =>
      maxSeats.value !== null &&
      occupiedSeats.value !== null &&
      maxSeats.value > 0 &&
      occupiedSeats.value >= maxSeats.value
  )

  // Invite is allowed only on an active (non-cancelled) team plan that is under
  // the member cap.
  const isInviteDisabled = computed(
    () =>
      isPlanLoading.value ||
      maxSeats.value === null ||
      occupiedSeats.value === null ||
      !isOnTeamPlan.value ||
      isCancelled.value ||
      isMemberLimitReached.value
  )

  const inviteTooltip = computed(() => {
    if (!isOnTeamPlan.value) return null
    if (maxSeats.value === null || occupiedSeats.value === null) return null
    if (!isMemberLimitReached.value) return null
    return t('workspacePanel.inviteLimitReached', { count: maxSeats.value })
  })

  function handleInviteMember() {
    if (
      isPlanLoading.value ||
      maxSeats.value === null ||
      occupiedSeats.value === null
    )
      return
    if (!isOnTeamPlan.value) {
      void showInviteMemberUpsellDialog()
      return
    }
    if (isCancelled.value || isMemberLimitReached.value) return
    void showInviteMemberDialog()
  }

  const personalWorkspaceMember = computed<WorkspaceMember>(() => ({
    id: 'self',
    name: userDisplayName.value ?? '',
    email: userEmail.value ?? '',
    role: 'owner' as const,
    joinDate: new Date(0),
    isOriginalOwner: true
  }))

  const searchQuery = ref('')
  const activeView = ref<ActiveView>('active')
  const sortField = ref<SortField>('inviteDate')
  const sortDirection = ref<SortDirection>('desc')

  function roleMenuItem(
    member: WorkspaceMember,
    role: WorkspaceRole,
    label: string
  ): MenuItem {
    return {
      label,
      checked: member.role === role,
      command: () => handleChangeRole(member, role)
    }
  }

  function memberMenuItems(member: WorkspaceMember): MenuItem[] {
    return [
      {
        label: t('workspacePanel.members.actions.changeRole'),
        items: [
          roleMenuItem(member, 'owner', t('workspaceSwitcher.roleOwner')),
          roleMenuItem(member, 'member', t('workspaceSwitcher.roleMember'))
        ]
      },
      {
        label: t('workspacePanel.members.actions.removeMember'),
        command: () => handleRemoveMember(member)
      }
    ]
  }

  function isCurrentUser(member: WorkspaceMember): boolean {
    return member.email.toLowerCase() === userEmail.value?.toLowerCase()
  }

  function isOriginalOwner(member: WorkspaceMember): boolean {
    return (
      activeWorkspace.value?.type === 'personal' &&
      member.id === originalOwnerId.value
    )
  }

  const filteredMembers = computed(() => {
    const searched = filterBySearch(members.value, searchQuery.value)
    return sortMembers(
      searched,
      userEmail.value ?? null,
      sortDirection.value,
      originalOwnerId.value
    )
  })

  // Built once per member list rather than per row on every render, so an
  // unrelated re-render (e.g. typing in the search box) doesn't rebuild every
  // row's menu and churn MemberListItem's props.
  const memberMenus = computed(
    () => new Map(filteredMembers.value.map((m) => [m.id, memberMenuItems(m)]))
  )

  const filteredPendingInvites = computed(() => {
    const searched = filterBySearch(pendingInvites.value, searchQuery.value)
    return sortPendingInvites(searched, sortField.value, sortDirection.value)
  })

  function toggleSort(field: SortField) {
    if (sortField.value === field) {
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortField.value = field
      sortDirection.value = 'desc'
    }
  }

  async function handleResendInvite(invite: PendingInvite) {
    try {
      await resendInvite(invite.id)
      toast.add({
        severity: 'success',
        summary: t('workspacePanel.toast.inviteResent'),
        life: 2000
      })
    } catch {
      toast.add({
        severity: 'error',
        summary: t('workspacePanel.toast.inviteResendFailed')
      })
    }
  }

  function handleRevokeInvite(invite: PendingInvite) {
    void showRevokeInviteDialog(invite.id)
  }

  function handleRemoveMember(member: WorkspaceMember) {
    void showRemoveMemberDialog(member.id)
  }

  function handleChangeRole(
    member: WorkspaceMember,
    targetRole: WorkspaceRole
  ) {
    if (member.role === targetRole) return
    void showChangeMemberRoleDialog({
      memberId: member.id,
      memberName: member.name,
      targetRole
    })
  }

  function showTeamPlans() {
    subscriptionDialog.show({ planMode: 'team', reason: 'team_members_panel' })
  }

  return {
    searchQuery,
    activeView,
    sortField,
    sortDirection,
    maxSeats,
    hasTeamPlan,
    isOnTeamPlan,
    hasLapsedTeamPlan,
    isPlanLoading,
    hasMultipleMembers,
    showSearch,
    showViewTabs,
    showInviteButton,
    isInviteDisabled,
    inviteTooltip,
    handleInviteMember,
    personalWorkspaceMember,
    filteredMembers,
    filteredPendingInvites,
    memberMenuItems,
    memberMenus,
    members,
    pendingInvites,
    permissions,
    uiConfig,
    userPhotoUrl,
    isCurrentUser,
    isOriginalOwner,
    toggleSort,
    showTeamPlans,
    handleResendInvite,
    handleRevokeInvite,
    handleRemoveMember,
    handleChangeRole
  }
}

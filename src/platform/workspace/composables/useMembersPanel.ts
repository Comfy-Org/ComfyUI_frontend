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
import {
  MAX_WORKSPACE_MEMBERS,
  useTeamWorkspaceStore
} from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogService } from '@/services/dialogService'

type ActiveView = 'active' | 'pending'
type SortField =
  | 'email'
  | 'role'
  | 'lastActivity'
  | 'credits'
  | 'inviteDate'
  | 'expiryDate'
type SortDirection = 'asc' | 'desc'

// One-shot sort applied the next time the Members panel mounts, so other panels
// can deep-link in with a preset ordering (e.g. Overview "Top spenders").
const pendingSort = ref<SortField | null>(null)
export function requestMembersSort(field: 'credits' | 'lastActivity') {
  pendingSort.value = field
}

export function sortMembers(
  members: WorkspaceMember[],
  currentUserEmail: string | null,
  sortDirection: SortDirection,
  originalOwnerId: string | null = null,
  sortField: SortField = 'role'
): WorkspaceMember[] {
  const dir = sortDirection === 'asc' ? 1 : -1

  if (sortField === 'email') {
    return [...members].sort((a, b) => dir * a.name.localeCompare(b.name))
  }
  if (sortField === 'lastActivity') {
    const at = (m: WorkspaceMember) => m.lastActivity?.getTime() ?? 0
    return [...members].sort((a, b) => dir * (at(a) - at(b)))
  }
  if (sortField === 'credits') {
    const used = (m: WorkspaceMember) => m.creditsUsedThisMonth ?? 0
    return [...members].sort((a, b) => dir * (used(a) - used(b)))
  }

  // Default (role) ordering pins the creator, then groups by role, then recency.
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
    showSetMemberCreditLimitDialog,
    showInviteMemberDialog,
    showInviteMemberUpsellDialog,
    showMemberLimitDialog
  } = useDialogService()
  const workspaceStore = useTeamWorkspaceStore()
  const {
    members,
    pendingInvites,
    originalOwnerId,
    totalMemberSlots,
    isInviteLimitReached,
    isInPersonalWorkspace: isPersonalWorkspace
  } = storeToRefs(workspaceStore)
  const { resendInvite } = workspaceStore
  const { permissions, uiConfig } = useWorkspaceUI()
  const { isOnTeamPlan, isCancelled, hasLapsedTeamPlan } = useTeamPlan()
  const subscriptionDialog = useSubscriptionDialog()
  const { fetchBalance } = useBillingContext()

  // The team plan caps members at a flat MAX_WORKSPACE_MEMBERS, independent of
  // the subscription tier.
  const maxSeats = computed(() => MAX_WORKSPACE_MEMBERS)

  const memberCount = computed(() => members.value.length)

  const hasMultipleMembers = computed(() => members.value.length > 1)

  const showSearch = computed(
    () => uiConfig.value.showSearch && hasMultipleMembers.value
  )

  const showViewTabs = computed(
    () =>
      isOnTeamPlan.value &&
      (hasMultipleMembers.value || pendingInvites.value.length > 0)
  )

  const showInviteButton = computed(
    () => permissions.value.canInviteMembers || isPersonalWorkspace.value
  )

  // Plan seat limit, with the flat backend cap (isInviteLimitReached) as backstop
  const isMemberLimitReached = computed(
    () => isInviteLimitReached.value || totalMemberSlots.value >= maxSeats.value
  )

  // Invite stays enabled at the seat cap so the button can surface the
  // "at the member limit" dialog; only an inactive/cancelled plan disables it.
  const isInviteDisabled = computed(
    () => !isOnTeamPlan.value || isCancelled.value
  )

  const inviteTooltip = computed(() => {
    if (!isOnTeamPlan.value) return null
    if (!isMemberLimitReached.value) return null
    return t('workspacePanel.inviteLimitReached')
  })

  function handleInviteMember() {
    if (!isOnTeamPlan.value) {
      void showInviteMemberUpsellDialog()
      return
    }
    if (isCancelled.value) return
    if (isMemberLimitReached.value) {
      void showMemberLimitDialog()
      return
    }
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
  const sortField = ref<SortField>(pendingSort.value ?? 'inviteDate')
  const sortDirection = ref<SortDirection>('desc')
  pendingSort.value = null

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
    const creditLimitItem: MenuItem = {
      label: t('workspacePanel.members.actions.setCreditLimit'),
      command: () =>
        void showSetMemberCreditLimitDialog({
          memberId: member.id,
          memberName: member.name,
          creditsUsed: member.creditsUsedThisMonth ?? 0,
          currentLimit: member.monthlyCreditLimit ?? null
        })
    }

    if (isCurrentUser(member) || isOriginalOwner(member)) {
      return [creditLimitItem]
    }

    return [
      {
        label: t('workspacePanel.members.actions.changeRole'),
        items: [
          roleMenuItem(member, 'owner', t('workspaceSwitcher.roleOwner')),
          roleMenuItem(member, 'member', t('workspaceSwitcher.roleMember'))
        ]
      },
      creditLimitItem,
      { separator: true },
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
    return member.id === originalOwnerId.value
  }

  const filteredMembers = computed(() => {
    const searched = filterBySearch(members.value, searchQuery.value)
    return sortMembers(
      searched,
      userEmail.value ?? null,
      sortDirection.value,
      originalOwnerId.value,
      sortField.value
    )
  })

  // Built once per member list rather than per row on every render, so an
  // unrelated re-render (e.g. typing in the search box) doesn't rebuild every
  // row's menu and churn MemberTableRow's props.
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
    memberCount,
    isOnTeamPlan,
    hasLapsedTeamPlan,
    hasMultipleMembers,
    fetchBalance,
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
    isPersonalWorkspace,
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

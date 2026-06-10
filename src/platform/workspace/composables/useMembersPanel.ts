import { storeToRefs } from 'pinia'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useBillingContext } from '@/composables/billing/useBillingContext'
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
  sortDirection: SortDirection
): WorkspaceMember[] {
  return [...members].sort((a, b) => {
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

export function sortPendingInvites(
  invites: PendingInvite[],
  sortField: SortField,
  sortDirection: SortDirection
): PendingInvite[] {
  const field = sortField === 'role' ? 'inviteDate' : sortField
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
    showInviteMemberDialog,
    showInviteMemberUpsellDialog
  } = useDialogService()
  const workspaceStore = useTeamWorkspaceStore()
  const {
    members,
    pendingInvites,
    totalMemberSlots,
    isInviteLimitReached,
    isInPersonalWorkspace: isPersonalWorkspace
  } = storeToRefs(workspaceStore)
  const { resendInvite } = workspaceStore
  const { permissions, uiConfig } = useWorkspaceUI()
  const { showSubscriptionDialog } = useBillingContext()
  const { maxSeats: planMaxSeats, isOnTeamPlan } = useTeamPlan()

  const maxSeats = computed(() =>
    isPersonalWorkspace.value ? 1 : planMaxSeats.value
  )

  const hasMultipleMembers = computed(() => members.value.length > 1)

  const showSearch = computed(
    () =>
      uiConfig.value.showSearch &&
      isOnTeamPlan.value &&
      hasMultipleMembers.value
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

  const isInviteDisabled = computed(
    () =>
      isPersonalWorkspace.value ||
      (isOnTeamPlan.value && isMemberLimitReached.value)
  )

  const inviteTooltip = computed(() => {
    if (!isOnTeamPlan.value) return null
    if (!isMemberLimitReached.value) return null
    return t('workspacePanel.inviteLimitReached', { count: maxSeats.value })
  })

  function handleInviteMember() {
    if (!isOnTeamPlan.value) {
      void showInviteMemberUpsellDialog()
      return
    }
    if (isMemberLimitReached.value) return
    void showInviteMemberDialog()
  }

  const personalWorkspaceMember = computed<WorkspaceMember>(() => ({
    id: 'self',
    name: userDisplayName.value ?? '',
    email: userEmail.value ?? '',
    role: 'owner' as const,
    joinDate: new Date(0)
  }))

  const searchQuery = ref('')
  const activeView = ref<ActiveView>('active')
  const sortField = ref<SortField>('inviteDate')
  const sortDirection = ref<SortDirection>('desc')

  const selectedMember = ref<WorkspaceMember | null>(null)

  const memberMenuItems = computed(() => [
    {
      label: t('workspacePanel.members.actions.removeMember'),
      icon: 'pi pi-user-minus',
      command: () => {
        if (selectedMember.value) {
          handleRemoveMember(selectedMember.value)
        }
      }
    }
  ])

  function selectMember(member: WorkspaceMember) {
    selectedMember.value = member
  }

  function isCurrentUser(member: WorkspaceMember): boolean {
    return member.email.toLowerCase() === userEmail.value?.toLowerCase()
  }

  const filteredMembers = computed(() => {
    const searched = filterBySearch(members.value, searchQuery.value)
    return sortMembers(searched, userEmail.value ?? null, sortDirection.value)
  })

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

  return {
    searchQuery,
    activeView,
    sortField,
    sortDirection,
    selectedMember,
    maxSeats,
    isOnTeamPlan,
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
    isPersonalWorkspace,
    members,
    pendingInvites,
    permissions,
    uiConfig,
    userPhotoUrl,
    isCurrentUser,
    selectMember,
    toggleSort,
    showSubscriptionDialog,
    handleResendInvite,
    handleRevokeInvite,
    handleRemoveMember
  }
}

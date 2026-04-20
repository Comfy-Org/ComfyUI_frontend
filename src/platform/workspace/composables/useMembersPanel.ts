import { storeToRefs } from 'pinia'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { TIER_TO_KEY } from '@/platform/cloud/subscription/constants/tierPricing'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import type {
  PendingInvite,
  WorkspaceMember
} from '@/platform/workspace/stores/teamWorkspaceStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogService } from '@/services/dialogService'

type ActiveView = 'active' | 'pending'
type SortField = 'inviteDate' | 'expiryDate' | 'joinDate'
type SortDirection = 'asc' | 'desc'

export function sortMembers(
  members: WorkspaceMember[],
  currentUserEmail: string | null,
  sortDirection: SortDirection
): WorkspaceMember[] {
  return [...members].sort((a, b) => {
    if (a.role === 'owner' && b.role !== 'owner') return -1
    if (a.role !== 'owner' && b.role === 'owner') return 1

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
  const field = sortField === 'joinDate' ? 'inviteDate' : sortField
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
    showCreateWorkspaceDialog
  } = useDialogService()
  const workspaceStore = useTeamWorkspaceStore()
  const {
    members,
    pendingInvites,
    isInPersonalWorkspace: isPersonalWorkspace
  } = storeToRefs(workspaceStore)
  const { copyInviteLink } = workspaceStore
  const { permissions, uiConfig } = useWorkspaceUI()
  const {
    isActiveSubscription,
    subscription,
    showSubscriptionDialog,
    getMaxSeats
  } = useBillingContext()

  const maxSeats = computed(() => {
    if (isPersonalWorkspace.value) return 1
    const tier = subscription.value?.tier
    if (!tier) return 1
    const tierKey = TIER_TO_KEY[tier]
    if (!tierKey) return 1
    return getMaxSeats(tierKey)
  })

  const isSingleSeatPlan = computed(() => {
    if (isPersonalWorkspace.value) return false
    if (!isActiveSubscription.value) return true
    return maxSeats.value <= 1
  })

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

  async function handleCopyInviteLink(invite: PendingInvite) {
    try {
      await copyInviteLink(invite.id)
      toast.add({
        severity: 'success',
        summary: t('g.copied'),
        life: 2000
      })
    } catch {
      toast.add({
        severity: 'error',
        summary: t('g.error')
      })
    }
  }

  function handleRevokeInvite(invite: PendingInvite) {
    showRevokeInviteDialog(invite.id)
  }

  function handleCreateWorkspace() {
    showCreateWorkspaceDialog()
  }

  function handleRemoveMember(member: WorkspaceMember) {
    showRemoveMemberDialog(member.id)
  }

  return {
    searchQuery,
    activeView,
    sortField,
    sortDirection,
    selectedMember,
    maxSeats,
    isSingleSeatPlan,
    personalWorkspaceMember,
    filteredMembers,
    filteredPendingInvites,
    memberMenuItems,
    isPersonalWorkspace,
    members,
    pendingInvites,
    permissions,
    uiConfig,
    isActiveSubscription,
    userPhotoUrl,
    isCurrentUser,
    selectMember,
    toggleSort,
    showSubscriptionDialog,
    handleCopyInviteLink,
    handleRevokeInvite,
    handleCreateWorkspace,
    handleRemoveMember
  }
}

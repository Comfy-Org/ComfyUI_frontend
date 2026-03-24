<template>
  <div class="grow overflow-auto pt-6">
    <div
      class="border-inter flex size-full flex-col gap-2 rounded-2xl border border-interface-stroke p-6"
    >
      <!-- Section Header -->
      <div class="flex w-full items-center gap-9">
        <div class="flex min-w-0 flex-1 items-baseline gap-2">
          <span class="text-base font-semibold text-base-foreground">
            <template v-if="activeView === 'active'">
              {{
                $t('workspacePanel.members.membersCount', {
                  count:
                    isSingleSeatPlan || isPersonalWorkspace
                      ? 1
                      : members.length,
                  maxSeats: maxSeats
                })
              }}
            </template>
            <template v-else-if="permissions.canViewPendingInvites">
              {{
                $t(
                  'workspacePanel.members.pendingInvitesCount',
                  pendingInvites.length
                )
              }}
            </template>
          </span>
        </div>
        <div
          v-if="uiConfig.showSearch && !isSingleSeatPlan"
          class="flex items-start gap-2"
        >
          <SearchInput
            v-model="searchQuery"
            :placeholder="$t('g.search')"
            size="lg"
            class="w-64"
          />
        </div>
      </div>

      <!-- Members Content -->
      <div class="flex min-h-0 flex-1 flex-col">
        <!-- Table Header with Tab Buttons and Column Headers -->
        <div
          v-if="uiConfig.showMembersList"
          :class="
            cn(
              'grid w-full items-center py-2',
              isSingleSeatPlan
                ? 'grid-cols-1 py-0'
                : activeView === 'pending'
                  ? uiConfig.pendingGridCols
                  : uiConfig.headerGridCols
            )
          "
        >
          <!-- Tab buttons in first column -->
          <div v-if="!isSingleSeatPlan" class="flex items-center gap-2">
            <Button
              :variant="
                activeView === 'active' ? 'secondary' : 'muted-textonly'
              "
              size="md"
              @click="activeView = 'active'"
            >
              {{ $t('workspacePanel.members.tabs.active') }}
            </Button>
            <Button
              v-if="uiConfig.showPendingTab"
              :variant="
                activeView === 'pending' ? 'secondary' : 'muted-textonly'
              "
              size="md"
              @click="activeView = 'pending'"
            >
              {{
                $t(
                  'workspacePanel.members.tabs.pendingCount',
                  pendingInvites.length
                )
              }}
            </Button>
          </div>
          <!-- Date column headers -->
          <template v-if="activeView === 'pending'">
            <Button
              variant="muted-textonly"
              size="sm"
              class="justify-start"
              @click="toggleSort('inviteDate')"
            >
              {{ $t('workspacePanel.members.columns.inviteDate') }}
              <i class="icon-[lucide--chevrons-up-down] size-4" />
            </Button>
            <Button
              variant="muted-textonly"
              size="sm"
              class="justify-start"
              @click="toggleSort('expiryDate')"
            >
              {{ $t('workspacePanel.members.columns.expiryDate') }}
              <i class="icon-[lucide--chevrons-up-down] size-4" />
            </Button>
            <div />
          </template>
          <template v-else>
            <template v-if="!isSingleSeatPlan">
              <Button
                variant="muted-textonly"
                size="sm"
                class="justify-end"
                @click="toggleSort('joinDate')"
              >
                {{ $t('workspacePanel.members.columns.joinDate') }}
                <i class="icon-[lucide--chevrons-up-down] size-4" />
              </Button>
              <!-- Empty cell for action column header (OWNER only) -->
              <div v-if="permissions.canRemoveMembers" />
            </template>
          </template>
        </div>

        <!-- Members List -->
        <div class="min-h-0 flex-1 overflow-y-auto">
          <!-- Active Members -->
          <template v-if="activeView === 'active'">
            <!-- Personal Workspace: show only current user -->
            <template v-if="isPersonalWorkspace">
              <MemberListItem
                :member="personalWorkspaceMember"
                :is-current-user="true"
                :photo-url="userPhotoUrl ?? undefined"
                :grid-cols="uiConfig.membersGridCols"
                :show-role-badge="uiConfig.showRoleBadge"
              />
            </template>

            <!-- Team Workspace: sorted list -->
            <template v-else>
              <MemberListItem
                v-for="(member, index) in filteredMembers"
                :key="member.id"
                :member="member"
                :is-current-user="isCurrentUser(member)"
                :photo-url="
                  isCurrentUser(member)
                    ? (userPhotoUrl ?? undefined)
                    : undefined
                "
                :grid-cols="uiConfig.membersGridCols"
                :show-role-badge="uiConfig.showRoleBadge"
                :show-date-column="uiConfig.showDateColumn"
                :can-remove-members="permissions.canRemoveMembers"
                :is-single-seat-plan="isSingleSeatPlan"
                :striped="index % 2 === 1"
                @show-menu="showMemberMenu($event, member)"
              />

              <!-- Member actions menu (shared for all members) -->
              <Menu ref="memberMenu" :model="memberMenuItems" :popup="true" />
            </template>
          </template>

          <!-- Upsell Banner -->
          <MemberUpsellBanner
            v-if="isSingleSeatPlan"
            :is-active-subscription="isActiveSubscription"
            @show-plans="showSubscriptionDialog()"
          />

          <!-- Pending Invites -->
          <PendingInvitesList
            v-if="activeView === 'pending'"
            :invites="filteredPendingInvites"
            :grid-cols="uiConfig.pendingGridCols"
            @copy-link="handleCopyInviteLink"
            @revoke="handleRevokeInvite"
          />
        </div>
      </div>
    </div>
    <!-- Personal Workspace Message -->
    <div v-if="isPersonalWorkspace" class="flex items-center">
      <p class="text-sm text-muted-foreground">
        {{ $t('workspacePanel.members.personalWorkspaceMessage') }}
      </p>
      <button
        class="cursor-pointer border-none bg-transparent underline"
        @click="handleCreateWorkspace"
      >
        {{ $t('workspacePanel.members.createNewWorkspace') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import Menu from 'primevue/menu'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import Button from '@/components/ui/button/Button.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { TIER_TO_KEY } from '@/platform/cloud/subscription/constants/tierPricing'
import MemberListItem from '@/platform/workspace/components/dialogs/settings/MemberListItem.vue'
import MemberUpsellBanner from '@/platform/workspace/components/dialogs/settings/MemberUpsellBanner.vue'
import PendingInvitesList from '@/platform/workspace/components/dialogs/settings/PendingInvitesList.vue'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import type {
  PendingInvite,
  WorkspaceMember
} from '@/platform/workspace/stores/teamWorkspaceStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogService } from '@/services/dialogService'
import { cn } from '@/utils/tailwindUtil'

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
  joinDate: new Date()
}))

const searchQuery = ref('')
const activeView = ref<'active' | 'pending'>('active')
const sortField = ref<'inviteDate' | 'expiryDate' | 'joinDate'>('inviteDate')
const sortDirection = ref<'asc' | 'desc'>('desc')

const memberMenu = ref<InstanceType<typeof Menu> | null>(null)
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

function showMemberMenu(event: Event, member: WorkspaceMember) {
  selectedMember.value = member
  memberMenu.value?.toggle(event)
}

function isCurrentUser(member: WorkspaceMember): boolean {
  return member.email.toLowerCase() === userEmail.value?.toLowerCase()
}

const filteredMembers = computed(() => {
  let result = [...members.value]

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      (member) =>
        member.name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query)
    )
  }

  result.sort((a, b) => {
    if (a.role === 'owner' && b.role !== 'owner') return -1
    if (a.role !== 'owner' && b.role === 'owner') return 1

    const aIsCurrentUser = isCurrentUser(a)
    const bIsCurrentUser = isCurrentUser(b)
    if (aIsCurrentUser && !bIsCurrentUser) return -1
    if (!aIsCurrentUser && bIsCurrentUser) return 1

    const aValue = a.joinDate.getTime()
    const bValue = b.joinDate.getTime()
    return sortDirection.value === 'asc' ? aValue - bValue : bValue - aValue
  })

  return result
})

const filteredPendingInvites = computed(() => {
  let result = [...pendingInvites.value]

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter((invite) =>
      invite.email.toLowerCase().includes(query)
    )
  }

  const field = sortField.value === 'joinDate' ? 'inviteDate' : sortField.value
  result.sort((a, b) => {
    const aDate = a[field]
    const bDate = b[field]
    if (!aDate || !bDate) return 0
    const aValue = aDate.getTime()
    const bValue = bDate.getTime()
    return sortDirection.value === 'asc' ? aValue - bValue : bValue - aValue
  })

  return result
})

function toggleSort(field: 'inviteDate' | 'expiryDate' | 'joinDate') {
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
</script>

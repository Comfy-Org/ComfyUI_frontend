<template>
  <div class="@container flex min-h-0 flex-1 flex-col gap-4 pb-6">
    <!-- Header: tabs (left) + search / invite (right), above the card -->
    <div
      class="flex w-full flex-col gap-3 @2xl:flex-row @2xl:items-center @2xl:gap-9"
    >
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <template v-if="showViewTabs">
          <Button
            :variant="activeView === 'active' ? 'secondary' : 'muted-textonly'"
            size="lg"
            @click="activeView = 'active'"
          >
            {{ $t('workspacePanel.members.tabs.membersCount', memberCount) }}
          </Button>
          <Button
            v-if="uiConfig.showPendingTab"
            :variant="activeView === 'pending' ? 'secondary' : 'muted-textonly'"
            size="lg"
            @click="activeView = 'pending'"
          >
            {{
              pendingInvites.length > 0
                ? $t(
                    'workspacePanel.members.tabs.pendingCount',
                    pendingInvites.length
                  )
                : $t('workspacePanel.members.tabs.pending')
            }}
          </Button>
        </template>
        <span v-else class="text-base font-normal text-base-foreground">
          {{ $t('workspacePanel.members.tabs.membersCount', memberCount) }}
        </span>
      </div>
      <div class="flex w-full items-center gap-2 @2xl:w-auto">
        <SearchInput
          v-if="showSearch"
          v-model="searchQuery"
          :placeholder="$t('workspacePanel.members.searchPlaceholder')"
          size="lg"
          class="min-w-0 flex-1 @2xl:w-64 @2xl:flex-none"
        />
        <Button
          v-if="showInviteButton"
          v-tooltip="
            inviteTooltip
              ? { value: inviteTooltip, showDelay: 0 }
              : { value: $t('workspacePanel.inviteMember'), showDelay: 300 }
          "
          variant="secondary"
          size="lg"
          class="shrink-0"
          :disabled="isInviteDisabled"
          :aria-label="$t('workspacePanel.inviteMember')"
          @click="handleInviteMember"
        >
          {{ $t('workspacePanel.invite') }}
          <i class="icon-[lucide--plus] size-4" />
        </Button>
      </div>
    </div>

    <BillingStatusBanner />

    <!-- Card: fills height, table scrolls inside -->
    <div
      class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-interface-stroke/60"
    >
      <Table v-if="activeView === 'active'" class="min-h-0 flex-1 px-4">
        <TableHeader class="sticky top-0 z-10 bg-base-background">
          <TableRow
            class="hover:bg-transparent [&>th]:h-14 [&>th]:border-b [&>th]:border-interface-stroke/60"
          >
            <TableHead :aria-sort="ariaSort('email')">
              <button :class="sortHeaderClass" @click="toggleSort('email')">
                {{ $t('workspacePanel.members.columns.email') }}
                <i :class="sortIcon('email')" />
              </button>
            </TableHead>
            <TableHead
              :class="permissions.canManageMembers ? 'w-40' : undefined"
              :aria-sort="ariaSort('role')"
            >
              <button :class="sortHeaderClass" @click="toggleSort('role')">
                {{ $t('workspacePanel.members.columns.role') }}
                <i :class="sortIcon('role')" />
              </button>
            </TableHead>
            <TableHead
              v-if="permissions.canManageMembers"
              class="w-40"
              :aria-sort="ariaSort('lastActivity')"
            >
              <button
                :class="sortHeaderClass"
                @click="toggleSort('lastActivity')"
              >
                {{ $t('workspacePanel.members.columns.lastActivity') }}
                <i :class="sortIcon('lastActivity')" />
              </button>
            </TableHead>
            <TableHead
              v-if="permissions.canManageMembers"
              class="w-64"
              :aria-sort="ariaSort('credits')"
            >
              <button :class="sortHeaderClass" @click="toggleSort('credits')">
                <i class="icon-[lucide--coins] size-4" />
                {{ $t('workspacePanel.members.columns.creditsUsed') }}
                <i :class="sortIcon('credits')" />
              </button>
            </TableHead>
            <TableHead v-if="permissions.canManageMembers" class="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <MemberTableRow
            v-if="isPersonalWorkspace"
            :member="personalWorkspaceMember"
            :is-current-user="true"
          />
          <template v-else>
            <MemberTableRow
              v-for="member in filteredMembers"
              :key="member.id"
              :member="member"
              :is-current-user="isCurrentUser(member)"
              :can-manage-members="permissions.canManageMembers"
              :menu-items="memberMenus.get(member.id)"
            />
          </template>
        </TableBody>
      </Table>

      <Table v-else class="min-h-0 flex-1 px-4">
        <TableHeader class="sticky top-0 z-10 bg-base-background">
          <TableRow
            class="hover:bg-transparent [&>th]:h-14 [&>th]:border-b [&>th]:border-interface-stroke/60"
          >
            <TableHead>
              <span :class="sortHeaderClass">
                {{ $t('workspacePanel.members.columns.email') }}
              </span>
            </TableHead>
            <TableHead class="w-40" :aria-sort="ariaSort('inviteDate')">
              <button
                :class="sortHeaderClass"
                @click="toggleSort('inviteDate')"
              >
                {{ $t('workspacePanel.members.columns.inviteDate') }}
                <i :class="sortIcon('inviteDate')" />
              </button>
            </TableHead>
            <TableHead class="w-40" :aria-sort="ariaSort('expiryDate')">
              <button
                :class="sortHeaderClass"
                @click="toggleSort('expiryDate')"
              >
                {{ $t('workspacePanel.members.columns.expiryDate') }}
                <i :class="sortIcon('expiryDate')" />
              </button>
            </TableHead>
            <TableHead v-if="permissions.canManageInvites" class="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <PendingInviteRow
            v-for="invite in filteredPendingInvites"
            :key="invite.id"
            :invite="invite"
            :can-manage="permissions.canManageInvites"
            @resend="handleResendInvite"
            @revoke="handleRevokeInvite"
          />
          <TableRow
            v-if="filteredPendingInvites.length === 0"
            class="hover:bg-transparent"
          >
            <TableCell
              :colspan="permissions.canManageInvites ? 4 : 3"
              class="py-6 text-center text-sm text-muted-foreground"
            >
              {{ $t('workspacePanel.members.noInvites') }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <MemberUpsellBanner
      v-if="!isOnTeamPlan"
      :reactivate="hasLapsedTeamPlan"
      @show-plans="showTeamPlans()"
    />
    <div
      v-if="isOnTeamPlan && !isPersonalWorkspace"
      class="flex h-8 items-center"
    >
      <p class="text-sm text-muted-foreground">
        {{ membersUsageLabel }}
        <template v-if="permissions.canInviteMembers">
          {{ $t('workspacePanel.members.needMoreMembers') }}
        </template>
      </p>
      <Button
        v-if="permissions.canInviteMembers"
        variant="muted-textonly"
        size="md"
        class="text-sm text-base-foreground"
        @click="handleContactUs"
      >
        {{ $t('workspacePanel.members.contactUs') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import Button from '@/components/ui/button/Button.vue'
import Table from '@/components/ui/table/Table.vue'
import TableBody from '@/components/ui/table/TableBody.vue'
import TableCell from '@/components/ui/table/TableCell.vue'
import TableHead from '@/components/ui/table/TableHead.vue'
import TableHeader from '@/components/ui/table/TableHeader.vue'
import TableRow from '@/components/ui/table/TableRow.vue'
import { useExternalLink } from '@/composables/useExternalLink'
import BillingStatusBanner from '@/platform/workspace/components/dialogs/settings/BillingStatusBanner.vue'
import MemberTableRow from '@/platform/workspace/components/dialogs/settings/MemberTableRow.vue'
import MemberUpsellBanner from '@/platform/workspace/components/dialogs/settings/MemberUpsellBanner.vue'
import PendingInviteRow from '@/platform/workspace/components/dialogs/settings/PendingInviteRow.vue'
import { useMembersPanel } from '@/platform/workspace/composables/useMembersPanel'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const {
  searchQuery,
  activeView,
  sortField,
  sortDirection,
  maxSeats,
  memberCount,
  isOnTeamPlan,
  hasLapsedTeamPlan,
  showSearch,
  showViewTabs,
  showInviteButton,
  isInviteDisabled,
  inviteTooltip,
  handleInviteMember,
  personalWorkspaceMember,
  filteredMembers,
  filteredPendingInvites,
  memberMenus,
  isPersonalWorkspace,
  pendingInvites,
  permissions,
  uiConfig,
  fetchBalance,
  isCurrentUser,
  toggleSort,
  showTeamPlans,
  handleResendInvite,
  handleRevokeInvite
} = useMembersPanel()

const { staticUrls } = useExternalLink()
const { t } = useI18n()

// Owners get "Need more members?" after the count, where the period reads as a
// separator; members see just the count, so drop the trailing period.
const membersUsageLabel = computed(() => {
  const label = t('workspacePanel.members.membersUsage', {
    count: memberCount.value,
    max: maxSeats.value
  })
  return permissions.value.canInviteMembers ? label : label.replace(/\.$/, '')
})

const sortHeaderClass =
  'flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-left font-[inherit] text-sm text-muted-foreground'

function sortIcon(field: string) {
  if (sortField.value !== field) return 'icon-[lucide--chevrons-up-down] size-3'
  return sortDirection.value === 'asc'
    ? 'icon-[lucide--chevron-up] size-3'
    : 'icon-[lucide--chevron-down] size-3'
}

function ariaSort(field: string): 'ascending' | 'descending' | 'none' {
  if (sortField.value !== field) return 'none'
  return sortDirection.value === 'asc' ? 'ascending' : 'descending'
}

function handleContactUs() {
  window.open(staticUrls.teamPlanRequests, '_blank', 'noopener,noreferrer')
}

onMounted(() => {
  void fetchBalance()
})
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4">
    <!-- Header: tabs (left) + search / invite (right), above the card -->
    <div class="flex w-full items-center gap-9">
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
      <div class="flex items-center gap-2">
        <SearchInput
          v-if="showSearch"
          v-model="searchQuery"
          :placeholder="$t('workspacePanel.members.searchPlaceholder')"
          size="lg"
          class="w-64"
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
          :disabled="isInviteDisabled"
          :aria-label="$t('workspacePanel.inviteMember')"
          @click="handleInviteMember"
        >
          {{ $t('workspacePanel.invite') }}
          <i class="icon-[lucide--plus] size-4" />
        </Button>
      </div>
    </div>

    <MembersOutOfCreditsBanner
      v-if="showOutOfCreditsBanner"
      :reset-date="creditResetDate"
      @dismiss="dismissOutOfCreditsBanner"
      @add-credits="handleAddCredits"
    />

    <!-- Card: fills height, table scrolls inside -->
    <div
      class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-interface-stroke/60"
    >
      <Table v-if="activeView === 'active'" class="min-h-0 flex-1 px-4">
        <TableHeader class="sticky top-0 z-10 bg-base-background">
          <TableRow
            class="hover:bg-transparent [&>th]:h-14 [&>th]:border-b [&>th]:border-interface-stroke/60"
          >
            <TableHead>
              <button :class="sortHeaderClass" @click="toggleSort('email')">
                {{ $t('workspacePanel.members.columns.email') }}
                <i :class="sortIcon('email')" />
              </button>
            </TableHead>
            <TableHead class="w-40">
              <button :class="sortHeaderClass" @click="toggleSort('role')">
                {{ $t('workspacePanel.members.columns.role') }}
                <i :class="sortIcon('role')" />
              </button>
            </TableHead>
            <TableHead class="w-40">
              <button
                :class="sortHeaderClass"
                @click="toggleSort('lastActivity')"
              >
                {{ $t('workspacePanel.members.columns.lastActivity') }}
                <i :class="sortIcon('lastActivity')" />
              </button>
            </TableHead>
            <TableHead class="w-64">
              <button
                :class="cn(sortHeaderClass, 'ml-auto')"
                @click="toggleSort('credits')"
              >
                <i class="icon-[lucide--coins] size-4" />
                {{ $t('workspacePanel.members.columns.creditsUsed') }}
                <i :class="sortIcon('credits')" />
              </button>
            </TableHead>
            <TableHead class="w-12" />
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
              :is-original-owner="isOriginalOwner(member)"
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
            <TableHead class="w-40">
              <button
                :class="sortHeaderClass"
                @click="toggleSort('inviteDate')"
              >
                {{ $t('workspacePanel.members.columns.inviteDate') }}
                <i :class="sortIcon('inviteDate')" />
              </button>
            </TableHead>
            <TableHead class="w-40">
              <button
                :class="sortHeaderClass"
                @click="toggleSort('expiryDate')"
              >
                {{ $t('workspacePanel.members.columns.expiryDate') }}
                <i :class="sortIcon('expiryDate')" />
              </button>
            </TableHead>
            <TableHead class="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <PendingInviteRow
            v-for="invite in filteredPendingInvites"
            :key="invite.id"
            :invite="invite"
            @resend="handleResendInvite"
            @revoke="handleRevokeInvite"
          />
          <TableRow
            v-if="filteredPendingInvites.length === 0"
            class="hover:bg-transparent"
          >
            <TableCell
              :colspan="4"
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
      class="flex items-center pt-1"
    >
      <p class="text-sm text-muted-foreground">
        {{
          $t('workspacePanel.members.membersUsage', {
            count: memberCount,
            max: maxSeats
          })
        }}
        {{ $t('workspacePanel.members.needMoreMembers') }}
      </p>
      <Button
        variant="muted-textonly"
        size="sm"
        class="text-base-foreground"
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
import MemberTableRow from '@/platform/workspace/components/dialogs/settings/MemberTableRow.vue'
import MemberUpsellBanner from '@/platform/workspace/components/dialogs/settings/MemberUpsellBanner.vue'
import MembersOutOfCreditsBanner from '@/platform/workspace/components/dialogs/settings/MembersOutOfCreditsBanner.vue'
import PendingInviteRow from '@/platform/workspace/components/dialogs/settings/PendingInviteRow.vue'
import { useMembersPanel } from '@/platform/workspace/composables/useMembersPanel'
import { cn } from '@comfyorg/tailwind-utils'
import { onMounted } from 'vue'

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
  showOutOfCreditsBanner,
  creditResetDate,
  dismissOutOfCreditsBanner,
  handleAddCredits,
  fetchBalance,
  isCurrentUser,
  isOriginalOwner,
  toggleSort,
  showTeamPlans,
  handleResendInvite,
  handleRevokeInvite
} = useMembersPanel()

const { staticUrls } = useExternalLink()

const sortHeaderClass =
  'flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-left font-[inherit] text-sm text-muted-foreground'

function sortIcon(field: string) {
  if (sortField.value !== field) return 'icon-[lucide--chevrons-up-down] size-3'
  return sortDirection.value === 'asc'
    ? 'icon-[lucide--chevron-up] size-3'
    : 'icon-[lucide--chevron-down] size-3'
}

function handleContactUs() {
  window.open(staticUrls.discord, '_blank', 'noopener,noreferrer')
}

onMounted(() => {
  void fetchBalance()
})
</script>

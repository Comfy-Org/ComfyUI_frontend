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
import Menu from 'primevue/menu'
import { ref } from 'vue'

import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import Button from '@/components/ui/button/Button.vue'
import MemberListItem from '@/platform/workspace/components/dialogs/settings/MemberListItem.vue'
import MemberUpsellBanner from '@/platform/workspace/components/dialogs/settings/MemberUpsellBanner.vue'
import PendingInvitesList from '@/platform/workspace/components/dialogs/settings/PendingInvitesList.vue'
import { useMembersPanel } from '@/platform/workspace/composables/useMembersPanel'
import type { WorkspaceMember } from '@/platform/workspace/stores/teamWorkspaceStore'
import { cn } from '@/utils/tailwindUtil'

const {
  searchQuery,
  activeView,
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
  handleCreateWorkspace
} = useMembersPanel()

const memberMenu = ref<InstanceType<typeof Menu> | null>(null)

function showMemberMenu(event: Event, member: WorkspaceMember) {
  selectMember(member)
  memberMenu.value?.toggle(event)
}
</script>

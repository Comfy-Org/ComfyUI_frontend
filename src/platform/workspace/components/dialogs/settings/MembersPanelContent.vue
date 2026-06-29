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
              <template v-if="isOnTeamPlan && !isPersonalWorkspace">
                {{
                  $t('workspacePanel.members.membersCount', {
                    count: members.length,
                    maxSeats: maxSeats
                  })
                }}
              </template>
              <template v-else>
                {{ $t('workspacePanel.members.header') }}
              </template>
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
            <i class="pi pi-plus text-sm" />
          </Button>
          <WorkspaceMenuButton v-if="permissions.canAccessWorkspaceMenu" />
        </div>
      </div>

      <!-- Members Content -->
      <div class="flex min-h-0 flex-1 flex-col">
        <!-- Table Header with Tab Buttons and Column Headers -->
        <div
          v-if="uiConfig.showMembersList && showViewTabs"
          :class="
            cn(
              'grid w-full items-center py-2',
              activeView === 'pending'
                ? uiConfig.pendingGridCols
                : uiConfig.headerGridCols
            )
          "
        >
          <!-- Tab buttons in first column -->
          <div class="flex items-center gap-2">
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
            <Button
              variant="muted-textonly"
              size="sm"
              class="justify-end"
              @click="toggleSort('role')"
            >
              {{ $t('workspacePanel.members.columns.role') }}
              <i class="icon-[lucide--chevrons-up-down] size-4" />
            </Button>
            <!-- Empty cell for action column header (OWNER only) -->
            <div v-if="permissions.canManageMembers" />
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
                :show-role-column="
                  uiConfig.showRoleColumn && hasMultipleMembers
                "
                :can-manage-members="permissions.canManageMembers"
                :is-single-seat-plan="!isOnTeamPlan"
                :is-original-owner="isOriginalOwner(member)"
                :striped="index % 2 === 1"
                :menu-items="memberMenus.get(member.id)"
              />
            </template>
          </template>

          <!-- Pending Invites -->
          <PendingInvitesList
            v-if="activeView === 'pending'"
            :invites="filteredPendingInvites"
            :grid-cols="uiConfig.pendingGridCols"
            @resend="handleResendInvite"
            @revoke="handleRevokeInvite"
          />
        </div>
      </div>
    </div>
    <!-- Upsell Banner -->
    <MemberUpsellBanner
      v-if="!isOnTeamPlan"
      :reactivate="hasLapsedTeamPlan"
      @show-plans="showTeamPlans()"
    />
    <!-- Need More Members Footer -->
    <div
      v-if="isOnTeamPlan && !isPersonalWorkspace"
      class="flex items-center pt-2"
    >
      <p class="text-sm text-muted-foreground">
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
import { useExternalLink } from '@/composables/useExternalLink'
import MemberListItem from '@/platform/workspace/components/dialogs/settings/MemberListItem.vue'
import MemberUpsellBanner from '@/platform/workspace/components/dialogs/settings/MemberUpsellBanner.vue'
import PendingInvitesList from '@/platform/workspace/components/dialogs/settings/PendingInvitesList.vue'
import WorkspaceMenuButton from '@/platform/workspace/components/dialogs/settings/WorkspaceMenuButton.vue'
import { useMembersPanel } from '@/platform/workspace/composables/useMembersPanel'
import { cn } from '@comfyorg/tailwind-utils'

const {
  searchQuery,
  activeView,
  maxSeats,
  isOnTeamPlan,
  hasLapsedTeamPlan,
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
  handleRevokeInvite
} = useMembersPanel()

const { staticUrls } = useExternalLink()

function handleContactUs() {
  window.open(staticUrls.discord, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Controls row: tabs, search, invite (outside the table frame). Once the
         panel scrolls it moves into the dialog header, left of the close
         button, so the workspace name can scroll away. -->
    <div class="mb-6 flex w-full items-center gap-4">
      <div v-if="showViewTabs" class="flex items-center gap-2">
        <Button
          :variant="activeView === 'active' ? 'secondary' : 'muted-textonly'"
          size="lg"
          @click="activeView = 'active'"
        >
          {{ $t('workspacePanel.members.tabs.active') }}
        </Button>
        <Button
          v-if="uiConfig.showPendingTab"
          :variant="activeView === 'pending' ? 'secondary' : 'muted-textonly'"
          size="lg"
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
      <div class="ml-auto flex items-center gap-2">
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
    <div
      class="border-inter flex min-h-0 w-full flex-1 flex-col gap-2 rounded-2xl border border-interface-stroke p-6"
    >
      <!-- Members Content -->
      <div class="flex min-h-0 flex-1 flex-col">
        <div class="min-h-0 flex-1 overflow-y-auto">
          <!-- Table Header with Tab Buttons and Column Headers -->
          <div
            v-if="uiConfig.showMembersList && showViewTabs"
            :class="
              cn(
                'sticky -top-px z-10 grid w-full items-center bg-base-background px-2 pt-[calc(--spacing(2)+1px)] pb-2',
                activeView === 'pending'
                  ? uiConfig.pendingGridCols
                  : uiConfig.headerGridCols
              )
            "
          >
            <!-- Email column header -->
            <span class="text-xs text-muted-foreground">
              {{ $t('workspacePanel.members.columns.email') }}
            </span>
            <!-- Date column headers -->
            <template v-if="activeView === 'pending'">
              <Button
                variant="muted-textonly"
                size="sm"
                class="w-fit justify-self-start"
                @click="toggleSort('inviteDate')"
              >
                {{ $t('workspacePanel.members.columns.inviteDate') }}
                <i class="icon-[lucide--chevrons-up-down] size-4" />
              </Button>
              <Button
                variant="muted-textonly"
                size="sm"
                class="w-fit justify-self-start"
                @click="toggleSort('expiryDate')"
              >
                {{ $t('workspacePanel.members.columns.expiryDate') }}
                <i class="icon-[lucide--chevrons-up-down] size-4" />
              </Button>
              <div />
            </template>
            <template v-else>
              <span
                :class="
                  cn(
                    'text-xs text-muted-foreground',
                    uiConfig.showCreditsColumn
                      ? 'justify-self-start'
                      : 'justify-self-end'
                  )
                "
              >
                {{ $t('workspacePanel.members.columns.role') }}
              </span>
              <div
                v-if="uiConfig.showCreditsColumn"
                class="flex items-center gap-1 text-xs text-muted-foreground"
              >
                <i class="icon-[lucide--coins] size-4" />
                {{ $t('workspacePanel.members.columns.creditsUsed') }}
              </div>
              <!-- Empty cell for action column header (OWNER only) -->
              <div v-if="permissions.canManageMembers" />
            </template>
          </div>

          <!-- Members List -->
          <!-- Empty States -->
          <p
            v-if="emptyStateMessage"
            class="p-6 text-center text-sm text-muted-foreground"
          >
            {{ emptyStateMessage }}
          </p>

          <!-- Active Members -->
          <template v-if="activeView === 'active'">
            <template v-if="isInPersonalWorkspace && maxSeats === 1">
              <MemberListItem
                :member="personalWorkspaceMember"
                :is-current-user="true"
                :photo-url="userPhotoUrl ?? undefined"
                :grid-cols="uiConfig.membersGridCols"
                :is-single-seat-plan="maxSeats === 1"
              />
            </template>

            <template v-else>
              <MemberListItem
                v-for="member in filteredMembers"
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
                :show-credits-column="uiConfig.showCreditsColumn"
                :can-manage-members="permissions.canManageMembers"
                :menu-items="memberMenus.get(member.id)"
              />
            </template>
          </template>

          <!-- Pending Invites -->
          <PendingInvitesList
            v-if="activeView === 'pending'"
            :invites="filteredPendingInvites"
            :grid-cols="uiConfig.pendingGridCols"
            :search-query="searchQuery"
            :loaded="pendingInvitesLoaded"
            @resend="handleResendInvite"
            @revoke="handleRevokeInvite"
          />
        </div>
      </div>
    </div>
    <!-- Upsell Banner -->
    <MemberUpsellBanner
      v-if="
        !isPlanLoading &&
        ((isInPersonalWorkspace && maxSeats === 1) || isCancelled) &&
        permissions.canManageSubscription
      "
      :reactivate="hasLapsedTeamPlan"
      @show-plans="showTeamPlans()"
    />
    <!-- Need More Members Footer -->
    <div
      v-if="hasMemberSeats && membersLoaded"
      class="flex shrink-0 items-center gap-1 pt-2"
    >
      <p class="text-sm text-muted-foreground">
        {{
          $t('workspacePanel.members.totalMembersCount', {
            count: members.length,
            maxSeats: maxSeats
          })
        }}
        {{ $t('workspacePanel.members.needMoreMembers') }}
      </p>
      <Button
        variant="muted-textonly"
        size="sm"
        class="text-sm text-base-foreground"
        @click="handleContactUs"
      >
        {{ $t('workspacePanel.members.contactUs') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import Button from '@/components/ui/button/Button.vue'
import WorkspaceMenuButton from '@/platform/workspace/components/dialogs/settings/WorkspaceMenuButton.vue'
import MemberListItem from '@/platform/workspace/components/dialogs/settings/MemberListItem.vue'
import MemberUpsellBanner from '@/platform/workspace/components/dialogs/settings/MemberUpsellBanner.vue'
import PendingInvitesList from '@/platform/workspace/components/dialogs/settings/PendingInvitesList.vue'
import { useMembersPanel } from '@/platform/workspace/composables/useMembersPanel'
import { cn } from '@comfyorg/tailwind-utils'

const TEAM_PLAN_REQUEST_URL =
  'https://comfysupport.portal.usepylon.com/forms/team-plan-requests'

const {
  searchQuery,
  membersLoaded,
  pendingInvitesLoaded,
  activeView,
  maxSeats,
  isInPersonalWorkspace,
  hasLapsedTeamPlan,
  hasMemberSeats,
  isCancelled,
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
  memberMenus,
  members,
  pendingInvites,
  permissions,
  uiConfig,
  userPhotoUrl,
  isCurrentUser,
  toggleSort,
  showTeamPlans,
  handleResendInvite,
  handleRevokeInvite
} = useMembersPanel()

const { t } = useI18n()

const emptyStateMessage = computed(() => {
  if (!uiConfig.value.showMembersList) return null
  if (!membersLoaded.value) return null
  if (activeView.value !== 'active') return null
  if (isInPersonalWorkspace.value && maxSeats.value === 1) return null
  if (filteredMembers.value.length > 0) return null

  const query = searchQuery.value.trim()
  return query
    ? t('workspacePanel.members.noMembersMatch', { query })
    : t('workspacePanel.members.noMembers')
})

function handleContactUs() {
  window.open(TEAM_PLAN_REQUEST_URL, '_blank', 'noopener,noreferrer')
}
</script>

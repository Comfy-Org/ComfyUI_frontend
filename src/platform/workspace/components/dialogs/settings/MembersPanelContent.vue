<template>
  <div class="flex h-full flex-col">
    <MemberUpsellBanner
      v-if="
        !isPlanLoading &&
        isInPersonalWorkspace &&
        (maxSeats === 1 || isPlanEnded) &&
        permissions.canManageSubscription
      "
      @action="showTeamPlans()"
    />
    <!-- Controls row: tabs, search, invite (outside the table frame). Once the
         panel scrolls it moves into the dialog header, left of the close
         button, so the workspace name can scroll away. -->
    <Teleport
      defer
      to="#settings-header-controls"
      :disabled="!isHeaderCollapsed"
    >
      <div
        ref="controlsRef"
        :class="
          cn(
            'flex w-full items-center gap-4',
            isHeaderCollapsed ? 'min-w-0 flex-1' : 'mb-6'
          )
        "
      >
        <div
          v-if="showViewTabs && uiConfig.showPendingTab"
          class="flex items-center gap-2"
        >
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
              $t('workspacePanel.members.tabs.pendingCount', livePendingCount)
            }}
          </Button>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <SearchInput
            v-if="showSearch"
            v-model="searchQuery"
            :clear-label="$t('g.clear')"
            :accessible-label="$t('g.search')"
            :placeholder="$t('workspacePanel.members.searchPlaceholder')"
            size="lg"
            class="w-64"
          />
          <Tooltip v-if="showInviteButton">
            <TooltipTrigger as-child>
              <span class="inline-flex">
                <Button
                  variant="secondary"
                  size="lg"
                  :aria-label="$t('workspacePanel.inviteMember')"
                  @click="handleInviteMember"
                >
                  {{ $t('workspacePanel.invite') }}
                  <i class="pi pi-plus text-sm" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{{
              $t('workspacePanel.inviteMember')
            }}</TooltipContent>
          </Tooltip>
          <WorkspaceMenuButton v-if="showWorkspaceMenu" />
        </div>
      </div>
    </Teleport>
    <div
      class="flex min-h-0 w-full flex-1 flex-col gap-2 rounded-2xl border p-6"
    >
      <!-- Members Content -->
      <div class="flex min-h-0 flex-1 flex-col">
        <div class="min-h-0 flex-1 overflow-y-auto" @scroll="handlePanelScroll">
          <!-- Table Header with Tab Buttons and Column Headers -->
          <div
            v-if="
              uiConfig.showMembersList && (showViewTabs || hasMultipleMembers)
            "
            :class="
              cn(
                'sticky -top-px z-10 grid w-full items-center bg-background px-2 pt-[calc(--spacing(2)+1px)] pb-2',
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
                <i class="icon-[lucide--chevrons-up-down]" />
              </Button>
              <Button
                variant="muted-textonly"
                size="sm"
                class="w-fit justify-self-start"
                @click="toggleSort('expiryDate')"
              >
                {{ $t('workspacePanel.members.columns.expiryDate') }}
                <i class="icon-[lucide--chevrons-up-down]" />
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
                <i class="icon-[lucide--coins]" />
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
            <template
              v-if="
                isInPersonalWorkspace && maxSeats === 1 && !hasMultipleMembers
              "
            >
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
            v-if="activeView === 'pending' && permissions.canViewPendingInvites"
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
    <div v-if="isPlanEnded" class="flex shrink-0 items-center gap-1 pt-2 pb-6">
      <p class="text-sm text-muted-foreground">
        {{ $t('workspacePanel.members.planEndedFooter') }}
      </p>
      <Button
        v-if="permissions.canManageSubscription"
        variant="muted-textonly"
        size="sm"
        class="text-sm text-foreground"
        @click="isSalesManagedPlan ? handleContactSales() : showTeamPlans()"
      >
        {{
          isSalesManagedPlan
            ? $t('workspacePanel.members.contactSales')
            : $t('workspacePanel.members.resubscribe')
        }}
      </Button>
    </div>
    <!-- Need More Members Footer -->
    <div
      v-else-if="hasMemberSeats && membersLoaded"
      class="flex shrink-0 items-center gap-1 pt-2 pb-6"
    >
      <p class="text-sm text-muted-foreground">
        {{
          maxSeats === 0
            ? $t(
                'workspacePanel.members.totalMembersUnlimited',
                { count: totalMembers },
                totalMembers
              )
            : $t('workspacePanel.members.totalMembersCount', {
                count: totalMembers,
                maxSeats: maxSeats
              })
        }}
        {{ $t('workspacePanel.members.needMoreMembers') }}
      </p>
      <Button
        variant="muted-textonly"
        size="sm"
        class="text-sm text-foreground"
        @click="handleContactUs"
      >
        {{ $t('workspacePanel.members.contactUs') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSettingsHeaderCollapse } from '@/platform/settings/composables/useSettingsHeaderCollapse'

import SearchInput from '@comfyorg/design-system/search-input/SearchInput'
import Button from '@comfyorg/design-system/button/Button'
import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'
import WorkspaceMenuButton from '@/platform/workspace/components/dialogs/settings/WorkspaceMenuButton.vue'
import MemberListItem from '@/platform/workspace/components/dialogs/settings/MemberListItem.vue'
import MemberUpsellBanner from '@/platform/billing/components/settings/MemberUpsellBanner.vue'
import PendingInvitesList from '@/platform/workspace/components/dialogs/settings/PendingInvitesList.vue'
import { ENTERPRISE_URL } from '@/platform/billing/subscription/constants/tierPricing'
import { useMembersPanel } from '@/platform/workspace/composables/useMembersPanel'
import { cn } from '@comfyorg/tailwind-utils'

const TEAM_PLAN_REQUEST_URL =
  'https://comfysupport.portal.usepylon.com/forms/team-plan-requests'

const {
  searchQuery,
  membersLoaded,
  totalMembers,
  pendingInvitesLoaded,
  activeView,
  maxSeats,
  isInPersonalWorkspace,
  isPlanEnded,
  isSalesManagedPlan,
  hasMemberSeats,
  isPlanLoading,
  hasMultipleMembers,
  showSearch,
  showViewTabs,
  showInviteButton,
  showWorkspaceMenu,
  handleInviteMember,
  personalWorkspaceMember,
  filteredMembers,
  filteredPendingInvites,
  memberMenus,
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

const { isHeaderCollapsed, handlePanelScroll } = useSettingsHeaderCollapse()

const controlsRef = useTemplateRef<HTMLElement>('controlsRef')

// Teleporting re-parents these controls, which blurs whatever is focused and
// aborts an in-progress IME composition. Restore focus after the move so a
// half-typed filter survives the header collapsing.
watch(isHeaderCollapsed, async () => {
  const active = document.activeElement
  const wasInside =
    active instanceof HTMLElement && !!controlsRef.value?.contains(active)
  if (!wasInside) return
  await nextTick()
  active.focus()
})

const { t } = useI18n()

const emptyStateMessage = computed(() => {
  if (!uiConfig.value.showMembersList) return null
  if (!membersLoaded.value) return null
  if (activeView.value !== 'active') return null
  if (
    isInPersonalWorkspace.value &&
    maxSeats.value === 1 &&
    !hasMultipleMembers.value
  )
    return null
  if (filteredMembers.value.length > 0) return null

  const query = searchQuery.value.trim()
  return query
    ? t('workspacePanel.members.noMembersMatch', { query })
    : t('workspacePanel.members.noMembers')
})

const livePendingCount = computed(
  () => pendingInvites.value.filter((invite) => invite.token).length
)

function handleContactUs() {
  window.open(TEAM_PLAN_REQUEST_URL, '_blank', 'noopener,noreferrer')
}

function handleContactSales() {
  window.open(ENTERPRISE_URL, '_blank', 'noopener,noreferrer')
}
</script>

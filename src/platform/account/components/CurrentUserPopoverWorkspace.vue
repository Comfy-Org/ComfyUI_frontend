<template>
  <div
    data-testid="current-user-popover"
    class="current-user-popover flex flex-col p-1"
  >
    <template v-if="!accountActionsOnly">
      <div
        v-if="isApiKeyLogin || isDesktopHostWorkspaceFixed"
        class="flex items-center gap-2 rounded-lg p-2"
        data-testid="workspace-context-row"
      >
        <WorkspaceProfilePic class="size-8 shrink-0 text-sm" :workspace-name />
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="truncate text-sm text-foreground">{{
            workspaceName
          }}</span>
          <span
            class="truncate text-2xs text-muted-foreground uppercase"
            data-testid="workspace-plan-line"
            >{{ planLine }}</span
          >
        </div>
      </div>
      <PopoverRoot v-else v-slot="{ close }">
        <PopoverTrigger as-child>
          <button
            type="button"
            :class="
              cn(
                menuRowClass,
                'data-[state=open]:bg-accent'
              )
            "
            :title="workspaceName"
            :aria-label="$t('profileMenu.switchWorkspace')"
            data-testid="workspace-switcher-trigger"
          >
            <WorkspaceProfilePic
              class="size-8 shrink-0 text-sm"
              :workspace-name
            />
            <div class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-foreground">{{ workspaceName }}</span>
              <span
                class="truncate text-2xs text-muted-foreground uppercase"
                data-testid="workspace-plan-line"
                >{{ planLine }}</span
              >
            </div>
            <i
              class="icon-[lucide--arrow-left-right] text-muted-foreground"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="left"
          align="start"
          :side-offset="8"
          prioritize-position
          dismiss-on-viewport-change
          class="w-auto overflow-visible rounded-xl p-2"
          data-testid="workspace-switcher-panel"
        >
          <WorkspaceSwitcherPopover
            @select="close"
            @create="(close(), handleCreateWorkspace())"
          />
        </PopoverContent>
      </PopoverRoot>

      <HoverCard :open-delay="120">
        <HoverCardTrigger as-child>
          <button
            type="button"
            :class="menuRowClass"
            data-testid="credits-menu-item"
            @click="openSettings('workspace')"
          >
            <i class="icon-[lucide--coins] text-muted-foreground" />
            <span class="flex-1 text-foreground">{{
              $t('profileMenu.credits')
            }}</span>
            <Skeleton v-if="isLoading" class="h-4 w-12" />
            <Tooltip v-else-if="!balance">
              <TooltipTrigger as-child>
                <span
                  class="text-muted-foreground"
                  data-testid="credits-balance-unavailable"
                  >—</span
                >
              </TooltipTrigger>
              <TooltipContent side="left">{{
                $t('profileMenu.balanceUnavailable')
              }}</TooltipContent>
            </Tooltip>
            <span v-else class="text-foreground" data-testid="credits-balance">{{
              displayedCredits
            }}</span>
          </button>
        </HoverCardTrigger>
        <HoverCardContent
          side="left"
          align="start"
          :side-offset="12"
          class="rounded-xl p-2"
        >
          <ProfileMenuCreditsFlyout
            @open-billing="openSettings('workspace')"
            @close="emit('close')"
          />
        </HoverCardContent>
      </HoverCard>

      <button
        type="button"
        :class="menuRowClass"
        data-testid="workspace-settings-menu-item"
        @click="openSettings('workspace')"
      >
        <i class="icon-[lucide--settings] text-muted-foreground" />
        <span class="flex-1 text-foreground">{{
          $t('userSettings.workspaceSettings')
        }}</span>
      </button>

      <div class="my-1 border-t" />
    </template>

    <div class="flex items-center gap-2 p-2" data-testid="current-user-identity">
      <span
        aria-hidden="true"
        class="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-medium text-background uppercase"
        >{{ monogram }}</span
      >
      <div class="flex min-w-0 flex-1 flex-col">
        <span class="truncate text-sm text-foreground">{{
          userDisplayName || $t('g.user')
        }}</span>
        <span v-if="userEmail" class="truncate text-xs text-muted-foreground">{{
          userEmail
        }}</span>
      </div>
    </div>

    <button
      type="button"
      :class="menuRowClass"
      data-testid="user-settings-menu-item"
      @click="openSettings('user')"
    >
      <i class="icon-[lucide--settings-2] text-muted-foreground" />
      <span class="flex-1 text-foreground">{{
        $t('userSettings.accountSettings')
      }}</span>
    </button>

    <button
      type="button"
      :class="menuRowClass"
      data-testid="logout-menu-item"
      @click="handleLogout"
    >
      <i class="icon-[lucide--log-out] text-muted-foreground" />
      <span class="flex-1 text-foreground">{{
        $t('auth.signOut.signOut')
      }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { SettingPanelType } from '@comfyorg/settings-core/types'
import { cn } from '@comfyorg/tailwind-utils'
import { PopoverRoot, PopoverTrigger } from 'reka-ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import HoverCard from '@comfyorg/design-system/hover-card/HoverCard'
import HoverCardContent from '@comfyorg/design-system/hover-card/HoverCardContent'
import HoverCardTrigger from '@comfyorg/design-system/hover-card/HoverCardTrigger'
import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import Skeleton from '@comfyorg/design-system/skeleton/Skeleton'
import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'
import { formatCreditsFromCents } from '@/base/credits/comfyCredits'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import ProfileMenuCreditsFlyout from '@/platform/account/components/ProfileMenuCreditsFlyout.vue'
import WorkspaceSwitcherPopover from '@/platform/account/components/WorkspaceSwitcherPopover.vue'
import {
  PROFILE_MENU_ROLE_KEY,
  profileMenuPlanLabel
} from '@/platform/account/components/profileMenuPlanLine'
import { useWorkspaceDialogs } from '@/platform/account/composables/useWorkspaceDialogs'
import {
  canDesktopHostSwitchWorkspace,
  isDesktopHostSignedIn
} from '@/platform/auth/desktopHost/desktopHostSession'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { refreshBalanceInBackground } from '@/platform/billing/refreshBalanceInBackground'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const { accountActionsOnly = false } = defineProps<{
  accountActionsOnly?: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const menuRowClass =
  'flex w-full cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent p-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none'

const { t, locale } = useI18n()
const { workspaceName, activeWorkspace } = storeToRefs(useTeamWorkspaceStore())
const { userDisplayName, userEmail, handleSignOut, isApiKeyLogin } =
  useCurrentUser()
const { balance, isLoading, fetchBalance } = useBillingContext()
const settingsDialog = useSettingsDialog()
const { showCreateWorkspaceDialog } = useWorkspaceDialogs()

const isDesktopHostWorkspaceFixed = computed(
  () => isDesktopHostSignedIn() && !canDesktopHostSwitchWorkspace()
)

const planLine = computed(() => {
  const workspace = activeWorkspace.value
  if (!workspace) return ''
  const role = t(PROFILE_MENU_ROLE_KEY[workspace.role])
  const plan = profileMenuPlanLabel(workspace.plan_summary, t)
  return plan ? `${plan} • ${role}` : role
})

const displayedCredits = computed(() =>
  formatCreditsFromCents({
    cents:
      balance.value?.effectiveBalanceMicros ?? balance.value?.amountMicros ?? 0,
    locale: locale.value,
    numberOptions: { minimumFractionDigits: 0, maximumFractionDigits: 2 }
  })
)

const monogram = computed(() =>
  (userDisplayName.value || userEmail.value || '').trim().charAt(0)
)

function openSettings(panel: SettingPanelType) {
  settingsDialog.show(panel)
  emit('close')
}

async function handleLogout() {
  await handleSignOut()
  emit('close')
}

function handleCreateWorkspace() {
  showCreateWorkspaceDialog()
  emit('close')
}

onMounted(() => {
  if (!accountActionsOnly) void refreshBalanceInBackground(fetchBalance)
})
</script>

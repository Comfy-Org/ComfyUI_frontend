<template>
  <div
    ref="menu"
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
      <PopoverRoot v-else v-slot="{ close }" v-model:open="switcherOpen">
        <PopoverTrigger as-child>
          <Button
            variant="textonly"
            size="unset"
            :class="
              cn(
                profileMenuRowClass,
                'justify-start data-[state=open]:bg-accent'
              )
            "
            :title="workspaceName"
            :aria-label="$t('profileMenu.switchWorkspace')"
            data-testid="workspace-switcher-trigger"
          >
            <WorkspaceProfilePic
              class="size-8 shrink-0 text-sm"
              :workspace-name
              :subscription-tier="activeSummary?.subscriptionTier"
            />
            <div class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-foreground">{{ workspaceName }}</span>
              <span
                class="truncate text-2xs text-muted-foreground uppercase"
                data-testid="workspace-plan-line"
                >{{ planLine }}</span
              >
            </div>
            <i class="icon-[lucide--arrow-left-right] text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          :side="flyoutSide"
          align="start"
          :side-offset="flyoutGap"
          :align-offset="-menuInset"
          :align-flip="false"
          prioritize-position
          dismiss-on-viewport-change
          class="w-64 overflow-visible rounded-xl p-2 data-[state=open]:data-[side=left]:slide-in-from-right-0 data-[state=open]:data-[side=right]:slide-in-from-left-0"
          data-testid="workspace-switcher-panel"
        >
          <WorkspaceSwitcherFlyout
            @select="close"
            @create="(close(), handleCreateWorkspace())"
          />
        </PopoverContent>
      </PopoverRoot>

      <HoverCard
        :open="flyout === 'creditsPreview'"
        :open-delay="120"
        @update:open="previewCredits"
      >
        <HoverCardTrigger as-child>
          <button
            ref="creditsRow"
            type="button"
            :class="profileMenuRowClass"
            :aria-expanded="creditsOpen"
            data-testid="credits-menu-item"
            @click="pinCredits"
            @keydown.arrow-right.prevent="pinCredits"
            @blur="previewHeldBack = false"
            @pointerenter="previewHeldBack = false"
            @pointerleave="previewHeldBack = false"
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
            <span
              v-else
              class="text-foreground"
              data-testid="credits-balance"
              >{{ displayedCredits }}</span
            >
          </button>
        </HoverCardTrigger>
        <HoverCardContent
          v-bind="creditsFlyoutPlacement"
          :class="creditsFlyoutClass"
        >
          <ProfileMenuCreditsFlyout
            @open-billing="openSettings('workspace')"
            @close="emit('close')"
          />
        </HoverCardContent>
      </HoverCard>
      <PopoverRoot
        :open="flyout === 'creditsPinned'"
        @update:open="unpinCredits"
      >
        <PopoverContent
          v-bind="creditsFlyoutPlacement"
          :reference="creditsRow ?? undefined"
          :class="
            cn(
              creditsFlyoutClass,
              'max-h-none max-w-none overflow-visible data-[state=closed]:animate-none data-[state=open]:animate-none'
            )
          "
          :aria-label="$t('profileMenu.credits')"
          @escape-key-down="returnFocusToCreditsRow"
          @interact-outside="keepPinnedOnCreditsRow"
        >
          <div ref="pinnedCredits">
            <ProfileMenuCreditsFlyout
              @open-billing="openSettings('workspace')"
              @close="emit('close')"
            />
          </div>
        </PopoverContent>
      </PopoverRoot>

      <button
        type="button"
        :class="profileMenuRowClass"
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

    <div
      class="flex items-center gap-2 p-2"
      data-testid="current-user-identity"
    >
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
      :class="profileMenuRowClass"
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
      :class="profileMenuRowClass"
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
import type { FocusOutsideEvent, PointerDownOutsideEvent } from 'reka-ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
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
import WorkspaceSwitcherFlyout from '@/platform/account/components/WorkspaceSwitcherFlyout.vue'
import { profileMenuRowClass } from '@/platform/account/components/profileMenuRow'
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
import { useWorkspaceBillingStateStore } from '@/platform/billing/stores/workspaceBillingStateStore'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const { accountActionsOnly = false, flyoutSide = 'left' } = defineProps<{
  accountActionsOnly?: boolean
  flyoutSide?: 'left' | 'right'
}>()

const menuInset = 5
const flyoutGap = menuInset + 8

const emit = defineEmits<{
  close: []
}>()

const { t, locale } = useI18n()
const { workspaceName, activeWorkspace } = storeToRefs(useTeamWorkspaceStore())
const { activeSummary } = storeToRefs(useWorkspaceBillingStateStore())
const menu = useTemplateRef<HTMLElement>('menu')
const creditsRow = useTemplateRef<HTMLElement>('creditsRow')
const creditsFlyoutClass = 'w-64 rounded-xl border-border bg-background p-0'
const creditsFlyoutPlacement = computed(() => ({
  side: flyoutSide,
  align: 'start' as const,
  sideOffset: flyoutGap,
  alignOffset: -11,
  collisionBoundary: menu.value,
  collisionPadding: 0,
  sideFlip: false,
  alignFlip: false
}))
type MenuFlyout = 'none' | 'switcher' | 'creditsPreview' | 'creditsPinned'
const flyout = ref<MenuFlyout>('none')
const creditsOpen = computed(
  () => flyout.value === 'creditsPreview' || flyout.value === 'creditsPinned'
)
const switcherOpen = computed({
  get: () => flyout.value === 'switcher',
  set: (open) => {
    if (open) flyout.value = 'switcher'
    else if (flyout.value === 'switcher') flyout.value = 'none'
  }
})
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

const previewHeldBack = ref(false)

function returnFocusToCreditsRow() {
  previewHeldBack.value = true
  creditsRow.value?.focus()
}

function previewCredits(open: boolean) {
  if (open && flyout.value === 'none' && !previewHeldBack.value)
    flyout.value = 'creditsPreview'
  if (!open && flyout.value === 'creditsPreview') flyout.value = 'none'
}

const pinnedCredits = useTemplateRef<HTMLElement>('pinnedCredits')

function pinCredits() {
  if (flyout.value === 'creditsPinned') {
    pinnedCredits.value
      ?.querySelector<HTMLElement>('button:not([disabled]), a[href]')
      ?.focus()
    return
  }
  flyout.value = 'creditsPinned'
}

function unpinCredits(open: boolean) {
  if (!open && flyout.value === 'creditsPinned') flyout.value = 'none'
}

function keepPinnedOnCreditsRow(
  event: PointerDownOutsideEvent | FocusOutsideEvent
) {
  const target = event.detail.originalEvent.target
  if (target instanceof Node && creditsRow.value?.contains(target))
    event.preventDefault()
}

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

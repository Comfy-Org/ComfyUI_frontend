<!-- A popover that shows current user information and actions -->
<template>
  <div
    data-testid="current-user-popover"
    class="current-user-popover -m-3 w-fit max-w-96 min-w-80 rounded-lg border border-border-default bg-base-background p-2 shadow-[1px_1px_8px_0_rgba(0,0,0,0.4)]"
  >
    <!-- User Info Section -->
    <div class="mb-4 flex flex-col items-center px-0 py-3">
      <UserAvatar
        class="mb-1"
        :photo-url="userPhotoUrl"
        :pt:icon:class="{
          'text-2xl!': !userPhotoUrl
        }"
        size="large"
      />

      <!-- User Details -->
      <h3 class="my-0 mb-1 truncate text-base font-bold text-base-foreground">
        {{ userDisplayName || $t('g.user') }}
      </h3>
      <p v-if="userEmail" class="my-0 truncate text-sm text-muted">
        {{ userEmail }}
      </p>
    </div>

    <!-- Workspace Selector -->
    <div v-if="!accountActionsOnly" class="relative">
      <!-- An API-key session is bound to one server-resolved workspace and
           exposes no discovery or switching -->
      <div
        v-if="isApiKeyLogin"
        class="flex w-full items-center gap-2 rounded-lg px-4 py-2"
        data-testid="workspace-context-row"
      >
        <WorkspaceProfilePic
          class="size-6 shrink-0 text-xs"
          :workspace-name="workspaceName"
        />
        <span class="truncate text-sm text-base-foreground">
          {{ workspaceName }}
        </span>
      </div>
      <template v-else>
        <button
          ref="workspaceSwitcherTrigger"
          v-tooltip="{ value: workspaceName, showDelay: 300 }"
          type="button"
          class="flex w-full cursor-pointer appearance-none items-center justify-between rounded-lg border-0 bg-transparent px-4 py-2 text-left hover:bg-secondary-background-hover"
          :aria-expanded="isWorkspaceSwitcherOpen"
          aria-haspopup="menu"
          aria-controls="workspace-switcher-panel"
          data-testid="workspace-switcher-trigger"
          @click="toggleWorkspaceSwitcher"
          @keydown.escape.stop="isWorkspaceSwitcherOpen = false"
        >
          <div class="flex w-0 flex-1 items-center gap-2">
            <WorkspaceProfilePic
              class="size-6 shrink-0 text-xs"
              :workspace-name="workspaceName"
            />
            <span class="truncate text-sm text-base-foreground">
              {{ workspaceName }}
            </span>
          </div>
          <i
            class="pi pi-chevron-down shrink-0 text-sm text-muted-foreground"
          />
        </button>

        <div
          v-if="isWorkspaceSwitcherOpen"
          id="workspace-switcher-panel"
          ref="workspaceSwitcherPanel"
          role="menu"
          class="absolute top-0 right-full z-10 mr-4 rounded-lg border border-border-default bg-base-background shadow-[1px_1px_8px_0_rgba(0,0,0,0.4)]"
          data-testid="workspace-switcher-panel"
        >
          <WorkspaceSwitcherPopover
            @select="isWorkspaceSwitcherOpen = false"
            @create="handleCreateWorkspace"
          />
        </div>
      </template>
    </div>

    <!-- Credits Section -->

    <div v-if="!accountActionsOnly" class="flex items-center gap-2 px-4 py-2">
      <i class="icon-[lucide--coins] text-sm text-credit" />
      <Skeleton
        v-if="isLoadingBalance"
        width="4rem"
        height="1.25rem"
        class="w-full"
      />
      <span v-else class="text-base font-semibold text-base-foreground">{{
        displayedCredits
      }}</span>
      <Button
        v-tooltip="{ value: $t('credits.unified.tooltip'), showDelay: 300 }"
        variant="muted-textonly"
        size="icon-sm"
        class="mr-auto"
        :aria-label="$t('credits.unified.tooltip')"
        data-testid="credits-info-button"
      >
        <i class="icon-[lucide--circle-help]" />
      </Button>
      <Button
        v-if="canTopUp"
        variant="secondary"
        size="sm"
        class="text-base-foreground"
        data-testid="add-credits-button"
        @click="handleTopUp"
      >
        {{ $t('subscription.addCredits') }}
      </Button>
      <Button
        v-else-if="canSubscribeSelfServe"
        variant="subscribe"
        size="sm"
        data-testid="upgrade-to-add-credits-button"
        @click="handleUpgradeToAddCredits"
      >
        {{ $t('subscription.upgradeToAddCredits') }}
      </Button>
      <!-- Subscribe/Resubscribe (only when not subscribed or cancelled) -->
      <SubscribeButton
        v-if="showSubscribeAction && isPersonalWorkspace"
        :fluid="false"
        :label="
          isCancelled
            ? $t('subscription.resubscribe')
            : $t('workspaceSwitcher.subscribe')
        "
        size="sm"
        button-variant="subscribe"
      />
      <Button
        v-if="showSubscribeAction && !isPersonalWorkspace"
        variant="primary"
        size="sm"
        @click="handleOpenPlansAndPricing"
      >
        {{
          isCancelled
            ? $t('subscription.resubscribe')
            : $t('workspaceSwitcher.subscribe')
        }}
      </Button>
    </div>

    <Divider v-if="!accountActionsOnly" class="mx-0 my-2" />

    <div
      v-if="!accountActionsOnly && isCloud && showPlansAndPricing"
      class="flex cursor-pointer items-center gap-2 px-4 py-2 hover:bg-secondary-background-hover"
      data-testid="plans-pricing-menu-item"
      @click="handleOpenPlansAndPricing"
    >
      <i class="icon-[lucide--receipt-text] text-sm text-muted-foreground" />
      <span class="flex-1 text-sm text-base-foreground">{{
        $t('subscription.plansAndPricing')
      }}</span>
    </div>

    <button
      v-if="!accountActionsOnly && isCloud && showManagePlan"
      type="button"
      class="flex w-full cursor-pointer appearance-none items-center gap-2 border-0 bg-transparent px-4 py-2 text-left hover:bg-secondary-background-hover focus-visible:bg-secondary-background-hover focus-visible:outline-none"
      data-testid="manage-plan-menu-item"
      @click="handleOpenManagePlanSettings"
    >
      <i class="icon-[lucide--credit-card] size-4 text-muted-foreground" />
      <span class="flex-1 text-sm text-base-foreground">{{
        $t('subscription.managePlan')
      }}</span>
    </button>

    <button
      v-if="!accountActionsOnly && showLocalPlansAndCredits"
      type="button"
      class="flex w-full cursor-pointer appearance-none items-center gap-2 border-0 bg-transparent px-4 py-2 text-left hover:bg-secondary-background-hover focus-visible:bg-secondary-background-hover focus-visible:outline-none"
      data-testid="plans-credits-menu-item"
      @click="handleOpenPlanCreditsSettings"
    >
      <i class="icon-[lucide--coins] size-4 text-muted-foreground" />
      <span class="flex-1 text-sm text-base-foreground">{{
        $t('subscription.plansAndCredits')
      }}</span>
    </button>

    <!-- Partner Nodes Pricing (always shown) -->
    <div
      v-if="!accountActionsOnly"
      class="flex cursor-pointer items-center gap-2 px-4 py-2 hover:bg-secondary-background-hover"
      data-testid="partner-nodes-menu-item"
      @click="handleOpenPartnerNodesInfo"
    >
      <i class="icon-[lucide--tag] text-sm text-muted-foreground" />
      <span class="flex-1 text-sm text-base-foreground">{{
        $t('subscription.partnerNodesCredits')
      }}</span>
    </div>

    <Divider v-if="!accountActionsOnly" class="mx-0 my-2" />

    <!-- Workspace Settings (always shown) -->
    <div
      v-if="!accountActionsOnly"
      class="flex cursor-pointer items-center gap-2 px-4 py-2 hover:bg-secondary-background-hover"
      data-testid="workspace-settings-menu-item"
      @click="handleOpenWorkspaceSettings"
    >
      <i class="icon-[lucide--users] text-sm text-muted-foreground" />
      <span class="flex-1 text-sm text-base-foreground">{{
        $t('userSettings.workspaceSettings')
      }}</span>
    </div>

    <!-- Account Settings (always shown) -->
    <div
      class="flex cursor-pointer items-center gap-2 px-4 py-2 hover:bg-secondary-background-hover"
      data-testid="user-settings-menu-item"
      @click="handleOpenUserSettings"
    >
      <i class="icon-[lucide--settings-2] text-sm text-muted-foreground" />
      <span class="flex-1 text-sm text-base-foreground">{{
        $t('userSettings.accountSettings')
      }}</span>
    </div>

    <Divider class="mx-0 my-2" />

    <!-- Logout (always shown) -->
    <div
      class="flex cursor-pointer items-center gap-2 px-4 py-2 hover:bg-secondary-background-hover"
      data-testid="logout-menu-item"
      @click="handleLogout"
    >
      <i class="icon-[lucide--log-out] text-sm text-muted-foreground" />
      <span class="flex-1 text-sm text-base-foreground">{{
        $t('auth.signOut.signOut')
      }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import Divider from 'primevue/divider'
import Skeleton from 'primevue/skeleton'
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatCreditsFromCents } from '@/base/credits/comfyCredits'
import UserAvatar from '@/components/common/UserAvatar.vue'
import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import WorkspaceSwitcherPopover from '@/platform/workspace/components/WorkspaceSwitcherPopover.vue'
import Button from '@/components/ui/button/Button.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'

import { useExternalLink } from '@/composables/useExternalLink'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import SubscribeButton from '@/platform/cloud/subscription/components/SubscribeButton.vue'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useDialogService } from '@/services/dialogService'

const workspaceStore = useTeamWorkspaceStore()
const {
  initState,
  workspaceName,
  isInPersonalWorkspace: isPersonalWorkspace
} = storeToRefs(workspaceStore)
const { permissions } = useWorkspaceUI()
const { canTopUp, canSubscribeSelfServe, canReactivate } =
  useBillingCapabilities()
const isWorkspaceSwitcherOpen = ref(false)
const workspaceSwitcherTrigger = useTemplateRef('workspaceSwitcherTrigger')
const workspaceSwitcherPanel = useTemplateRef('workspaceSwitcherPanel')

onClickOutside(
  workspaceSwitcherPanel,
  () => {
    isWorkspaceSwitcherOpen.value = false
  },
  { ignore: [workspaceSwitcherTrigger] }
)

const emit = defineEmits<{
  close: []
}>()

const { accountActionsOnly = false } = defineProps<{
  accountActionsOnly?: boolean
}>()

const { buildDocsUrl, docsPaths } = useExternalLink()

const {
  userDisplayName,
  userEmail,
  userPhotoUrl,
  handleSignOut,
  isApiKeyLogin
} = useCurrentUser()
const settingsDialog = useSettingsDialog()
const dialogService = useDialogService()
const {
  billingStatus,
  canAccessSubscriptionFeatures,
  subscription,
  balance,
  isLoading,
  fetchBalance
} = useBillingContext()

const isCancelled = computed(() => subscription.value?.isCancelled ?? false)
const subscriptionDialog = useSubscriptionDialog()

const { locale } = useI18n()
const isLoadingBalance = isLoading

const displayedCredits = computed(() => {
  if (initState.value !== 'ready') return ''

  // API field is named _micros but contains cents (naming inconsistency)
  const cents =
    balance.value?.effectiveBalanceMicros ?? balance.value?.amountMicros ?? 0
  return formatCreditsFromCents({
    cents,
    locale: locale.value,
    numberOptions: {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }
  })
})

const showPlansAndPricing = computed(
  () => permissions.value.canManageSubscription
)
// Subscribing is a Cloud-only concept: Local users manage plan/credits
// through settings instead (see showLocalPlansAndCredits below), regardless
// of subscription status.
const showLocalPlansAndCredits = computed(
  () => !isCloud && permissions.value.canManageSubscription
)
const hasDelinquentSubscription = computed(
  () =>
    (billingStatus.value === 'payment_failed' ||
      billingStatus.value === 'paused') &&
    Boolean(subscription.value?.planSlug)
)
const showManagePlan = computed(
  () =>
    permissions.value.canManageSubscription &&
    (canAccessSubscriptionFeatures.value || hasDelinquentSubscription.value)
)
const showSubscribeAction = computed(
  () =>
    // Subscribing is Cloud-only, so the whole action stays gated on isCloud;
    // inside it the server-resolved capabilities are authoritative.
    isCloud &&
    ((isCancelled.value && canReactivate.value) ||
      (!canAccessSubscriptionFeatures.value &&
        !hasDelinquentSubscription.value &&
        canSubscribeSelfServe.value))
)

const handleOpenUserSettings = () => {
  settingsDialog.show('user')
  emit('close')
}

const handleOpenWorkspaceSettings = () => {
  settingsDialog.show('workspace')
  emit('close')
}

const handleOpenPlansAndPricing = () => {
  subscriptionDialog.showPricingTable({ reason: 'avatar_menu_plans' })
  emit('close')
}

const handleOpenManagePlanSettings = () => {
  settingsDialog.show('workspace')
  emit('close')
}

const handleOpenPlanCreditsSettings = () => {
  settingsDialog.show('workspace')
  emit('close')
}

const handleUpgradeToAddCredits = () => {
  subscriptionDialog.showPricingTable({ reason: 'upgrade_to_add_credits' })
  emit('close')
}

const handleTopUp = () => {
  useTelemetry()?.trackAddApiCreditButtonClicked({ source: 'avatar_menu' })
  dialogService.showTopUpCreditsDialog()
  emit('close')
}

const handleOpenPartnerNodesInfo = () => {
  window.open(
    buildDocsUrl(docsPaths.partnerNodesPricing, { includeLocale: true }),
    '_blank'
  )
  emit('close')
}

const handleLogout = async () => {
  await handleSignOut()
  emit('close')
}

const handleCreateWorkspace = () => {
  isWorkspaceSwitcherOpen.value = false
  dialogService.showCreateWorkspaceDialog()
  emit('close')
}

const toggleWorkspaceSwitcher = () => {
  isWorkspaceSwitcherOpen.value = !isWorkspaceSwitcherOpen.value
}

const refreshBalance = () => {
  if (!accountActionsOnly) void fetchBalance()
}

defineExpose({ refreshBalance })
</script>

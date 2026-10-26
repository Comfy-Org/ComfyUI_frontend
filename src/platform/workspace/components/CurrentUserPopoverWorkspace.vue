<!-- A popover that shows current user information and actions -->
<template>
  <div data-testid="current-user-popover" class="current-user-popover p-2">
    <!-- User Info Section -->
    <div class="mb-4 flex flex-col items-center px-0 py-3">
      <UserAvatar
        class="mb-1"
        :photo-url="userPhotoUrl"
        icon-class="size-6"
        size="large"
      />

      <!-- User Details -->
      <h3 class="my-0 mb-1 truncate text-base font-bold text-foreground">
        {{ userDisplayName || $t('g.user') }}
      </h3>
      <p v-if="userEmail" class="my-0 truncate text-sm text-muted-foreground">
        {{ userEmail }}
      </p>
    </div>

    <!-- Workspace Selector -->
    <div v-if="!accountActionsOnly" class="relative">
      <!-- An API-key session is bound to one server-resolved workspace, and a
           Desktop build without workspace switching fixes the host session's;
           neither exposes discovery or switching -->
      <div
        v-if="isApiKeyLogin || isDesktopHostWorkspaceFixed"
        class="flex w-full items-center gap-2 rounded-lg px-4 py-2"
        data-testid="workspace-context-row"
      >
        <WorkspaceProfilePic class="size-6 shrink-0 text-xs" :workspace-name />
        <span class="truncate text-sm text-foreground">
          {{ workspaceName }}
        </span>
      </div>
      <Popover
        v-else
        side="left"
        align="start"
        :side-offset="16"
        :collision-padding="8"
        prioritize-position
        data-testid="workspace-switcher-panel"
      >
        <template #button>
          <Button
            variant="muted-textonly"
            class="flex h-auto w-full justify-between px-4 py-2"
            :tooltip="workspaceName ?? ''"
            data-testid="workspace-switcher-trigger"
          >
            <div class="flex w-0 flex-1 items-center gap-2">
              <WorkspaceProfilePic
                class="size-6 shrink-0 text-xs"
                :workspace-name
                :subscription-tier="activeWorkspace?.subscriptionTier"
              />
              <span class="truncate text-sm text-foreground">
                {{ workspaceName }}
              </span>
            </div>
            <i
              class="pi pi-chevron-down shrink-0 text-sm text-muted-foreground"
            />
          </Button>
        </template>
        <template #default="{ close }">
          <WorkspaceSwitcherPopover
            @select="close"
            @create="(close(), handleCreateWorkspace())"
          />
        </template>
      </Popover>
    </div>

    <!-- Credits Section -->

    <div v-if="!accountActionsOnly" class="flex items-center gap-2 px-4 py-2">
      <i class="icon-[lucide--coins] text-sm text-credit" />
      <Skeleton v-if="isLoadingBalance" class="h-5 w-16" />
      <span v-else class="text-base font-semibold text-foreground">{{
        displayedCredits
      }}</span>
      <Button
        :tooltip="$t('credits.unified.tooltip')"
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
        data-testid="add-credits-button"
        :data-dd-action-name="BILLING_ACTION_NAME.addCreditsPopover"
        @click="handleTopUp"
      >
        {{ $t('subscription.addCredits') }}
      </Button>
      <Button
        v-else-if="paymentRecoveryAvailable"
        variant="secondary"
        size="sm"
        data-testid="add-credits-button"
        :data-dd-action-name="BILLING_ACTION_NAME.addCreditsPopover"
        @click="handleTopUp"
      >
        {{ $t('subscription.addCredits') }}
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
        @click="handleOpenSubscriptionAction"
      >
        {{
          isCancelled
            ? $t('subscription.resubscribe')
            : $t('workspaceSwitcher.subscribe')
        }}
      </Button>
    </div>

    <p
      v-if="processingPayment"
      role="status"
      class="m-0 px-4 pb-2 text-sm text-muted-foreground"
      data-testid="topup-payment-processing-line"
    >
      {{ $t('credits.topUp.paymentProcessingFlyout') }}
    </p>

    <div v-if="!accountActionsOnly" class="mx-0 my-2 border-t" />

    <div
      v-if="!accountActionsOnly && isCloud && showPlansAndPricing"
      class="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm hover:bg-accent"
      data-testid="plans-pricing-menu-item"
      @click="handleOpenPlansAndPricing"
    >
      <i class="icon-[lucide--receipt-text] text-muted-foreground" />
      <span class="flex-1 text-foreground">{{
        $t('subscription.plansAndPricing')
      }}</span>
    </div>

    <button
      v-if="!accountActionsOnly && isCloud && showManagePlan"
      type="button"
      class="flex w-full cursor-pointer appearance-none items-center gap-2 border-0 bg-transparent px-4 py-2 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
      data-testid="manage-plan-menu-item"
      :data-dd-action-name="BILLING_ACTION_NAME.managePlanPopover"
      @click="handleOpenManagePlanSettings"
    >
      <i class="icon-[lucide--credit-card] size-4 text-muted-foreground" />
      <span class="flex-1 text-sm text-foreground">{{
        $t('subscription.managePlan')
      }}</span>
    </button>

    <button
      v-if="!accountActionsOnly && showLocalPlansAndCredits"
      type="button"
      class="flex w-full cursor-pointer appearance-none items-center gap-2 border-0 bg-transparent px-4 py-2 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
      data-testid="plans-credits-menu-item"
      @click="handleOpenPlanCreditsSettings"
    >
      <i class="icon-[lucide--coins] size-4 text-muted-foreground" />
      <span class="flex-1 text-sm text-foreground">{{
        $t('subscription.plansAndCredits')
      }}</span>
    </button>

    <!-- Partner Nodes Pricing (always shown) -->
    <div
      v-if="!accountActionsOnly"
      class="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm hover:bg-accent"
      data-testid="partner-nodes-menu-item"
      @click="handleOpenPartnerNodesInfo"
    >
      <i class="icon-[lucide--tag] text-muted-foreground" />
      <span class="flex-1 text-foreground">{{
        $t('subscription.partnerNodesCredits')
      }}</span>
    </div>

    <div v-if="!accountActionsOnly" class="mx-0 my-2 border-t" />

    <!-- Workspace Settings (always shown) -->
    <div
      v-if="!accountActionsOnly"
      class="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm hover:bg-accent"
      data-testid="workspace-settings-menu-item"
      @click="handleOpenWorkspaceSettings"
    >
      <i class="icon-[lucide--users] text-muted-foreground" />
      <span class="flex-1 text-foreground">{{
        $t('userSettings.workspaceSettings')
      }}</span>
    </div>

    <!-- Account Settings (always shown) -->
    <div
      class="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm hover:bg-accent"
      data-testid="user-settings-menu-item"
      @click="handleOpenUserSettings"
    >
      <i class="icon-[lucide--settings-2] text-muted-foreground" />
      <span class="flex-1 text-foreground">{{
        $t('userSettings.accountSettings')
      }}</span>
    </div>

    <div class="mx-0 my-2 border-t" />

    <!-- Logout (always shown) -->
    <div
      class="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm hover:bg-accent"
      data-testid="logout-menu-item"
      @click="handleLogout"
    >
      <i class="icon-[lucide--log-out] text-muted-foreground" />
      <span class="flex-1 text-foreground">{{
        $t('auth.signOut.signOut')
      }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { BILLING_ACTION_NAME } from '@/platform/telemetry/billingActionNames'
import { storeToRefs } from 'pinia'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatCreditsFromCents } from '@/base/credits/comfyCredits'
import UserAvatar from '@/components/common/UserAvatar.vue'
import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import WorkspaceSwitcherPopover from '@/platform/workspace/components/WorkspaceSwitcherPopover.vue'
import Button from '@/components/ui/button/Button.vue'
import Popover from '@/components/ui/Popover.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import {
  canDesktopHostSwitchWorkspace,
  isDesktopHostSignedIn
} from '@/platform/auth/desktopHost/desktopHostSession'

import { useExternalLink } from '@/composables/useExternalLink'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import SubscribeButton from '@/platform/billing/subscription/components/SubscribeButton.vue'
import { useSubscriptionDialog } from '@/platform/billing/subscription/composables/useSubscriptionDialog'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { paymentIntentSourceForAddCreditsClick } from '@/platform/telemetry/utils/paymentIntentSource'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'
import { useProcessingTopupPayment } from '@/platform/billing/composables/useProcessingTopupPayment'
import { useWorkspaceDialogs } from '@/platform/workspace/composables/useWorkspaceDialogs'

const workspaceStore = useTeamWorkspaceStore()
const {
  initState,
  workspaceName,
  isInPersonalWorkspace: isPersonalWorkspace,
  activeWorkspace
} = storeToRefs(workspaceStore)
const { permissions, canReactivatePlan, canOpenPricingSurface } =
  useWorkspaceUI()
const { canTopUp, canSubscribeSelfServe, paymentRecoveryAvailable } =
  useBillingCapabilities()

const emit = defineEmits<{
  close: []
}>()

const { accountActionsOnly = false } = defineProps<{
  accountActionsOnly?: boolean
}>()

const { payment: processingPayment } = useProcessingTopupPayment(
  () => !accountActionsOnly
)

const { buildDocsUrl, docsPaths } = useExternalLink()

const {
  userDisplayName,
  userEmail,
  userPhotoUrl,
  handleSignOut,
  isApiKeyLogin
} = useCurrentUser()
const isDesktopHostWorkspaceFixed = computed(
  () => isDesktopHostSignedIn() && !canDesktopHostSwitchWorkspace()
)
const settingsDialog = useSettingsDialog()
const { showTopUpCreditsDialog } = useBillingDialogs()
const { showCreateWorkspaceDialog } = useWorkspaceDialogs()
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

const showPlansAndPricing = canOpenPricingSurface
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
    // Subscribing is Cloud-only, so the whole action stays gated on isCloud.
    // Self-serve subscribe is server-authoritative; reactivation is not.
    isCloud &&
    ((isCancelled.value && canReactivatePlan.value) ||
      (!canAccessSubscriptionFeatures.value &&
        !hasDelinquentSubscription.value &&
        canSubscribeSelfServe.value &&
        canTopUp.value))
)

const handleOpenUserSettings = () => {
  settingsDialog.show('user')
  emit('close')
}

const handleOpenWorkspaceSettings = () => {
  settingsDialog.show('workspace')
  emit('close')
}

/**
 * Plan selection stays in the app: billing-web's `/v1/pricing` has no
 * personal/team tabs, cycle toggle, or credit slider (G7), and a per-credit
 * Team plan 400s there (FE-2642). Only checkout hands off to billing-web,
 * from inside the table (`useSubscriptionCheckout`'s `handleSubscribeClick`
 * / `handleSubscribeTeamClick`).
 */
const handleOpenPlansAndPricing = () => {
  subscriptionDialog.showPricingTable({ reason: 'avatar_menu_plans' })
  emit('close')
}

const handleOpenSubscriptionAction = () => {
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

const handleTopUp = () => {
  useTelemetry()?.trackAddApiCreditButtonClicked({ source: 'avatar_menu' })
  showTopUpCreditsDialog({
    source: paymentIntentSourceForAddCreditsClick('avatar_menu')
  })
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
  showCreateWorkspaceDialog()
  emit('close')
}

onMounted(() => {
  if (!accountActionsOnly) void fetchBalance()
})
</script>

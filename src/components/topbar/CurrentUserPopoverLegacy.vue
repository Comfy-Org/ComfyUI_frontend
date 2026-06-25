<!-- A popover that shows current user information and actions -->
<template>
  <div class="current-user-popover w-full">
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
      <span
        v-if="subscriptionTierName"
        class="text-foreground my-0 mt-2 rounded-full bg-secondary-background-hover px-2 py-0.5 text-xs font-bold uppercase"
      >
        {{ subscriptionTierName }}
      </span>
    </div>

    <!-- Credits Section -->
    <div v-if="isActiveSubscription" class="flex items-center gap-2 px-4 py-2">
      <i class="icon-[lucide--component] text-sm text-amber-400" />
      <Skeleton v-if="isLoading" width="4rem" height="1.25rem" class="w-full" />
      <span v-else class="text-base font-semibold text-base-foreground">{{
        formattedBalance
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
        v-if="isCloud && isFreeTier"
        variant="gradient"
        size="sm"
        data-testid="upgrade-to-add-credits-button"
        @click="handleUpgradeToAddCredits"
      >
        {{ $t('subscription.upgradeToAddCredits') }}
      </Button>
      <Button
        v-else
        variant="secondary"
        size="sm"
        class="text-base-foreground"
        data-testid="add-credits-button"
        @click="handleTopUp"
      >
        {{ $t('subscription.addCredits') }}
      </Button>
    </div>

    <div v-else-if="isCloud" class="flex justify-center px-4">
      <SubscribeButton
        :fluid="false"
        :label="$t('subscription.subscribeToComfyCloud')"
        size="sm"
        button-variant="gradient"
        @subscribed="handleSubscribed"
      />
    </div>

    <DropdownMenuSeparator />

    <DropdownMenuItem
      v-if="isActiveSubscription"
      data-testid="partner-nodes-menu-item"
      @select="handleOpenPartnerNodesInfo"
    >
      <template #icon><i class="icon-[lucide--tag]" /></template>
      {{ $t('subscription.partnerNodesCredits') }}
    </DropdownMenuItem>

    <DropdownMenuItem
      v-if="isCloud"
      data-testid="plans-pricing-menu-item"
      @select="handleOpenPlansAndPricing"
    >
      <template #icon><i class="icon-[lucide--receipt-text]" /></template>
      {{ $t('subscription.plansAndPricing') }}
      <span
        v-if="canUpgrade"
        class="ml-auto rounded-full bg-base-foreground px-1.5 py-0.5 text-xs font-bold text-base-background"
      >
        {{ $t('subscription.upgrade') }}
      </span>
    </DropdownMenuItem>

    <DropdownMenuItem
      v-if="isActiveSubscription"
      data-testid="manage-plan-menu-item"
      @select="handleOpenPlanAndCreditsSettings"
    >
      <template #icon><i class="icon-[lucide--file-text]" /></template>
      {{ $t('subscription.managePlan') }}
    </DropdownMenuItem>

    <DropdownMenuItem
      data-testid="user-settings-menu-item"
      @select="handleOpenUserSettings"
    >
      <template #icon><i class="icon-[lucide--settings-2]" /></template>
      {{ $t('userSettings.accountSettings') }}
    </DropdownMenuItem>

    <DropdownMenuSeparator />

    <DropdownMenuItem data-testid="logout-menu-item" @select="handleLogout">
      <template #icon><i class="icon-[lucide--log-out]" /></template>
      {{ $t('auth.signOut.signOut') }}
    </DropdownMenuItem>
  </div>
</template>

<script setup lang="ts">
import Skeleton from 'primevue/skeleton'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatCreditsFromCents } from '@/base/credits/comfyCredits'
import UserAvatar from '@/components/common/UserAvatar.vue'
import Button from '@/components/ui/button/Button.vue'
import DropdownMenuItem from '@/components/ui/dropdown-menu/DropdownMenuItem.vue'
import DropdownMenuSeparator from '@/components/ui/dropdown-menu/DropdownMenuSeparator.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useExternalLink } from '@/composables/useExternalLink'
import SubscribeButton from '@/platform/cloud/subscription/components/SubscribeButton.vue'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useWorkspaceTierLabel } from '@/platform/workspace/composables/useWorkspaceTierLabel'
import { useDialogService } from '@/services/dialogService'

const emit = defineEmits<{
  close: []
}>()

const { buildDocsUrl, docsPaths } = useExternalLink()

const { userDisplayName, userEmail, userPhotoUrl, handleSignOut } =
  useCurrentUser()
const settingsDialog = useSettingsDialog()
const dialogService = useDialogService()
const {
  isActiveSubscription,
  isFreeTier,
  tier,
  subscription,
  balance,
  isLoading,
  fetchStatus,
  fetchBalance
} = useBillingContext()
const { formatTierName } = useWorkspaceTierLabel()
const subscriptionDialog = useSubscriptionDialog()
const { locale } = useI18n()

const subscriptionTierName = computed(() =>
  formatTierName(tier.value, subscription.value?.duration === 'ANNUAL')
)

const formattedBalance = computed(() => {
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

const canUpgrade = computed(() => {
  const currentTier = tier.value
  return (
    currentTier === 'FREE' ||
    currentTier === 'FOUNDERS_EDITION' ||
    currentTier === 'STANDARD' ||
    currentTier === 'CREATOR'
  )
})

const handleOpenUserSettings = () => {
  settingsDialog.show('user')
  emit('close')
}

const handleOpenPlansAndPricing = () => {
  subscriptionDialog.showPricingTable()
  emit('close')
}

const handleOpenPlanAndCreditsSettings = () => {
  if (isCloud) {
    settingsDialog.show('subscription')
  } else {
    settingsDialog.show('credits')
  }

  emit('close')
}

const handleTopUp = () => {
  // Track purchase credits entry from avatar popover
  useTelemetry()?.trackAddApiCreditButtonClicked()
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

const handleUpgradeToAddCredits = () => {
  subscriptionDialog.showPricingTable()
  emit('close')
}

const handleLogout = async () => {
  await handleSignOut()
  emit('close')
}

const handleSubscribed = async () => {
  await fetchStatus()
}

onMounted(() => {
  void fetchBalance()
})
</script>

<!-- A popover that shows current user information and actions -->
<template>
  <div
    class="current-user-popover -m-3 w-80 rounded-lg border border-border-default bg-base-background p-2 shadow-[1px_1px_8px_0_rgba(0,0,0,0.4)]"
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
      <p
        v-if="userEmail"
        class="my-0 truncate text-sm text-muted"
      >
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
    <div
      v-if="isActiveSubscription"
      class="flex items-center gap-2 px-4 py-2"
    >
      <i class="icon-[lucide--component] text-sm text-amber-400" />
      <Skeleton
        v-if="authStore.isFetchingBalance"
        width="4rem"
        height="1.25rem"
        class="w-full"
      />
      <span
        v-else
        class="text-base font-semibold text-base-foreground"
      >{{
        formattedBalance
      }}</span>
      <i
        v-tooltip="{ value: $t('credits.unified.tooltip'), showDelay: 300 }"
        class="mr-auto icon-[lucide--circle-help] cursor-help text-base text-muted-foreground"
      />
      <Button
        variant="secondary"
        size="sm"
        class="text-base-foreground"
        data-testid="add-credits-button"
        @click="handleTopUp"
      >
        {{ $t('subscription.addCredits') }}
      </Button>
    </div>

    <div
      v-else
      class="flex justify-center px-4"
    >
      <SubscribeButton
        :fluid="false"
        :label="$t('subscription.subscribeToComfyCloud')"
        size="sm"
        variant="gradient"
        @subscribed="handleSubscribed"
      />
    </div>

    <Divider class="mx-0 my-2" />

    <div
      v-if="isActiveSubscription"
      class="flex cursor-pointer items-center gap-2 px-4 py-2 hover:bg-secondary-background-hover"
      data-testid="partner-nodes-menu-item"
      @click="handleOpenPartnerNodesInfo"
    >
      <i class="icon-[lucide--tag] text-sm text-muted-foreground" />
      <span class="flex-1 text-sm text-base-foreground">{{
        $t('subscription.partnerNodesCredits')
      }}</span>
    </div>

    <div
      class="flex cursor-pointer items-center gap-2 px-4 py-2 hover:bg-secondary-background-hover"
      data-testid="plans-pricing-menu-item"
      @click="handleOpenPlansAndPricing"
    >
      <i class="icon-[lucide--receipt-text] text-sm text-muted-foreground" />
      <span class="flex-1 text-sm text-base-foreground">{{
        $t('subscription.plansAndPricing')
      }}</span>
      <span
        v-if="canUpgrade"
        class="rounded-full bg-base-foreground px-1.5 py-0.5 text-xs font-bold text-base-background"
      >
        {{ $t('subscription.upgrade') }}
      </span>
    </div>

    <div
      v-if="isActiveSubscription"
      class="flex cursor-pointer items-center gap-2 px-4 py-2 hover:bg-secondary-background-hover"
      data-testid="manage-plan-menu-item"
      @click="handleOpenPlanAndCreditsSettings"
    >
      <i class="icon-[lucide--file-text] text-sm text-muted-foreground" />
      <span class="flex-1 text-sm text-base-foreground">{{
        $t('subscription.managePlan')
      }}</span>
    </div>

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
import Divider from 'primevue/divider'
import Skeleton from 'primevue/skeleton'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatCreditsFromCents } from '@/base/credits/comfyCredits'
import UserAvatar from '@/components/common/UserAvatar.vue'
import Button from '@/components/ui/button/Button.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import { useExternalLink } from '@/composables/useExternalLink'
import SubscribeButton from '@/platform/cloud/subscription/components/SubscribeButton.vue'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { useDialogService } from '@/services/dialogService'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

const emit = defineEmits<{
  close: []
}>()

const { buildDocsUrl, docsPaths } = useExternalLink()

const { userDisplayName, userEmail, userPhotoUrl, handleSignOut } =
  useCurrentUser()
const authActions = useFirebaseAuthActions()
const authStore = useFirebaseAuthStore()
const dialogService = useDialogService()
const {
  isActiveSubscription,
  subscriptionTierName,
  subscriptionTier,
  fetchStatus
} = useSubscription()
const subscriptionDialog = useSubscriptionDialog()
const { locale } = useI18n()

const formattedBalance = computed(() => {
  const cents =
    authStore.balance?.effective_balance_micros ??
    authStore.balance?.amount_micros ??
    0
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
  const tier = subscriptionTier.value
  return (
    tier === 'FOUNDERS_EDITION' || tier === 'STANDARD' || tier === 'CREATOR'
  )
})

const handleOpenUserSettings = () => {
  dialogService.showSettingsDialog('user')
  emit('close')
}

const handleOpenPlansAndPricing = () => {
  subscriptionDialog.show()
  emit('close')
}

const handleOpenPlanAndCreditsSettings = () => {
  if (isCloud) {
    dialogService.showSettingsDialog('subscription')
  } else {
    dialogService.showSettingsDialog('credits')
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

const handleLogout = async () => {
  await handleSignOut()
  emit('close')
}

const handleSubscribed = async () => {
  await fetchStatus()
}

onMounted(() => {
  void authActions.fetchBalance()
})
</script>

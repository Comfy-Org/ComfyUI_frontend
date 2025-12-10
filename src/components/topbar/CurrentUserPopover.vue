<!-- A popover that shows current user information and actions -->
<template>
  <div
    class="current-user-popover w-80 -m-3 p-2 rounded-lg border border-border-default bg-base-background shadow-[1px_1px_8px_0_rgba(0,0,0,0.4)]"
  >
    <!-- User Info Section -->
    <div class="flex flex-col items-center px-0 py-3 mb-4">
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

    <!-- Credits Section -->
    <div v-if="isActiveSubscription" class="flex items-center gap-2 px-4 py-2">
      <i class="icon-[lucide--component] text-amber-400 text-sm" />
      <span class="text-base font-normal text-base-foreground flex-1">{{
        formattedBalance
      }}</span>
      <Button
        :label="$t('subscription.addCredits')"
        severity="secondary"
        size="small"
        class="text-base-foreground"
        data-testid="add-credits-button"
        @click="handleTopUp"
      />
    </div>

    <SubscribeButton
      v-else
      class="mx-4"
      :label="$t('subscription.subscribeToComfyCloud')"
      size="small"
      variant="gradient"
      @subscribed="handleSubscribed"
    />

    <!-- Credits info row -->
    <div
      v-if="flags.subscriptionTiersEnabled && isActiveSubscription"
      class="flex items-center gap-2 px-4 py-0"
    >
      <i
        v-tooltip="{
          value: $t('credits.unified.tooltip'),
          showDelay: 300,
          hideDelay: 300
        }"
        class="icon-[lucide--circle-help] cursor-help text-xs text-muted-foreground"
      />
      <span class="text-sm text-muted-foreground">{{
        $t('credits.unified.message')
      }}</span>
    </div>

    <Divider class="my-2 mx-0" />

    <div
      v-if="isActiveSubscription"
      class="flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-secondary-background-hover"
      data-testid="partner-nodes-menu-item"
      @click="handleOpenPartnerNodesInfo"
    >
      <i class="icon-[lucide--tag] text-muted-foreground text-sm" />
      <span class="text-sm text-base-foreground flex-1">{{
        $t('subscription.partnerNodesCredits')
      }}</span>
    </div>

    <div
      v-if="isActiveSubscription"
      class="flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-secondary-background-hover"
      data-testid="plan-credits-menu-item"
      @click="handleOpenPlanAndCreditsSettings"
    >
      <i class="icon-[lucide--receipt-text] text-muted-foreground text-sm" />
      <span class="text-sm text-base-foreground flex-1">{{
        $t(planSettingsLabel)
      }}</span>
    </div>

    <div
      class="flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-secondary-background-hover"
      data-testid="user-settings-menu-item"
      @click="handleOpenUserSettings"
    >
      <i class="icon-[lucide--settings-2] text-muted-foreground text-sm" />
      <span class="text-sm text-base-foreground flex-1">{{
        $t('userSettings.title')
      }}</span>
    </div>

    <Divider class="my-2 mx-0" />

    <div
      class="flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-secondary-background-hover"
      data-testid="logout-menu-item"
      @click="handleLogout"
    >
      <i class="icon-[lucide--log-out] text-muted-foreground text-sm" />
      <span class="text-sm text-base-foreground flex-1">{{
        $t('auth.signOut.signOut')
      }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatCreditsFromCents } from '@/base/credits/comfyCredits'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import { useExternalLink } from '@/composables/useExternalLink'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import SubscribeButton from '@/platform/cloud/subscription/components/SubscribeButton.vue'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { useDialogService } from '@/services/dialogService'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

const emit = defineEmits<{
  close: []
}>()

const { buildDocsUrl } = useExternalLink()

const planSettingsLabel = isCloud
  ? 'settingsCategories.PlanCredits'
  : 'settingsCategories.Credits'

const { userDisplayName, userEmail, userPhotoUrl, handleSignOut } =
  useCurrentUser()
const authActions = useFirebaseAuthActions()
const authStore = useFirebaseAuthStore()
const dialogService = useDialogService()
const { isActiveSubscription, fetchStatus } = useSubscription()
const { flags } = useFeatureFlags()
const { locale } = useI18n()

const formattedBalance = computed(() => {
  // Backend returns cents despite the *_micros naming convention.
  const cents = authStore.balance?.amount_micros ?? 0
  return formatCreditsFromCents({
    cents,
    locale: locale.value,
    numberOptions: {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }
  })
})

const handleOpenUserSettings = () => {
  dialogService.showSettingsDialog('user')
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
    buildDocsUrl('/tutorials/api-nodes/overview#api-nodes', {
      includeLocale: true
    }),
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

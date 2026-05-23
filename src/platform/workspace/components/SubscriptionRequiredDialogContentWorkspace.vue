<template>
  <div
    class="relative flex h-full flex-col gap-6 overflow-y-auto p-4 pt-8 md:px-16 md:py-8"
  >
    <Button
      v-if="checkoutStep === 'preview'"
      size="icon"
      variant="muted-textonly"
      class="absolute top-2.5 left-2.5 shrink-0 rounded-full text-text-secondary hover:bg-white/10"
      :aria-label="$t('g.back')"
      @click="handleBackToPricing"
    >
      <i class="pi pi-arrow-left text-xl" />
    </Button>

    <Button
      size="icon"
      variant="muted-textonly"
      class="absolute top-2.5 right-2.5 shrink-0 rounded-full text-text-secondary hover:bg-white/10"
      :aria-label="$t('g.close')"
      @click="onClose"
    >
      <i class="pi pi-times text-xl" />
    </Button>

    <div class="flex flex-col items-center gap-3">
      <!-- Decorative initial for "Team" workspace icon; not user-facing text -->
      <div
        class="flex size-10 items-center justify-center rounded-xl bg-primary-background text-lg font-semibold text-white"
        aria-hidden="true"
      >
        T
      </div>
      <i18n-t
        keypath="subscription.plansForWorkspace"
        tag="h2"
        class="m-0 font-inter text-2xl font-semibold text-base-foreground"
      >
        <template #workspace>
          <span class="text-emerald-400">
            {{ $t('subscription.teamWorkspace') }}
          </span>
        </template>
      </i18n-t>
    </div>

    <div v-if="reason === 'out_of_credits'" class="text-center">
      <h2 class="m-0 text-xl text-muted-foreground lg:text-2xl">
        {{ $t('credits.topUp.insufficientTitle') }}
      </h2>
      <p class="m-0 mt-2 text-sm text-text-secondary">
        {{ $t('credits.topUp.insufficientMessage') }}
      </p>
    </div>

    <!-- Pricing Table Step -->
    <PricingTableWorkspace
      v-if="checkoutStep === 'pricing'"
      class="flex-1"
      :is-loading="isLoadingPreview || isResubscribing"
      :loading-tier="loadingTier"
      @subscribe="handleSubscribeClick"
      @resubscribe="handleResubscribe"
    />

    <!-- Subscription Preview Step - New Subscription -->
    <SubscriptionAddPaymentPreviewWorkspace
      v-else-if="
        checkoutStep === 'preview' &&
        previewData &&
        previewData.transition_type === 'new_subscription'
      "
      :preview-data="previewData"
      :tier-key="selectedTierKey!"
      :billing-cycle="selectedBillingCycle"
      :is-loading="isSubscribing || isPolling"
      @add-credit-card="handleAddCreditCard"
      @back="handleBackToPricing"
    />

    <!-- Subscription Preview Step - Plan Transition -->
    <SubscriptionTransitionPreviewWorkspace
      v-else-if="
        checkoutStep === 'preview' &&
        previewData &&
        previewData.transition_type !== 'new_subscription'
      "
      :preview-data="previewData"
      :is-loading="isSubscribing || isPolling"
      @confirm="handleConfirmTransition"
      @back="handleBackToPricing"
    />
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import type { SubscriptionDialogReason } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import { useSubscriptionCheckout } from '@/platform/workspace/composables/useSubscriptionCheckout'

import PricingTableWorkspace from './PricingTableWorkspace.vue'
import SubscriptionAddPaymentPreviewWorkspace from './SubscriptionAddPaymentPreviewWorkspace.vue'
import SubscriptionTransitionPreviewWorkspace from './SubscriptionTransitionPreviewWorkspace.vue'

const { onClose, reason } = defineProps<{
  onClose: () => void
  reason?: SubscriptionDialogReason
}>()

const emit = defineEmits<{
  close: [subscribed: boolean]
}>()

const {
  checkoutStep,
  isLoadingPreview,
  loadingTier,
  isSubscribing,
  isResubscribing,
  previewData,
  selectedTierKey,
  selectedBillingCycle,
  isPolling,
  handleSubscribeClick,
  handleBackToPricing,
  handleAddCreditCard,
  handleConfirmTransition,
  handleResubscribe
} = useSubscriptionCheckout(emit)
</script>

<style scoped>
.legacy-dialog :deep(.bg-comfy-menu-secondary) {
  background-color: transparent;
}

.legacy-dialog :deep(.p-button) {
  color: white;
}
</style>

<template>
  <div
    class="relative flex h-full max-h-[90vh] w-[calc(100vw-1rem)] flex-col gap-6 overflow-y-auto rounded-2xl border bg-secondary p-4 pt-8 shadow-2xl sm:max-w-7xl md:px-16 md:py-8"
  >
    <Button
      size="icon"
      variant="muted-textonly"
      class="absolute top-2.5 right-2.5 shrink-0 rounded-full hover:bg-white/10"
      :aria-label="$t('g.close')"
      @click="onClose"
    >
      <i class="pi pi-times text-xl" />
    </Button>

    <div
      v-if="checkoutStep === 'pricing'"
      class="flex flex-col items-center gap-3"
    >
      <div
        :class="
          cn(
            'flex size-10 items-center justify-center rounded-xl text-lg font-semibold text-white',
            isPersonal ? 'bg-muted-foreground/30' : 'bg-primary'
          )
        "
        aria-hidden="true"
      >
        {{ isPersonal ? 'P' : 'T' }}
      </div>
      <DialogTitle class="m-0 font-inter text-2xl">
        <i18n-t keypath="subscription.plansForWorkspace">
          <template #workspace>
            <span
              :class="isPersonal ? 'text-muted-foreground' : 'text-emerald-400'"
            >
              {{
                isPersonal
                  ? $t('subscription.personalWorkspace')
                  : $t('subscription.teamWorkspace')
              }}
            </span>
          </template>
        </i18n-t>
      </DialogTitle>
    </div>

    <div
      v-if="reason === 'out_of_credits'"
      class="text-center text-muted-foreground"
    >
      <h2 class="m-0 text-xl lg:text-2xl">
        {{ $t('credits.topUp.insufficientTitle') }}
      </h2>
      <p class="m-0 mt-2 text-sm">
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
      :action-url="activeCheckoutActionUrl"
      :authentication-state
      :parked-checkout-recovery
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
      :action-url="activeCheckoutActionUrl"
      :force-reactivation="reactivationRequired"
      :authentication-state
      :payment-cancelable
      :canceling-payment="isCancelingPayment"
      :cancel-payment-error
      @cancel-payment="cancelPayment"
      @confirm="handleConfirmTransition"
      @back="handleBackToPricing"
    />

    <!-- Success Step - subscribe/change-plan confirmation -->
    <SubscriptionSuccessWorkspace
      v-else-if="checkoutStep === 'success' && selectedTierKey"
      :tier-key="selectedTierKey"
      :preview-data="previewData"
      @close="handleSuccessClose"
    />
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { onMounted } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import type { PaymentIntentSource } from '@/platform/telemetry/types'
import type { SubscriptionCheckoutSelection } from '@/platform/billing/composables/types'
import { useSubscriptionCheckout } from '@/platform/billing/composables/useSubscriptionCheckout'

import PricingTableWorkspace from './PricingTableWorkspace.vue'
import SubscriptionAddPaymentPreviewWorkspace from './SubscriptionAddPaymentPreviewWorkspace.vue'
import SubscriptionSuccessWorkspace from './SubscriptionSuccessWorkspace.vue'
import SubscriptionTransitionPreviewWorkspace from './SubscriptionTransitionPreviewWorkspace.vue'

const {
  onClose,
  reason,
  paymentIntentSource,
  isPersonal = false,
  initialCheckout
} = defineProps<{
  onClose: () => void
  reason?: PaymentIntentSource
  paymentIntentSource: PaymentIntentSource | undefined
  isPersonal?: boolean
  initialCheckout?: SubscriptionCheckoutSelection
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
  reactivationRequired,
  selectedTierKey,
  selectedBillingCycle,
  activeCheckoutActionUrl,
  authenticationState,
  parkedCheckoutRecovery,
  isPolling,
  paymentCancelable,
  isCancelingPayment,
  cancelPaymentError,
  cancelPayment,
  handleSubscribeClick,
  handleBackToPricing,
  handleAddCreditCard,
  handleConfirmTransition,
  handleResubscribe,
  handleSuccessClose
} = useSubscriptionCheckout(emit, paymentIntentSource, {
  tierPlanType: isPersonal ? 'personal' : 'team'
})

onMounted(() => {
  if (initialCheckout?.planMode === 'personal') {
    void handleSubscribeClick(initialCheckout)
  }
})
</script>

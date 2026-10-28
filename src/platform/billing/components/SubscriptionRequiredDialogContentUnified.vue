<template>
  <div
    :class="
      cn(
        'relative flex h-full max-h-[90vh] max-w-[min(1280px,95vw)] flex-col gap-4 overflow-y-auto rounded-2xl border bg-secondary p-4 pt-6 shadow-2xl',
        checkoutStep === 'pricing' &&
          'xl:min-h-[min(740px,90vh)] xl:w-[min(1280px,95vw)]'
      )
    "
  >
    <Button
      size="icon"
      variant="muted-textonly"
      class="absolute top-6 right-4 shrink-0 rounded-full hover:bg-white/10"
      :aria-label="$t('g.close')"
      @click="onClose"
    >
      <i class="icon-[lucide--x] size-5" />
    </Button>

    <!-- The confirm and success steps title themselves. -->
    <div
      v-if="checkoutStep === 'pricing'"
      class="flex flex-col items-center gap-3"
    >
      <DialogTitle class="m-0 text-2xl">
        {{ $t('subscription.descriptionWorkspace') }}
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

    <!-- Pricing Table Step. v-show (not v-if) keeps it mounted so the plan,
         billing cycle, and credit-stop selection survive a round trip to the
         confirm step and back. -->
    <UnifiedPricingTable
      v-show="checkoutStep === 'pricing'"
      class="xl:flex-1"
      :initial-plan-mode="initialPlanMode"
      :is-loading="isLoadingPreview || isResubscribing"
      :loading-tier="loadingTier"
      :outstanding-payment-refusals="outstandingPaymentRefusals"
      @subscribe="handleSubscribeClick"
      @resubscribe="handleResubscribe"
      @subscribe-team="handleSubscribeTeamClick"
    />

    <template v-if="checkoutStep === 'preview'">
      <SubscriptionTransitionPreviewWorkspace
        v-if="
          (previewVariant === 'team-change' ||
            previewVariant === 'personal-change') &&
          previewData
        "
        :preview-data="previewData"
        :team-plan="isTeamPreview ? selectedTeamStop : null"
        :is-loading="isPreviewLoading"
        :action-url="activeCheckoutActionUrl"
        :force-reactivation="reactivationRequired"
        :authentication-state
        :payment-cancelable
        :canceling-payment="isCancelingPayment"
        :cancel-payment-error
        @cancel-payment="cancelPayment"
        @confirm="
          isTeamPreview
            ? handleTeamSubscribe($event)
            : handleConfirmTransition($event)
        "
        @back="handleBackToPricing"
      />

      <SubscriptionAddPaymentPreviewWorkspace
        v-else-if="
          previewVariant === 'team-new' || previewVariant === 'personal-new'
        "
        :preview-data="previewData"
        :team-plan="isTeamPreview ? selectedTeamStop : null"
        :tier-key="isTeamPreview ? undefined : (selectedTierKey ?? undefined)"
        :billing-cycle="selectedBillingCycle"
        :is-loading="isPreviewLoading"
        :action-url="activeCheckoutActionUrl"
        :authentication-state
        :parked-checkout-recovery
        @add-credit-card="
          isTeamPreview ? handleTeamSubscribe() : handleAddCreditCard()
        "
        @back="handleBackToPricing"
      />
    </template>

    <!-- Success Step - "You're all set" -->
    <SubscriptionSuccessWorkspace
      v-if="checkoutStep === 'success' && (selectedTierKey || isTeamCheckout)"
      :tier-key="selectedTierKey"
      :team-plan="selectedTeamStop"
      :preview-data="previewData"
      :billing-cycle="selectedBillingCycle"
      @close="handleSuccessClose"
    />
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useEventListener } from '@vueuse/core'
import { computed, onMounted } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'
import { isCloud } from '@/platform/distribution/types'
import type { PaymentIntentSource } from '@comfyorg/telemetry/types'
import type { SubscriptionCheckoutSelection } from '@/platform/billing/composables/types'
import { usePaymentRecoveryDialog } from '@/platform/billing/composables/usePaymentRecoveryDialog'
import { useSubscriptionCheckout } from '@/platform/billing/composables/useSubscriptionCheckout'

import SubscriptionAddPaymentPreviewWorkspace from './SubscriptionAddPaymentPreviewWorkspace.vue'
import SubscriptionSuccessWorkspace from './SubscriptionSuccessWorkspace.vue'
import SubscriptionTransitionPreviewWorkspace from './SubscriptionTransitionPreviewWorkspace.vue'
import UnifiedPricingTable from './UnifiedPricingTable.vue'

const {
  onClose,
  reason,
  paymentIntentSource,
  initialPlanMode,
  initialCheckout
} = defineProps<{
  onClose: () => void
  reason?: PaymentIntentSource
  paymentIntentSource: PaymentIntentSource | undefined
  initialPlanMode?: 'personal' | 'team'
  initialCheckout?: SubscriptionCheckoutSelection
}>()

const emit = defineEmits<{
  close: [subscribed: boolean]
}>()

const { paymentRecoveryLock } = usePaymentRecoveryDialog()

const {
  checkoutStep,
  isLoadingPreview,
  loadingTier,
  isSubscribing,
  outstandingPaymentRefusals,
  isResubscribing,
  previewData,
  reactivationRequired,
  selectedTierKey,
  selectedTeamStop,
  selectedBillingCycle,
  activeCheckoutActionUrl,
  authenticationState,
  parkedCheckoutRecovery,
  isPolling,
  paymentCancelable,
  isCancelingPayment,
  cancelPaymentError,
  cancelPayment,
  isTeamCheckout,
  previewVariant,
  handleSubscribeClick,
  handleSubscribeTeamClick,
  handleBackToPricing,
  handleSuccessClose,
  handleAddCreditCard,
  handleConfirmTransition,
  handleTeamSubscribe,
  handleResubscribe
} = useSubscriptionCheckout(emit, paymentIntentSource, {
  rendersPastDueNotice: () => isCloud && paymentRecoveryLock.value === 'owner'
})

const isTeamPreview = computed(
  () =>
    previewVariant.value === 'team-new' ||
    previewVariant.value === 'team-change'
)
const isPreviewLoading = computed(
  () =>
    isSubscribing.value ||
    isPolling.value ||
    (isTeamPreview.value && isLoadingPreview.value)
)

onMounted(() => {
  if (!initialCheckout) return
  if (initialCheckout.planMode === 'team') {
    void handleSubscribeTeamClick(initialCheckout)
    return
  }
  void handleSubscribeClick(initialCheckout)
})

useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (
    event.key !== 'Backspace' ||
    checkoutStep.value !== 'preview' ||
    isPolling.value
  )
    return
  const target = event.target
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  ) {
    return
  }
  event.preventDefault()
  handleBackToPricing()
})
</script>

<template>
  <div
    ref="contentRoot"
    :class="
      cn(
        'relative flex h-full flex-col gap-4 overflow-y-auto p-4 pt-6',
        (checkoutStep === 'pricing' || isEmbeddedPaymentStep) &&
          'xl:min-h-[min(740px,90vh)] xl:w-[min(1280px,95vw)]',
        // Pin the embedded step to the pricing table's exact height (min-h
        // alone is a floor — the Stripe iframe would stretch the dialog once
        // mounted) and hand scrolling to the payment column so the summary
        // panel stays fixed; below xl the whole dialog scrolls as before.
        isEmbeddedPaymentStep &&
          'xl:h-[min(740px,90vh)] xl:gap-0 xl:overflow-hidden xl:rounded-2xl xl:p-0',
        (isEmbeddedSuccessStep ||
          isEmbeddedConfirmStep ||
          isDeclinedStep ||
          isVerifyingStep) &&
          'h-[min(740px,85vh)] overflow-hidden rounded-2xl bg-base-background xl:h-[min(740px,90vh)] xl:w-[512px]',
        (isEmbeddedPaymentStep ||
          isEmbeddedSuccessStep ||
          isEmbeddedConfirmStep ||
          isDeclinedStep ||
          isVerifyingStep) &&
          'motion-safe:xl:transition-[width] motion-safe:xl:duration-300 motion-safe:xl:ease-in-out',
        // The w-fit shell hugs min-content on phones; give the embedded
        // steps a real width floor below xl.
        (isEmbeddedPaymentStep ||
          isEmbeddedSuccessStep ||
          isEmbeddedConfirmStep ||
          isDeclinedStep ||
          isVerifyingStep) &&
          'max-xl:w-[min(430px,92vw)]',
        isEmbeddedPaymentStep && 'max-xl:h-[85vh]'
      )
    "
  >
    <Button
      v-if="
        checkoutStep === 'preview' &&
        !isEmbeddedPaymentStep &&
        !isEmbeddedConfirmStep
      "
      size="icon"
      variant="muted-textonly"
      class="absolute top-2.5 left-2.5 shrink-0 rounded-full text-text-secondary hover:bg-white/10"
      :aria-label="$t('g.back')"
      :disabled="isPolling"
      @click="handleBackToPricing"
    >
      <i class="pi pi-arrow-left text-xl" />
    </Button>

    <Button
      size="icon"
      variant="muted-textonly"
      class="absolute top-6 right-4 shrink-0 rounded-full text-text-secondary hover:bg-white/10"
      :aria-label="$t('g.close')"
      @click="onClose"
    >
      <i class="pi pi-times text-xl" />
    </Button>

    <!-- The embedded payment step titles itself ("Confirm your payment");
         stacking "Choose a Plan" above it doubled the header and made this
         step taller than the pricing table. -->
    <div
      v-if="
        !isEmbeddedPaymentStep &&
        !isEmbeddedSuccessStep &&
        !isEmbeddedConfirmStep &&
        !isDeclinedStep &&
        !isVerifyingStep
      "
      class="flex flex-col items-center gap-3"
    >
      <h2 class="m-0 font-inter text-2xl font-semibold text-base-foreground">
        {{ $t('subscription.descriptionWorkspace') }}
      </h2>
    </div>

    <div v-if="reason === 'out_of_credits'" class="text-center">
      <h2 class="m-0 text-xl text-muted-foreground lg:text-2xl">
        {{ $t('credits.topUp.insufficientTitle') }}
      </h2>
      <p class="m-0 mt-2 text-sm text-text-secondary">
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
      @subscribe="handleSubscribeClick"
      @resubscribe="handleResubscribe"
      @subscribe-team="handleSubscribeTeamClick"
    />

    <template v-if="checkoutStep === 'preview'">
      <SubscriptionTransitionPreviewWorkspace
        v-if="previewVariant === 'team-change'"
        :preview-data="previewData!"
        :team-plan="selectedTeamStop!"
        :is-loading="isSubscribing || isPolling"
        :action-url="activeCheckoutActionUrl"
        :cancel-unavailable="cancelUnavailable"
        :is-canceling="isCancelingPayment"
        :show-canceled-notice="canceledNoticeVisible"
        @confirm="handleTeamSubscribe"
        @cancel-payment="handleCancelPendingPayment"
        @back="handleBackToPricing"
      />

      <SubscriptionAddPaymentPreviewWorkspace
        v-else-if="previewVariant === 'team-new'"
        :team-plan="selectedTeamStop!"
        :billing-cycle="selectedBillingCycle"
        :is-loading="isSubscribing || isPolling"
        :action-url="activeCheckoutActionUrl"
        :use-payment-element="stripePaymentElementEnabled"
        :saved-methods="savedMethodsForConfirm"
        :cancel-unavailable="cancelUnavailable"
        :is-canceling="isCancelingPayment"
        :show-canceled-notice="canceledNoticeVisible"
        @add-credit-card="handleTeamSubscribe"
        @change-payment-method="savedMethodsForConfirm = null"
        @confirm-payment="handleTeamSubscriptionPayment"
        @cancel-payment="handleCancelPendingPayment"
        @back="handleBackToPricing"
      />

      <SubscriptionAddPaymentPreviewWorkspace
        v-else-if="previewVariant === 'personal-new'"
        :preview-data="previewData"
        :tier-key="selectedTierKey!"
        :billing-cycle="selectedBillingCycle"
        :is-loading="isSubscribing || isPolling"
        :action-url="activeCheckoutActionUrl"
        :use-payment-element="stripePaymentElementEnabled"
        :saved-methods="savedMethodsForConfirm"
        :cancel-unavailable="cancelUnavailable"
        :is-canceling="isCancelingPayment"
        :show-canceled-notice="canceledNoticeVisible"
        @add-credit-card="handleAddCreditCard"
        @change-payment-method="savedMethodsForConfirm = null"
        @confirm-payment="handleSubscriptionPayment"
        @cancel-payment="handleCancelPendingPayment"
        @back="handleBackToPricing"
      />

      <SubscriptionTransitionPreviewWorkspace
        v-else-if="previewVariant === 'personal-change'"
        :preview-data="previewData!"
        :is-loading="isSubscribing || isPolling"
        :action-url="activeCheckoutActionUrl"
        :cancel-unavailable="cancelUnavailable"
        :is-canceling="isCancelingPayment"
        :show-canceled-notice="canceledNoticeVisible"
        @confirm="handleConfirmTransition"
        @cancel-payment="handleCancelPendingPayment"
        @back="handleBackToPricing"
      />
    </template>

    <SubscriptionVerifyingWorkspace
      v-if="checkoutStep === 'verifying'"
      :action-url="activeCheckoutActionUrl"
      :cancel-unavailable="cancelUnavailable"
      :is-canceling="isCancelingPayment"
      @cancel-payment="handleCancelPendingPayment"
    />

    <!-- Success Step - "You're all set" -->
    <SubscriptionSuccessWorkspace
      v-if="checkoutStep === 'success' && (selectedTierKey || isTeamCheckout)"
      :tier-key="selectedTierKey"
      :team-plan="selectedTeamStop"
      :preview-data="previewData"
      :is-team="isTeamCheckout"
      :dark-surface="isEmbeddedSuccessStep"
      @close="handleSuccessClose"
    />

    <SubscriptionPaymentDeclinedWorkspace
      v-if="checkoutStep === 'declined'"
      :reason="checkoutDeclineReason"
      @back="handleDeclinedBack"
      @update-payment="handleUpdatePayment"
    />
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useEventListener } from '@vueuse/core'
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type { PaymentIntentSource } from '@/platform/telemetry/types'
import type { SubscriptionCheckoutSelection } from '@/platform/workspace/composables/useSubscriptionCheckout'
import { useSubscriptionCheckout } from '@/platform/workspace/composables/useSubscriptionCheckout'

import SubscriptionAddPaymentPreviewWorkspace from './SubscriptionAddPaymentPreviewWorkspace.vue'
import SubscriptionPaymentDeclinedWorkspace from './SubscriptionPaymentDeclinedWorkspace.vue'
import type { SavedPaymentMethod } from './SubscriptionAddPaymentPreviewWorkspace.vue'
import SubscriptionSuccessWorkspace from './SubscriptionSuccessWorkspace.vue'
import SubscriptionTransitionPreviewWorkspace from './SubscriptionTransitionPreviewWorkspace.vue'
import SubscriptionVerifyingWorkspace from './SubscriptionVerifyingWorkspace.vue'
import UnifiedPricingTable from './UnifiedPricingTable.vue'

const { onClose, reason, initialPlanMode, initialCheckout } = defineProps<{
  onClose: () => void
  reason?: PaymentIntentSource
  initialPlanMode?: 'personal' | 'team'
  initialCheckout?: SubscriptionCheckoutSelection
}>()

const emit = defineEmits<{
  close: [subscribed: boolean]
}>()

const stripePaymentElementEnabled = Boolean(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
)

// The embedded-payment confirm step keeps the pricing table's dialog
// dimensions so stepping between them reads as one dialog changing content,
// not two dialogs. Transition previews (no payment form) stay narrow.
// Default payment method for the confirming workspace. The backend does not
// expose this pre-confirm yet; once it does, populate from the preview
// response and the capture form becomes first-subscribe-only.
const savedMethodsForConfirm = ref<SavedPaymentMethod[] | null>(null)

const isEmbeddedPaymentStep = computed(
  () =>
    checkoutStep.value === 'preview' &&
    stripePaymentElementEnabled &&
    !savedMethodsForConfirm.value?.length &&
    (previewVariant.value === 'team-new' ||
      previewVariant.value === 'personal-new')
)

// Narrow confirms share the success step's width and dark surface: a fresh
// subscribe once a saved method exists, and every plan-change preview (those
// always charge the saved method).
const isEmbeddedConfirmStep = computed(
  () =>
    checkoutStep.value === 'preview' &&
    stripePaymentElementEnabled &&
    (previewVariant.value === 'team-change' ||
      previewVariant.value === 'personal-change' ||
      (!!savedMethodsForConfirm.value?.length &&
        (previewVariant.value === 'team-new' ||
          previewVariant.value === 'personal-new')))
)

// Success after an embedded checkout: same pinned height, narrow width, and
// the darker surface — the dialog collapses around the receipt.
const isEmbeddedSuccessStep = computed(
  () =>
    checkoutStep.value === 'success' &&
    stripePaymentElementEnabled &&
    (previewVariant.value === 'team-new' ||
      previewVariant.value === 'personal-new')
)

const isDeclinedStep = computed(() => checkoutStep.value === 'declined')

const isVerifyingStep = computed(() => checkoutStep.value === 'verifying')

const {
  checkoutStep,
  checkoutDeclineReason,
  handleDeclinedBack,
  handleUpdatePayment,
  isLoadingPreview,
  loadingTier,
  isSubscribing,
  isResubscribing,
  previewData,
  selectedTierKey,
  selectedTeamStop,
  selectedBillingCycle,
  activeCheckoutActionUrl,
  isPolling,
  isTeamCheckout,
  previewVariant,
  isCancelingPayment,
  cancelUnavailable,
  canceledNoticeVisible,
  handleCancelPendingPayment,
  handleSubscribeClick,
  handleSubscribeTeamClick,
  handleBackToPricing,
  handleSuccessClose,
  handleAddCreditCard,
  handleConfirmTransition,
  handleTeamSubscribe,
  handleSubscriptionPayment,
  handleTeamSubscriptionPayment,
  handleResubscribe
} = useSubscriptionCheckout(emit, reason)

onMounted(() => {
  if (!initialCheckout) return
  if (initialCheckout.planMode === 'team') {
    void handleSubscribeTeamClick(initialCheckout)
    return
  }
  void handleSubscribeClick(initialCheckout)
})

// Height transitions with an `auto` endpoint never engage in Chromium (even
// under interpolate-size), and CSS-transition FLIP gets eaten by the same
// patch cycle that swaps the step content — so the height tween runs on the
// Web Animations API instead, outside the CSS transition machinery. On
// desktop both steps pin the same height, so this no-ops.
const contentRoot = ref<HTMLElement>()
watch(
  [checkoutStep, () => !!savedMethodsForConfirm.value?.length] as const,
  async ([next, nextSaved], [prev, prevSaved]) => {
    const el = contentRoot.value
    if (!el || !stripePaymentElementEnabled) return
    const between = (a: string, b: string) =>
      (prev === a && next === b) || (prev === b && next === a)
    const savedFlip =
      next === 'preview' && prev === 'preview' && nextSaved !== prevSaved
    if (!between('preview', 'success') && !savedFlip) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const from = el.getBoundingClientRect().height
    await nextTick()
    const to = el.getBoundingClientRect().height
    if (Math.abs(from - to) < 2) return
    el.animate([{ height: `${from}px` }, { height: `${to}px` }], {
      duration: 300,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
    })
  }
)

// Backspace mirrors the back arrow on the confirm step, but never while an
// editable element is focused (let it delete text there).
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

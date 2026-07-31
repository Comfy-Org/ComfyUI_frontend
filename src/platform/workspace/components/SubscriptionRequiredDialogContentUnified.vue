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
        isEmbeddedSuccessStep &&
          'overflow-hidden rounded-2xl bg-base-background xl:h-[min(740px,90vh)] xl:w-[512px]',
        (isEmbeddedPaymentStep || isEmbeddedSuccessStep) &&
          'motion-safe:xl:transition-[width] motion-safe:xl:duration-300 motion-safe:xl:ease-in-out',
        // The w-fit shell hugs min-content on phones; give the embedded
        // steps a real width floor below xl.
        (isEmbeddedPaymentStep || isEmbeddedSuccessStep) &&
          'max-xl:w-[min(430px,92vw)]',
        isEmbeddedPaymentStep && 'max-xl:h-[85vh]'
      )
    "
  >
    <Button
      v-if="checkoutStep === 'preview' && !isEmbeddedPaymentStep"
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
      :class="
        cn(
          'absolute top-2.5 right-2.5 shrink-0 rounded-full text-text-secondary hover:bg-white/10',
          isEmbeddedPaymentStep && 'max-xl:hidden'
        )
      "
      :aria-label="$t('g.close')"
      @click="onClose"
    >
      <i class="pi pi-times text-xl" />
    </Button>

    <!-- The embedded payment step titles itself ("Confirm your payment");
         stacking "Choose a Plan" above it doubled the header and made this
         step taller than the pricing table. -->
    <div
      v-if="!isEmbeddedPaymentStep && !isEmbeddedSuccessStep"
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
        @confirm="handleTeamSubscribe"
        @back="handleBackToPricing"
      />

      <SubscriptionAddPaymentPreviewWorkspace
        v-else-if="previewVariant === 'team-new'"
        :team-plan="selectedTeamStop!"
        :billing-cycle="selectedBillingCycle"
        :is-loading="isSubscribing || isPolling"
        :action-url="activeCheckoutActionUrl"
        :use-payment-element="stripePaymentElementEnabled"
        @add-credit-card="handleTeamSubscribe"
        @confirm-payment="handleTeamSubscriptionPayment"
        @back="handleBackToPricing"
        @close="onClose"
      />

      <SubscriptionAddPaymentPreviewWorkspace
        v-else-if="previewVariant === 'personal-new'"
        :preview-data="previewData"
        :tier-key="selectedTierKey!"
        :billing-cycle="selectedBillingCycle"
        :is-loading="isSubscribing || isPolling"
        :action-url="activeCheckoutActionUrl"
        :use-payment-element="stripePaymentElementEnabled"
        @add-credit-card="handleAddCreditCard"
        @confirm-payment="handleSubscriptionPayment"
        @back="handleBackToPricing"
        @close="onClose"
      />

      <SubscriptionTransitionPreviewWorkspace
        v-else-if="previewVariant === 'personal-change'"
        :preview-data="previewData!"
        :is-loading="isSubscribing || isPolling"
        :action-url="activeCheckoutActionUrl"
        @confirm="handleConfirmTransition"
        @back="handleBackToPricing"
      />
    </template>

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
import SubscriptionSuccessWorkspace from './SubscriptionSuccessWorkspace.vue'
import SubscriptionTransitionPreviewWorkspace from './SubscriptionTransitionPreviewWorkspace.vue'
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
const isEmbeddedPaymentStep = computed(
  () =>
    checkoutStep.value === 'preview' &&
    stripePaymentElementEnabled &&
    (previewVariant.value === 'team-new' ||
      previewVariant.value === 'personal-new')
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

const {
  checkoutStep,
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
watch(checkoutStep, async (next, prev) => {
  const el = contentRoot.value
  if (!el || !stripePaymentElementEnabled) return
  const between = (a: string, b: string) =>
    (prev === a && next === b) || (prev === b && next === a)
  if (!between('preview', 'success')) return
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const from = el.getBoundingClientRect().height
  await nextTick()
  const to = el.getBoundingClientRect().height
  if (Math.abs(from - to) < 2) return
  el.animate([{ height: `${from}px` }, { height: `${to}px` }], {
    duration: 300,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
  })
})

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

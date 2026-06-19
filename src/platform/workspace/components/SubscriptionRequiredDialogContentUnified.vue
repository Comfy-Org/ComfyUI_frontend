<template>
  <div
    :class="
      cn(
        'relative flex h-full flex-col gap-4 overflow-y-auto p-4 pt-6',
        checkoutStep === 'pricing' &&
          'xl:min-h-[min(740px,90vh)] xl:w-[min(1280px,95vw)]'
      )
    "
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
      <!-- New Subscription -->
      <SubscriptionAddPaymentPreviewWorkspace
        v-if="previewData && previewData.transition_type === 'new_subscription'"
        :preview-data="previewData"
        :tier-key="selectedTierKey!"
        :billing-cycle="selectedBillingCycle"
        :is-loading="isSubscribing || isPolling"
        @add-credit-card="handleAddCreditCard"
        @back="handleBackToPricing"
      />

      <!-- Plan Transition -->
      <SubscriptionTransitionPreviewWorkspace
        v-else-if="
          previewData && previewData.transition_type !== 'new_subscription'
        "
        :preview-data="previewData"
        :is-loading="isSubscribing || isPolling"
        @confirm="handleConfirmTransition"
        @back="handleBackToPricing"
      />

      <!-- Team (display-only confirm; the slider stop and active billing cycle
           drive the real subscribe). -->
      <SubscriptionAddPaymentPreviewWorkspace
        v-else-if="selectedTeamStop"
        :team-plan="selectedTeamStop"
        :billing-cycle="selectedBillingCycle"
        :is-loading="isSubscribing || isPolling"
        @add-credit-card="handleTeamSubscribe"
        @back="handleBackToPricing"
      />
    </template>

    <!-- Success Step - "You're all set" -->
    <SubscriptionSuccessWorkspace
      v-if="checkoutStep === 'success' && selectedTierKey"
      :tier-key="selectedTierKey"
      :preview-data="previewData"
      @close="handleSuccessClose"
    />
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useEventListener } from '@vueuse/core'

import Button from '@/components/ui/button/Button.vue'
import type { SubscriptionDialogReason } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import { useSubscriptionCheckout } from '@/platform/workspace/composables/useSubscriptionCheckout'

import SubscriptionAddPaymentPreviewWorkspace from './SubscriptionAddPaymentPreviewWorkspace.vue'
import SubscriptionSuccessWorkspace from './SubscriptionSuccessWorkspace.vue'
import SubscriptionTransitionPreviewWorkspace from './SubscriptionTransitionPreviewWorkspace.vue'
import UnifiedPricingTable from './UnifiedPricingTable.vue'

const { onClose, reason, initialPlanMode } = defineProps<{
  onClose: () => void
  reason?: SubscriptionDialogReason
  initialPlanMode?: 'personal' | 'team'
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
  selectedTeamStop,
  selectedBillingCycle,
  isPolling,
  handleSubscribeClick,
  handleSubscribeTeamClick,
  handleBackToPricing,
  handleSuccessClose,
  handleAddCreditCard,
  handleConfirmTransition,
  handleTeamSubscribe,
  handleResubscribe
} = useSubscriptionCheckout(emit)

// Backspace mirrors the back arrow on the confirm step, but never while an
// editable element is focused (let it delete text there).
useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (event.key !== 'Backspace' || checkoutStep.value !== 'preview') return
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

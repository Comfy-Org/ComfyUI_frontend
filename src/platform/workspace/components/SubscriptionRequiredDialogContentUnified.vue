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

    <!-- Pricing Table Step (unified: personal/team plan toggle) -->
    <UnifiedPricingTable
      v-if="checkoutStep === 'pricing'"
      class="flex-1"
      :is-loading="isLoadingPreview || isResubscribing"
      :loading-tier="loadingTier"
      @subscribe="handleSubscribeClick"
      @resubscribe="handleResubscribe"
      @subscribe-team="handleSubscribeTeamClick"
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

    <!-- Subscription Preview Step - Team (display-only until the BE slider
         contract lands; the confirm CTA is stubbed below) -->
    <SubscriptionAddPaymentPreviewWorkspace
      v-else-if="checkoutStep === 'preview' && selectedTeamStop"
      :team-plan="selectedTeamStop"
      @add-credit-card="handleTeamSubscribe"
      @back="handleBackToPricing"
    />

    <!-- Success Step - "You're all set" -->
    <SubscriptionSuccessWorkspace
      v-else-if="checkoutStep === 'success' && selectedTierKey"
      :tier-key="selectedTierKey"
      :preview-data="previewData"
      @close="handleSuccessClose"
    />
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { SubscriptionDialogReason } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import { useSubscriptionCheckout } from '@/platform/workspace/composables/useSubscriptionCheckout'

import SubscriptionAddPaymentPreviewWorkspace from './SubscriptionAddPaymentPreviewWorkspace.vue'
import SubscriptionSuccessWorkspace from './SubscriptionSuccessWorkspace.vue'
import SubscriptionTransitionPreviewWorkspace from './SubscriptionTransitionPreviewWorkspace.vue'
import UnifiedPricingTable from './UnifiedPricingTable.vue'

const { onClose, reason } = defineProps<{
  onClose: () => void
  reason?: SubscriptionDialogReason
}>()

const emit = defineEmits<{
  close: [subscribed: boolean]
}>()

const { t } = useI18n()
const toast = useToast()

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
  handleResubscribe
} = useSubscriptionCheckout(emit)

// Personal-tier checkout reuses the full useSubscriptionCheckout flow above.
// Team-plan checkout renders the confirm step from the selected slider stop,
// but the final subscribe is blocked on the BE discount-breakpoint contract
// (FE-934 / doc Open Q#2: the slider stop -> plan-slug / subscribe-request shape
// is undefined), so the confirm CTA is stubbed until that lands.
function handleTeamSubscribe() {
  toast.add({
    severity: 'info',
    summary: t('subscription.teamPlan.name'),
    detail: t('subscription.teamPlan.checkoutComingSoon'),
    life: 4000
  })
}
</script>

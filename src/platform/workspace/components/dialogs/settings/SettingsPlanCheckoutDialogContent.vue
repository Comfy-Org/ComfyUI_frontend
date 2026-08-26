<template>
  <div
    class="relative flex max-h-[90vh] flex-col overflow-y-auto p-4 pt-10 md:px-8 md:pb-8"
    data-testid="settings-plan-checkout"
  >
    <Button
      v-if="checkoutStep === 'preview'"
      size="icon"
      variant="muted-textonly"
      class="absolute top-2.5 left-2.5 shrink-0 rounded-full text-text-secondary hover:bg-white/10"
      :aria-label="t('g.back')"
      :disabled="isPolling"
      @click="handleBackToPricing"
    >
      <i class="pi pi-arrow-left text-xl" />
    </Button>

    <Button
      size="icon"
      variant="muted-textonly"
      class="absolute top-2.5 right-2.5 shrink-0 rounded-full text-text-secondary hover:bg-white/10"
      :aria-label="t('g.close')"
      @click="onClose"
    >
      <i class="pi pi-times text-xl" />
    </Button>

    <div
      v-if="
        checkoutStep === 'pricing' ||
        (checkoutStep === 'preview' && !previewVariant)
      "
      class="flex items-center justify-center gap-2 py-12 text-muted-foreground"
      data-testid="settings-plan-checkout-loading"
    >
      <i class="pi pi-spin pi-spinner" />
      <span class="text-sm">{{ t('g.loading') }}</span>
    </div>

    <template v-else-if="checkoutStep === 'preview'">
      <SubscriptionTransitionPreviewWorkspace
        v-if="
          previewVariant === 'team-change' && previewData && selectedTeamStop
        "
        :preview-data="previewData"
        :team-plan="selectedTeamStop"
        :is-loading="isLoadingPreview || isSubscribing || isPolling"
        :action-url="activeCheckoutActionUrl"
        :force-reactivation="reactivationRequired"
        @confirm="handleTeamSubscribe"
        @back="handleBackToPricing"
      />

      <SubscriptionAddPaymentPreviewWorkspace
        v-else-if="previewVariant === 'team-new' && selectedTeamStop"
        :team-plan="selectedTeamStop"
        :billing-cycle="selectedBillingCycle"
        :is-loading="isLoadingPreview || isSubscribing || isPolling"
        :action-url="activeCheckoutActionUrl"
        @add-credit-card="handleTeamSubscribe"
        @back="handleBackToPricing"
      />

      <SubscriptionAddPaymentPreviewWorkspace
        v-else-if="previewVariant === 'personal-new' && selectedTierKey"
        :preview-data="previewData"
        :tier-key="selectedTierKey"
        :billing-cycle="selectedBillingCycle"
        :is-loading="isSubscribing || isPolling"
        :action-url="activeCheckoutActionUrl"
        @add-credit-card="handleAddCreditCard"
        @back="handleBackToPricing"
      />

      <SubscriptionTransitionPreviewWorkspace
        v-else-if="previewVariant === 'personal-change' && previewData"
        :preview-data="previewData"
        :is-loading="isSubscribing || isPolling"
        :action-url="activeCheckoutActionUrl"
        :force-reactivation="reactivationRequired"
        @confirm="handleConfirmTransition"
        @back="handleBackToPricing"
      />
    </template>

    <SubscriptionSuccessWorkspace
      v-else-if="
        checkoutStep === 'success' && (selectedTierKey || isTeamCheckout)
      "
      :tier-key="selectedTierKey"
      :team-plan="selectedTeamStop"
      :preview-data="previewData"
      :billing-cycle="selectedBillingCycle"
      @close="handleSuccessClose"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import SubscriptionAddPaymentPreviewWorkspace from '@/platform/workspace/components/SubscriptionAddPaymentPreviewWorkspace.vue'
import SubscriptionSuccessWorkspace from '@/platform/workspace/components/SubscriptionSuccessWorkspace.vue'
import SubscriptionTransitionPreviewWorkspace from '@/platform/workspace/components/SubscriptionTransitionPreviewWorkspace.vue'
import type { SubscriptionCheckoutSelection } from '@/platform/workspace/composables/useSubscriptionCheckout'
import { useSubscriptionCheckout } from '@/platform/workspace/composables/useSubscriptionCheckout'

// Hosts the shared checkout flow (preview, consent, subscribe, op polling) for
// one selection made in the local plans section. The pricing step belongs to
// that section, so any return to it here means the dialog is done.
const { onClose, initialCheckout } = defineProps<{
  onClose: () => void
  initialCheckout: SubscriptionCheckoutSelection
}>()

const emit = defineEmits<{
  close: [subscribed: boolean]
}>()

const { t } = useI18n()

const {
  checkoutStep,
  isLoadingPreview,
  isSubscribing,
  previewData,
  reactivationRequired,
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
  handleTeamSubscribe
} = useSubscriptionCheckout(emit, 'local_settings_plans')

watch(checkoutStep, (step) => {
  if (step === 'pricing') onClose()
})

// A personal preview that fails, is disallowed, or is refused never leaves the
// pricing step, so the settled dispatch is checked as well as watched.
onMounted(async () => {
  await (initialCheckout.planMode === 'team'
    ? handleSubscribeTeamClick(initialCheckout)
    : handleSubscribeClick(initialCheckout))
  if (checkoutStep.value === 'pricing') onClose()
})
</script>

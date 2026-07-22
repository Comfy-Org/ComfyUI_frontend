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
      <div
        v-if="isEduPricingActive"
        class="flex items-center rounded-full bg-primary-background px-3 py-1 text-sm font-medium text-white"
      >
        {{
          $t('subscription.eduPromoHeader', {
            percent: EDU_MAX_DISCOUNT_PERCENT
          })
        }}
      </div>
      <div
        v-else-if="needsEduVerification"
        class="flex w-full max-w-xl items-center gap-3 rounded-xl border border-border-default bg-base-background p-3 pl-4 text-left max-sm:flex-col max-sm:items-stretch"
      >
        <i
          class="pi pi-graduation-cap shrink-0 text-xl text-base-foreground max-sm:hidden"
        />
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span class="text-sm font-semibold text-base-foreground">
            {{ $t('subscription.eduVerifyTitle') }}
          </span>
          <span class="text-xs text-muted-foreground">
            {{
              $t('subscription.eduVerifyHeader', {
                percent: EDU_MAX_DISCOUNT_PERCENT
              })
            }}
          </span>
          <span v-if="verifyStatusKey" class="text-xs text-error">
            {{ $t(verifyStatusKey) }}
          </span>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <Button
            v-if="!isSent"
            size="sm"
            variant="primary"
            :disabled="isSending"
            @click="handleSendVerification"
          >
            {{ $t('subscription.eduVerifySend') }}
          </Button>
          <template v-else>
            <span class="text-xs text-muted-foreground">
              {{ $t('subscription.eduVerifySentHint') }}
            </span>
            <Button
              size="sm"
              variant="primary"
              :disabled="isConfirmingVerification"
              @click="handleVerificationConfirmed"
            >
              {{ $t('subscription.eduVerifyConfirm') }}
            </Button>
          </template>
        </div>
      </div>
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
        @confirm="handleTeamSubscribe"
        @back="handleBackToPricing"
      />

      <SubscriptionAddPaymentPreviewWorkspace
        v-else-if="previewVariant === 'team-new'"
        :team-plan="selectedTeamStop!"
        :billing-cycle="selectedBillingCycle"
        :is-loading="isSubscribing || isPolling"
        @add-credit-card="handleTeamSubscribe"
        @back="handleBackToPricing"
      />

      <SubscriptionAddPaymentPreviewWorkspace
        v-else-if="previewVariant === 'personal-new'"
        :preview-data="previewData"
        :tier-key="selectedTierKey!"
        :billing-cycle="selectedBillingCycle"
        :is-loading="isSubscribing || isPolling"
        @add-credit-card="handleAddCreditCard"
        @back="handleBackToPricing"
      />

      <SubscriptionTransitionPreviewWorkspace
        v-else-if="previewVariant === 'personal-change'"
        :preview-data="previewData!"
        :is-loading="isSubscribing || isPolling"
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
      @close="handleSuccessClose"
    />
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useEventListener } from '@vueuse/core'
import { onMounted, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useEmailVerification } from '@/composables/auth/useEmailVerification'
import { useEduPricing } from '@/platform/cloud/subscription/composables/useEduPricing'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { EDU_MAX_DISCOUNT_PERCENT } from '@/platform/cloud/subscription/constants/tierPricing'
import type { PaymentIntentSource } from '@/platform/telemetry/types'
import type { SubscriptionCheckoutSelection } from '@/platform/workspace/composables/useSubscriptionCheckout'
import { useSubscriptionCheckout } from '@/platform/workspace/composables/useSubscriptionCheckout'
import { useAuthStore } from '@/stores/authStore'

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
} = useSubscriptionCheckout(emit, reason)

const { isEduPricingActive, needsEduVerification } = useEduPricing()
const { isSending, isSent, sendVerification, refreshVerification } =
  useEmailVerification()
const { fetchStatus } = useSubscription()
const authStore = useAuthStore()

const isConfirmingVerification = ref(false)
const verifyStatusKey = ref<string | null>(null)

const handleSendVerification = async () => {
  verifyStatusKey.value = null
  if (!(await sendVerification())) {
    verifyStatusKey.value = 'subscription.eduVerifySendFailed'
  }
}

// Post-verification loop: refreshed token -> re-provision (ratchets is_edu) -> refetch status.
const handleVerificationConfirmed = async () => {
  if (isConfirmingVerification.value) return
  isConfirmingVerification.value = true
  verifyStatusKey.value = null
  try {
    const verified = await refreshVerification()
    if (!verified) {
      verifyStatusKey.value = 'subscription.eduVerifyStillUnverified'
      return
    }
    await authStore.createCustomer()
    await fetchStatus()
  } catch {
    verifyStatusKey.value = 'subscription.eduVerifyFailed'
  } finally {
    isConfirmingVerification.value = false
  }
}

onMounted(() => {
  if (!initialCheckout) return
  if (initialCheckout.planMode === 'team') {
    void handleSubscribeTeamClick(initialCheckout)
    return
  }
  void handleSubscribeClick(initialCheckout)
})

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

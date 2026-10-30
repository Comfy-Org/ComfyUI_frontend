<template>
  <Card class="flex min-w-[460px] flex-col shadow-md">
    <!-- Header -->
    <div class="flex items-center justify-between p-8">
      <DialogTitle class="m-0 text-lg font-bold">
        {{
          isInsufficientCredits
            ? $t('credits.topUp.addMoreCreditsToRun')
            : $t('credits.topUp.addMoreCredits')
        }}
      </DialogTitle>
      <button
        class="cursor-pointer rounded-sm border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        :aria-label="$t('g.close')"
        @click="() => handleClose()"
      >
        <i class="icon-[lucide--x] size-6" />
      </button>
    </div>
    <p
      v-if="isInsufficientCredits"
      class="m-0 px-8 pb-4 text-sm text-muted-foreground"
    >
      {{ $t('credits.topUp.insufficientWorkflowMessage') }}
    </p>

    <TopUpAmountFields
      :pay-amount
      :credits="creditsModel"
      :selected-preset
      :max-amount="MAX_AMOUNT"
      :plan-credit-copy
      @preset="handlePresetClick"
      @pay-amount="handlePayAmountChange"
      @credits="creditsModel = $event"
    />

    <!-- Warnings -->

    <p
      v-if="isBelowMin"
      class="m-0 flex items-center justify-center gap-1 px-8 pt-4 text-center text-sm text-destructive"
    >
      <i class="icon-[lucide--coins]" />
      {{
        $t('credits.topUp.minRequired', {
          credits: formatNumber(usdToCredits(MIN_AMOUNT))
        })
      }}
    </p>
    <p
      v-if="showCeilingWarning"
      class="m-0 flex items-center justify-center gap-1 px-8 pt-4 text-center text-sm text-warning"
    >
      <i class="icon-[lucide--coins]" />
      {{
        $t('credits.topUp.maxAllowed', {
          credits: formatNumber(usdToCredits(MAX_AMOUNT))
        })
      }}
      <span>{{ $t('credits.topUp.needMore') }}</span>
      <a
        href="https://comfy.org/cloud/enterprise/"
        target="_blank"
        class="ml-1 text-inherit"
        >{{ $t('credits.topUp.contactUs') }}</a
      >
    </p>

    <div class="flex flex-col gap-8 p-8">
      <Button
        :disabled="!isValidAmount || loading"
        :loading
        variant="primary"
        size="lg"
        @click="handleBuy"
      >
        {{ $t('credits.topUp.buyCredits') }}
      </Button>
      <div class="flex items-center justify-center gap-6">
        <a
          :href="pricingUrl"
          target="_blank"
          class="flex items-center gap-1 text-sm text-muted-foreground no-underline transition-colors hover:text-foreground"
        >
          {{ $t('credits.topUp.viewPricing') }}
          <i class="icon-[lucide--external-link]" />
        </a>
        <TopUpAutoTopUpLink />
      </div>
    </div>
  </Card>
</template>

<script setup lang="ts">
import Card from '@comfyorg/design-system/card/Card'
import { getTopupAmountPreset } from '@comfyorg/account-core/billing'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { creditsToUsd, usdToCredits } from '@/base/credits/comfyCredits'
import Button from '@comfyorg/design-system/button/Button'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'
import TopUpAmountFields from './TopUpAmountFields.vue'
import TopUpAutoTopUpLink from './TopUpAutoTopUpLink.vue'
import { useToast } from '@/components/ui/toast/toastStore'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useExternalLink } from '@/composables/useExternalLink'
import { useTelemetry } from '@comfyorg/telemetry'
import { usePendingTopup } from '@/platform/billing/composables/usePendingTopup'
import { useTopUpPlanCreditCopy } from '@/platform/billing/composables/useTopUpPlanCreditCopy'
import type { PaymentIntentSource } from '@comfyorg/telemetry/types'
import { describeBillingFailure } from '@/platform/telemetry/utils/billingFailureCategory'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useDialogStore } from '@/stores/dialogStore'

const { isInsufficientCredits = false, source } = defineProps<{
  isInsufficientCredits?: boolean
  source?: PaymentIntentSource
}>()

const { t } = useI18n()
const authActions = useAuthActions()
const dialogStore = useDialogStore()
const settingsDialog = useSettingsDialog()
const telemetry = useTelemetry()
const toast = useToast()
const planCreditCopy = useTopUpPlanCreditCopy()
const { buildDocsUrl, docsPaths } = useExternalLink()

// Constants
const MIN_AMOUNT = 5
const MAX_AMOUNT = 10000

// State
const selectedPreset = ref<number | null>(50)
const payAmount = ref(50)
const loading = ref(false)

// Computed
const pricingUrl = computed(() =>
  buildDocsUrl(docsPaths.partnerNodesPricing, { includeLocale: true })
)

const creditsModel = computed({
  get: () => usdToCredits(payAmount.value),
  set: (newCredits: number) => {
    payAmount.value = Math.round(creditsToUsd(newCredits))
    selectedPreset.value = null
  }
})

const isValidAmount = computed(
  () => payAmount.value >= MIN_AMOUNT && payAmount.value <= MAX_AMOUNT
)

const isBelowMin = computed(() => payAmount.value < MIN_AMOUNT)
const showCeilingWarning = computed(() => payAmount.value >= MAX_AMOUNT)

// Utility functions
function formatNumber(num: number): string {
  return num.toLocaleString('en-US')
}

// Event handlers
function handlePayAmountChange(value: number) {
  payAmount.value = value
  selectedPreset.value = null
}

function handlePresetClick(amount: number) {
  payAmount.value = amount
  selectedPreset.value = amount
}

function handleClose(clearTracking = true) {
  if (clearTracking) {
    usePendingTopup().clearPendingTopup()
  }
  dialogStore.closeDialog({ key: 'top-up-credits' })
}

async function handleBuy() {
  // Prevent double-clicks
  if (loading.value || !isValidAmount.value) return

  loading.value = true
  try {
    telemetry?.trackApiCreditTopupButtonPurchaseClicked(payAmount.value)
    if (useBillingContext().canAccessSubscriptionFeatures.value) {
      telemetry?.trackBillingEvent({
        operation: 'topup',
        stage: 'started',
        outcome: 'pending',
        payment_intent_source: source,
        amount_cents: payAmount.value * 100,
        amount_preset: getTopupAmountPreset(selectedPreset.value)
      })
      await authActions.purchaseCreditsDirect(payAmount.value)
    }

    // Close top-up dialog (keep tracking) and open Plan & Credits to show the
    // updated balance. The destination is the V1 panel for every session: the
    // legacy `credits` panel is hidden from the settings menu, and keying this
    // off the billing rail sent rail-less sessions (API key, pre-workspace
    // bootstrap) to that hidden screen.
    handleClose(false)

    settingsDialog.show('workspace')
  } catch (error) {
    console.error('Purchase failed:', error)

    const errorMessage =
      error instanceof Error ? error.message : t('credits.topUp.unknownError')
    telemetry?.trackBillingEvent({
      operation: 'topup',
      stage: 'failed',
      outcome: 'failure',
      payment_intent_source: source,
      ...describeBillingFailure(error)
    })
    toast.error(t('credits.topUp.purchaseError'), {
      description: t('credits.topUp.purchaseErrorDetail', {
        error: errorMessage
      })
    })
  } finally {
    loading.value = false
  }
}
</script>

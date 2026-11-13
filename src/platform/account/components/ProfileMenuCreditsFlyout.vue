<template>
  <div class="flex w-64 flex-col" data-testid="credits-flyout">
    <BillingCreditsBreakdown
      :state="breakdown"
      :copy="breakdownCopy"
      :locale
      class="px-2"
    >
      <template #topUpNote>
        <p
          v-if="processingPayment"
          role="status"
          class="m-0 text-xs text-muted-foreground"
          data-testid="topup-payment-processing-line"
        >
          {{ $t('profileMenu.paymentProcessing') }}
        </p>
        <p
          v-if="refusalReason && showAddCredits"
          :id="refusalReasonId"
          class="m-0 text-xs text-muted-foreground"
        >
          {{ refusalReason }}
        </p>
        <p
          v-if="planCreditNote"
          class="m-0 text-xs text-muted-foreground"
          data-testid="credits-flyout-plan-note"
        >
          {{ planCreditNote }}
        </p>
      </template>
    </BillingCreditsBreakdown>
    <div class="-mx-2 my-1 border-t border-border" role="separator" />
    <div class="flex flex-col gap-2">
      <Tooltip v-if="showAddCredits" :disabled="!paymentPastDue">
        <TooltipTrigger as-child>
          <span class="flex flex-col" data-testid="add-credits-trigger">
            <Button
              variant="secondary"
              size="md"
              data-testid="add-credits-button"
              :disabled="addCredits.kind === 'disabled'"
              :aria-describedby="refusalReason ? refusalReasonId : undefined"
              :data-dd-action-name="BILLING_ACTION_NAME.addCreditsPopover"
              @click="handleTopUp"
            >
              {{ $t('subscription.addCredits') }}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="left">{{ refusalReason }}</TooltipContent>
      </Tooltip>
      <Button
        v-if="paymentRecoveryAvailable"
        variant="secondary"
        size="md"
        :loading="isUpdatingPayment"
        data-testid="update-payment-button"
        @click="updatePayment"
      >
        {{ $t('workspacePanel.billingStatus.updatePayment') }}
      </Button>
      <Button
        variant="muted-textonly"
        size="md"
        data-testid="billing-settings-button"
        @click="emit('openBilling')"
      >
        {{ $t('profileMenu.billingSettings') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  addCreditsAvailability,
  deriveCreditsFlyout
} from '@comfyorg/account-core/billing'
import { BillingCreditsBreakdown } from '@comfyorg/account-ui/billing'
import Button from '@comfyorg/design-system/button/Button'
import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'
import { useTelemetry } from '@comfyorg/telemetry'
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBillingPlanRow } from '@/platform/billing/components/billingTab/useBillingPlanRow'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useCreditsBreakdownCopy } from '@/platform/billing/composables/useCreditsCardCopy'
import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'
import { usePaymentRecoveryDialog } from '@/platform/billing/composables/usePaymentRecoveryDialog'
import { useProcessingTopupPayment } from '@/platform/billing/composables/useProcessingTopupPayment'
import { useTopUpPlanCreditCopy } from '@/platform/billing/composables/useTopUpPlanCreditCopy'
import { BILLING_ACTION_NAME } from '@/platform/telemetry/billingActionNames'
import { paymentIntentSourceForAddCreditsClick } from '@/platform/telemetry/utils/paymentIntentSource'

const emit = defineEmits<{
  openBilling: []
  close: []
}>()

const { t, locale } = useI18n()
const {
  balance,
  isLoading,
  billingStatus,
  periodCreditGrant,
  nextCreditRefillAt
} = useBillingContext()
const { state: planRow } = useBillingPlanRow()
const breakdownCopy = useCreditsBreakdownCopy()
const planCreditNote = useTopUpPlanCreditCopy()
const breakdown = computed(() =>
  deriveCreditsFlyout({
    loading: isLoading.value,
    balance: balance.value,
    planKind: planRow.value.kind,
    billingStatus: billingStatus.value,
    periodCreditGrant: periodCreditGrant.value,
    nextCreditRefillAt: nextCreditRefillAt.value,
    endDate: planRow.value.kind === 'ending' ? planRow.value.endsAt : null
  })
)
const {
  canTopUp,
  topUpDenial,
  hasResolvedCapabilities,
  paymentRecoveryAvailable
} = useBillingCapabilities()
const { updatePayment, isUpdatingPayment } = usePaymentRecoveryDialog()
const { showTopUpCreditsDialog } = useBillingDialogs()
const { payment: processingPayment } = useProcessingTopupPayment(() => true)

const addCredits = computed(() =>
  addCreditsAvailability({
    resolved: hasResolvedCapabilities.value,
    canTopUp: canTopUp.value,
    denial: topUpDenial.value
  })
)
// Balance unavailable: no Add credits (Figma states matrix).
const showAddCredits = computed(
  () =>
    addCredits.value.kind !== 'hidden' && breakdown.value.kind !== 'unavailable'
)
const paymentPastDue = computed(
  () =>
    addCredits.value.kind === 'disabled' &&
    topUpDenial.value === 'payment_past_due'
)
const refusalReasonId = useId()
const refusalReason = computed(() =>
  addCredits.value.kind === 'disabled' ? t(addCredits.value.reasonKey) : null
)

function handleTopUp() {
  useTelemetry()?.trackAddApiCreditButtonClicked({ source: 'avatar_menu' })
  showTopUpCreditsDialog({
    source: paymentIntentSourceForAddCreditsClick('avatar_menu')
  })
  emit('close')
}
</script>

<template>
  <div class="flex flex-col gap-1 py-2" data-testid="credits-flyout">
    <BillingCreditsBreakdown :state="breakdown" :copy="breakdownCopy" :locale>
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
          v-if="refusalReason"
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
    <div class="border-t border-border" role="separator" />
    <div class="flex flex-col px-2">
      <Button
        v-if="paymentRecoveryAvailable"
        variant="textonly"
        size="unset"
        :class="flyoutRowClass"
        :loading="isUpdatingPayment"
        data-testid="update-payment-button"
        @click="updatePayment"
      >
        <i
          v-if="!isUpdatingPayment"
          class="icon-[lucide--credit-card] text-muted-foreground"
        />
        <span>{{ $t('workspacePanel.billingStatus.updatePayment') }}</span>
      </Button>
      <Tooltip
        v-if="addCredits.kind !== 'hidden'"
        :disabled="!paymentPastDue && !purchasesStopped"
      >
        <TooltipTrigger as-child>
          <span class="flex flex-col" data-testid="add-credits-trigger">
            <Button
              variant="textonly"
              size="unset"
              :class="flyoutRowClass"
              data-testid="add-credits-button"
              :disabled="addCredits.kind === 'disabled'"
              :aria-describedby="refusalReason ? refusalReasonId : undefined"
              :data-dd-action-name="BILLING_ACTION_NAME.addCreditsPopover"
              @click="handleTopUp"
            >
              <i class="icon-[lucide--plus] text-muted-foreground" />
              <span>{{ $t('subscription.addCredits') }}</span>
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="left">{{ refusalReason }}</TooltipContent>
      </Tooltip>
      <Button
        variant="textonly"
        size="unset"
        :class="flyoutRowClass"
        data-testid="billing-settings-button"
        @click="emit('openBilling')"
      >
        <i class="icon-[lucide--receipt-text] text-muted-foreground" />
        <span>{{ $t('profileMenu.billingSettings') }}</span>
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
import { cn } from '@comfyorg/tailwind-utils'
import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'
import { useTelemetry } from '@comfyorg/telemetry'
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { profileMenuRowClass } from '@/platform/account/components/profileMenuRow'
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

const flyoutRowClass = cn(profileMenuRowClass, 'justify-start font-normal')

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
const paymentPastDue = computed(
  () =>
    addCredits.value.kind === 'disabled' &&
    topUpDenial.value === 'payment_past_due'
)
const refusalReasonId = useId()
const purchasesStopped = computed(
  () =>
    addCredits.value.kind === 'disabled' &&
    topUpDenial.value === 'topup_purchases_paused'
)
const refusalReason = computed(() => {
  if (addCredits.value.kind !== 'disabled') return null
  return purchasesStopped.value
    ? t('profileMenu.purchasesStopped')
    : t(addCredits.value.reasonKey)
})

function handleTopUp() {
  useTelemetry()?.trackAddApiCreditButtonClicked({ source: 'avatar_menu' })
  showTopUpCreditsDialog({
    source: paymentIntentSourceForAddCreditsClick('avatar_menu')
  })
  emit('close')
}
</script>

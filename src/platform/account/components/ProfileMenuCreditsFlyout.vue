<template>
  <div class="flex w-64 flex-col gap-2" data-testid="credits-flyout">
    <p
      v-if="processingPayment"
      role="status"
      class="m-0 text-sm text-muted-foreground"
      data-testid="topup-payment-processing-line"
    >
      {{ $t('credits.topUp.paymentProcessingFlyout') }}
    </p>
    <Button
      v-if="addCredits.kind !== 'hidden'"
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
    <p
      v-if="refusalReason"
      :id="refusalReasonId"
      class="m-0 text-xs text-muted-foreground"
    >
      {{ refusalReason }}
    </p>
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
</template>

<script setup lang="ts">
import { addCreditsAvailability } from '@comfyorg/account-core/billing'
import Button from '@comfyorg/design-system/button/Button'
import { useTelemetry } from '@comfyorg/telemetry'
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'
import { usePaymentRecoveryDialog } from '@/platform/billing/composables/usePaymentRecoveryDialog'
import { useProcessingTopupPayment } from '@/platform/billing/composables/useProcessingTopupPayment'
import { BILLING_ACTION_NAME } from '@/platform/telemetry/billingActionNames'
import { paymentIntentSourceForAddCreditsClick } from '@/platform/telemetry/utils/paymentIntentSource'

const emit = defineEmits<{
  openBilling: []
  close: []
}>()

const { t } = useI18n()
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

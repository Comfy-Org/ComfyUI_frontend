<template>
  <div
    class="flex min-h-[500px] w-[min(512px,95vw)] flex-col rounded-2xl border border-border-default bg-base-background shadow-[1px_1px_8px_0_rgba(0,0,0,0.4)]"
  >
    <!-- Header -->
    <div class="flex items-center justify-between p-8">
      <div class="flex items-center gap-2">
        <button
          v-if="step === 'confirm' || step === 'declined'"
          class="cursor-pointer rounded-sm border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-base-foreground disabled:pointer-events-none disabled:opacity-40"
          :disabled="step === 'confirm' && paymentLocked"
          :aria-label="$t('g.back')"
          @click="handleBack"
        >
          <i class="icon-[lucide--arrow-left] size-5" />
        </button>
        <h2
          v-if="step === 'amount' || step === 'confirm'"
          class="m-0 text-base font-bold text-base-foreground"
        >
          {{
            step === 'confirm'
              ? $t('credits.topUp.confirmTitle')
              : isInsufficientCredits
                ? $t('credits.topUp.addMoreCreditsToRun')
                : $t('credits.topUp.addMoreCredits')
          }}
        </h2>
      </div>
      <button
        class="focus-visible:ring-secondary-foreground cursor-pointer rounded-sm border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-base-foreground focus-visible:ring-1 focus-visible:outline-none"
        :aria-label="$t('g.close')"
        @click="() => handleClose()"
      >
        <i class="icon-[lucide--x] size-6" />
      </button>
    </div>
    <p
      v-if="isInsufficientCredits && step === 'amount'"
      class="m-0 px-8 text-sm text-muted-foreground"
    >
      {{ $t('credits.topUp.insufficientWorkflowMessage') }}
    </p>

    <template v-if="step === 'confirm'">
      <p class="m-0 px-8 text-sm text-muted-foreground">
        {{ $t('credits.topUp.confirmSubtitle') }}
      </p>
      <div class="flex flex-col gap-3 px-8 pt-6">
        <span
          class="flex items-center gap-2 py-2 text-2xl font-semibold text-base-foreground tabular-nums"
        >
          <i class="icon-[lucide--coins] size-5 text-gold-500" />
          {{ formatNumber(creditsModel) }}
        </span>
        <div
          class="flex items-center justify-between border-t border-border-default pt-4"
        >
          <span class="text-base font-semibold text-base-foreground">
            {{ $t('subscription.preview.totalDueToday') }}
          </span>
          <span
            class="text-base font-semibold text-base-foreground tabular-nums"
          >
            {{ displayTotal }}
          </span>
        </div>
        <p
          v-if="hasSavedPaymentMethod !== null"
          class="m-0 text-xs text-muted-foreground"
        >
          {{ paymentNote }}
          <button
            v-if="hasSavedPaymentMethod === false"
            class="cursor-pointer border-none bg-transparent p-0 text-xs text-base-foreground underline"
            @click="openManageBilling"
          >
            {{ $t('subscription.manageBilling') }}
          </button>
        </p>
      </div>
    </template>

    <template v-if="step === 'verifying'">
      <div class="flex flex-col items-center gap-3 px-8 text-center">
        <i
          class="icon-[lucide--shield-alert] size-10 text-warning-background"
        />
        <h2
          class="m-0 text-center text-xl font-semibold text-base-foreground lg:text-2xl"
        >
          {{ $t('credits.topUp.verifyTitle') }}
        </h2>
        <p class="m-0 text-sm text-balance text-muted-foreground">
          {{
            topupReconciliationOperationId
              ? $t('billingOperation.reconciliationDetail')
              : topupAuthenticationError || $t('credits.topUp.verifyBody')
          }}
        </p>
        <span
          v-if="topupReconciliationOperationId"
          class="font-mono text-sm text-base-foreground"
        >
          {{ topupReconciliationOperationId }}
        </span>
      </div>
    </template>

    <!-- Preset amount buttons -->
    <template v-if="step === 'success'">
      <div class="flex flex-col items-center gap-3 px-8 text-center">
        <i
          class="icon-[lucide--circle-check-big] size-10 text-success-background"
        />
        <h2
          class="m-0 text-center text-xl font-semibold text-base-foreground lg:text-2xl"
        >
          {{ $t('credits.topUp.successTitle') }}
        </h2>
        <i18n-t
          keypath="credits.topUp.successBody"
          tag="p"
          class="m-0 text-sm text-balance text-muted-foreground"
        >
          <template #link>
            <button
              class="cursor-pointer border-none bg-transparent p-0 text-sm text-base-foreground underline"
              @click="openBillingAndInvoices"
            >
              {{ $t('subscription.billingAndInvoices') }}
            </button>
          </template>
        </i18n-t>
      </div>

      <div
        v-if="balanceBeforeCharge !== null"
        class="mx-8 mt-6 flex flex-col gap-2 rounded-xl bg-secondary-background p-4"
      >
        <div class="flex items-center justify-between text-sm">
          <span class="text-muted-foreground">
            {{ $t('credits.topUp.previousBalance') }}
          </span>
          <span class="text-base-foreground tabular-nums">
            {{ formatNumber(balanceBeforeCharge) }}
          </span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-muted-foreground">
            {{ $t('credits.topUp.added') }}
          </span>
          <span class="text-base-foreground tabular-nums">
            +{{ formatNumber(creditsAdded) }}
          </span>
        </div>
        <div
          class="mt-1 flex items-center justify-between border-t border-border-subtle pt-3 text-sm font-semibold"
        >
          <span class="text-base-foreground">
            {{ $t('credits.topUp.newBalance') }}
          </span>
          <span
            class="flex items-center gap-1 text-base-foreground tabular-nums"
          >
            <i class="icon-[lucide--coins] size-4 shrink-0 bg-credit" />
            {{ formatNumber(newBalanceCredits) }}
          </span>
        </div>
      </div>
    </template>

    <template v-if="step === 'declined'">
      <div class="flex flex-col items-center gap-3 px-8 text-center">
        <i
          class="icon-[lucide--circle-alert] size-10 text-warning-background"
        />
        <h2
          class="m-0 text-center text-xl font-semibold text-base-foreground lg:text-2xl"
        >
          {{ $t('credits.topUp.declinedTitle') }}
        </h2>
        <p class="m-0 text-sm text-balance text-muted-foreground">
          {{ $t('credits.topUp.declinedBody') }}
        </p>
      </div>

      <div
        v-if="declineReason"
        class="mx-8 mt-6 flex flex-col gap-1 rounded-xl bg-secondary-background p-4"
      >
        <span class="text-sm text-muted-foreground">
          {{ $t('credits.topUp.declinedReasonLabel') }}
        </span>
        <span class="text-sm text-base-foreground">{{ declineReason }}</span>
      </div>
    </template>

    <div
      v-if="canceledNoticeVisible && step === 'amount'"
      class="mx-8 mb-2 rounded-lg bg-secondary-background px-4 py-2 text-center text-xs text-muted-foreground"
    >
      {{ $t('billingOperation.paymentCanceledNotice') }}
    </div>

    <div v-if="step === 'amount'" class="px-8">
      <h3 class="m-0 text-sm font-normal text-muted-foreground">
        {{ $t('credits.topUp.selectAmount') }}
      </h3>
      <div class="flex gap-2 pt-3">
        <Button
          v-for="amount in PRESET_AMOUNTS"
          :key="amount"
          :autofocus="amount === 50"
          variant="secondary"
          size="lg"
          :class="
            cn(
              'focus-visible:ring-secondary-foreground h-10 w-full text-base font-medium',
              selectedPreset === amount && 'bg-secondary-background-selected'
            )
          "
          @click="handlePresetClick(amount)"
        >
          ${{ amount }}
        </Button>
      </div>
    </div>
    <!-- Amount (USD) / Credits -->
    <div v-if="step === 'amount'" class="flex gap-2 px-8 pt-8">
      <!-- You Pay -->
      <div class="flex flex-1 flex-col gap-3" data-testid="top-up-pay-amount">
        <div class="text-sm text-muted-foreground">
          {{ $t('credits.topUp.youPay') }}
        </div>
        <FormattedNumberStepper
          :model-value="payAmount"
          :min="0"
          :max="MAX_AMOUNT"
          :step="getStepAmount"
          @update:model-value="handlePayAmountChange"
          @max-reached="showCeilingWarning = true"
        >
          <template #prefix>
            <span class="shrink-0 text-base font-semibold text-base-foreground"
              >$</span
            >
          </template>
        </FormattedNumberStepper>
      </div>

      <!-- You Get -->
      <div class="flex flex-1 flex-col gap-3">
        <div class="text-sm text-muted-foreground">
          {{ $t('credits.topUp.youGet') }}
        </div>
        <FormattedNumberStepper
          v-model="creditsModel"
          :min="0"
          :max="usdToCredits(MAX_AMOUNT)"
          :step="getCreditsStepAmount"
          @max-reached="showCeilingWarning = true"
        >
          <template #prefix>
            <i class="icon-[lucide--coins] size-4 shrink-0 text-gold-500" />
          </template>
        </FormattedNumberStepper>
      </div>
    </div>

    <!-- Warnings -->

    <p
      v-if="isBelowMin && step === 'amount'"
      class="m-0 flex items-center justify-center gap-1 px-8 pt-4 text-center text-sm text-red-500"
    >
      <i class="icon-[lucide--coins] size-4" />
      {{
        $t('credits.topUp.minRequired', {
          credits: formatNumber(usdToCredits(MIN_AMOUNT))
        })
      }}
    </p>
    <p
      v-if="showCeilingWarning && step === 'amount'"
      class="m-0 flex items-center justify-center gap-1 px-8 pt-4 text-center text-sm text-gold-500"
    >
      <i class="icon-[lucide--coins] size-4" />
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

    <div class="mt-auto flex flex-col gap-8 p-8">
      <div v-if="step === 'success'">
        <Button
          variant="secondary"
          size="lg"
          class="h-10 w-full justify-center"
          @click="() => handleClose()"
        >
          {{ $t('g.close') }}
        </Button>
      </div>
      <div v-else-if="step === 'declined'">
        <Button
          variant="secondary"
          size="lg"
          class="h-10 w-full justify-center"
          @click="openManageBilling"
        >
          {{ $t('credits.topUp.updatePaymentMethod') }}
        </Button>
      </div>
      <div v-else-if="step === 'verifying'">
        <Button
          v-if="topupCanRetryAuthentication"
          variant="primary"
          size="lg"
          class="h-10 w-full justify-center"
          :loading="topupIsAuthenticating"
          :disabled="!canTopUp"
          @click="retryTopupAuthentication"
        >
          {{ $t('billingOperation.retryVerification') }}
        </Button>
        <Button
          v-else-if="!topupReconciliationOperationId"
          variant="primary"
          size="lg"
          class="h-10 w-full justify-center"
          :disabled="!topupActionUrl || !canTopUp"
          :loading="!topupActionUrl"
          :aria-label="$t('subscription.preview.completeVerification')"
          @click="openTopupVerification"
        >
          {{ $t('subscription.preview.completeVerification') }}
        </Button>

        <p
          v-if="cancelUnavailable"
          class="m-0 py-2 text-center text-xs text-muted-foreground"
        >
          {{ $t('billingOperation.cancelUnavailable') }}
        </p>
        <template v-else>
          <p
            v-if="cancelUnreachable"
            class="m-0 pt-2 text-center text-xs text-muted-foreground"
          >
            {{ $t('billingOperation.cancelUnreachable') }}
          </p>
          <Button
            v-if="!topupReconciliationOperationId"
            variant="muted-textonly"
            size="lg"
            class="h-10 w-full justify-center"
            :loading="isCancelingPayment"
            @click="handleCancelPendingPayment"
          >
            {{ $t('billingOperation.cancelPayment') }}
          </Button>
        </template>
      </div>
      <div v-else class="flex flex-col gap-2">
        <Button
          v-if="step === 'confirm' && topupActionUrl && canTopUp"
          variant="primary"
          size="lg"
          class="h-10 justify-center"
          @click="openTopupVerification"
        >
          {{ $t('subscription.preview.completeVerification') }}
        </Button>
        <Button
          :disabled="!isValidAmount || paymentLocked || !canTopUp"
          :loading="paymentLocked"
          :variant="
            step === 'confirm' && topupActionUrl ? 'tertiary' : 'primary'
          "
          size="lg"
          class="h-10 justify-center tabular-nums"
          @click="handlePrimaryAction"
        >
          {{
            step === 'confirm'
              ? $t('credits.topUp.payAmount', { amount: displayTotal })
              : $t('subscription.addCredits')
          }}
        </Button>
      </div>
      <div
        v-if="step === 'amount'"
        class="flex items-center justify-center gap-1"
      >
        <a
          :href="pricingUrl"
          target="_blank"
          class="flex items-center gap-1 text-sm text-muted-foreground no-underline transition-colors hover:text-base-foreground"
        >
          {{ $t('credits.topUp.viewPricing') }}
          <i class="icon-[lucide--external-link] size-4" />
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  centsToCredits,
  creditsToUsd,
  usdToCredits
} from '@/base/credits/comfyCredits'
import Button from '@/components/ui/button/Button.vue'
import FormattedNumberStepper from '@/components/ui/stepper/FormattedNumberStepper.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useExternalLink } from '@/composables/useExternalLink'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useTelemetry } from '@/platform/telemetry'
import { usePendingTopup } from '@/composables/billing/usePendingTopup'
import { categorizeBillingApiError } from '@/platform/telemetry/utils/billingFailureCategory'
import { reportError } from '@/platform/telemetry/reportError'
import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useHasSavedPaymentMethod } from '@/platform/workspace/composables/useHasSavedPaymentMethod'
import { isCloud } from '@/platform/distribution/types'
import { useCancelPendingPayment } from '@/platform/workspace/composables/useCancelPendingPayment'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'
import { useDialogStore } from '@/stores/dialogStore'
import { cn } from '@comfyorg/tailwind-utils'

const { isInsufficientCredits = false } = defineProps<{
  isInsufficientCredits?: boolean
}>()

const { n, t } = useI18n()
const dialogStore = useDialogStore()
const telemetry = useTelemetry()
const toast = useToast()
const settingsDialog = useSettingsDialog()
const { buildDocsUrl, docsPaths } = useExternalLink()
const { balance, fetchBalance, fetchStatus, manageSubscription, topup } =
  useBillingContext()
const { canTopUp } = useBillingCapabilities()

const billingOperationStore = useBillingOperationStore()
const isPolling = computed(() => billingOperationStore.isAddingCredits)
const topupOperation = computed(
  () => billingOperationStore.topupActionOperation
)
const topupActionUrl = computed(() => topupOperation.value?.actionUrl ?? null)
const topupAuthenticationError = computed(
  () => topupOperation.value?.errorMessage ?? null
)
const topupCanRetryAuthentication = computed(
  () => topupOperation.value?.canRetryAuthentication ?? false
)
const topupIsAuthenticating = computed(
  () => topupOperation.value?.isAuthenticating ?? false
)
const topupReconciliationOperationId = computed(() =>
  topupOperation.value?.status === 'reconciliation_needed'
    ? topupOperation.value.opId
    : null
)

// Constants
const PRESET_AMOUNTS = [10, 25, 50, 100]
const MIN_AMOUNT = 5
const MAX_AMOUNT = 10000

// State
const selectedPreset = ref<number | null>(50)
const payAmount = ref(50)
const showCeilingWarning = ref(false)
const loading = ref(false)
const paymentSubmitted = ref(false)
const step = ref<'amount' | 'confirm' | 'verifying' | 'success' | 'declined'>(
  topupOperation.value && canTopUp.value ? 'verifying' : 'amount'
)

const { hasSavedPaymentMethod } = useHasSavedPaymentMethod()

const {
  isCancelingPayment,
  cancelUnavailable,
  cancelUnreachable,
  canceledNoticeVisible,
  cancelPendingPayment,
  showCanceledNotice,
  resetCancelVerdict
} = useCancelPendingPayment()

async function handleCancelPendingPayment() {
  const opId = topupOperation.value?.opId
  if (!opId) return
  const result = await cancelPendingPayment(opId)
  if (result !== 'canceled') return
  // Canceled is not failed: the typed amount survives so paying again does
  // not mean entering it again.
  showCanceledNotice()
  step.value = 'amount'
}

// A cancel verdict describes one operation. A different operation — a fresh
// attempt, a recovered charge — must not inherit it, or a stale refusal
// removes the cancel affordance from a charge it never judged.
watch(() => topupOperation.value?.opId, resetCancelVerdict)

// The refresh that follows a successful charge overwrites the balance, so the
// "previous" figure is captured before the charge rather than derived after
// it. A charge recovered on re-entry has no snapshot — null withholds the
// breakdown instead of reconstructing figures the client never observed.
const balanceBeforeCharge = ref<number | null>(null)
const creditsAdded = ref(0)
const newBalanceCredits = ref(0)
const declineReason = ref<string | null>(null)

function currentBalanceCredits(): number {
  return centsToCredits(
    balance.value?.effectiveBalanceMicros ?? balance.value?.amountMicros ?? 0
  )
}

// Computed
const pricingUrl = computed(() =>
  buildDocsUrl(docsPaths.partnerNodesPricing, { includeLocale: true })
)

const paymentNote = computed(() =>
  hasSavedPaymentMethod.value
    ? t('credits.topUp.chargedImmediatelyNote')
    : t('credits.topUp.paymentDetailsRequiredNote')
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

const displayTotal = computed(() =>
  n(payAmount.value, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
)

const paymentLocked = computed(
  () =>
    loading.value ||
    paymentSubmitted.value ||
    isPolling.value ||
    !!topupOperation.value
)

// The selector stops matching a terminal operation, but the operation stays
// readable by id — that's how a charge recovered on re-entry reports its
// outcome. In-flight charges are routed by handleBuy's own resolution.
const observedTopupOpId = ref<string | null>(null)
watch(
  () => topupOperation.value?.opId,
  (opId) => {
    if (opId) observedTopupOpId.value = opId
  },
  { immediate: true }
)

watch([isPolling, topupOperation], ([polling, operation]) => {
  if (step.value === 'verifying' && !polling && !operation) {
    const settled = observedTopupOpId.value
      ? billingOperationStore.getOperation(observedTopupOpId.value)
      : undefined
    if (!paymentSubmitted.value && settled?.status === 'succeeded') {
      showSuccess()
      return
    }
    if (!paymentSubmitted.value && settled?.status === 'failed') {
      showDeclined(settled.errorMessage ?? null)
      return
    }
    step.value = 'amount'
    return
  }
  if (
    operation &&
    canTopUp.value &&
    (operation.actionUrl ||
      operation.canRetryAuthentication ||
      operation.status === 'reconciliation_needed')
  ) {
    step.value = 'verifying'
  }
})

// Utility functions
function formatNumber(num: number): string {
  return num.toLocaleString('en-US')
}

// Step amount functions
function getStepAmount(currentAmount: number): number {
  if (currentAmount < 100) return 5
  if (currentAmount < 1000) return 50
  return 100
}

function getCreditsStepAmount(currentCredits: number): number {
  const usdAmount = creditsToUsd(currentCredits)
  return usdToCredits(getStepAmount(usdAmount))
}

// Event handlers
function handlePayAmountChange(value: number) {
  payAmount.value = value
  selectedPreset.value = null
  showCeilingWarning.value = false
}

function handlePresetClick(amount: number) {
  showCeilingWarning.value = false
  payAmount.value = amount
  selectedPreset.value = amount
}

function handlePrimaryAction() {
  if (step.value === 'amount') {
    step.value = 'confirm'
    return
  }
  void handleBuy()
}

function openManageBilling() {
  void manageSubscription().catch((error) => {
    reportError(error, { errorType: 'billing_portal_open_failure' })
    toast.add({
      severity: 'error',
      summary: t('credits.topUp.manageBillingError'),
      life: 5000
    })
  })
}

function openTopupVerification() {
  if (!topupActionUrl.value) return
  window.open(topupActionUrl.value, '_blank', 'noopener,noreferrer')
}

function retryTopupAuthentication() {
  const operation = topupOperation.value
  if (!operation || !canTopUp.value) return
  void billingOperationStore.retryPaymentAuthentication(operation.opId)
}

function handleClose(clearTracking = true) {
  if (clearTracking) {
    usePendingTopup().clearPendingTopup()
  }
  dialogStore.closeDialog({ key: 'top-up-credits' })
}

// A receipt states server facts: the balance is read after the refresh that
// follows the charge, and "Added" is the observed delta from the snapshot —
// never client arithmetic on the typed amount.
function showSuccess() {
  const after = currentBalanceCredits()
  newBalanceCredits.value = after
  if (balanceBeforeCharge.value !== null) {
    creditsAdded.value = after - balanceBeforeCharge.value
  }
  step.value = 'success'
}

function showDeclined(reason: string | null) {
  declineReason.value = reason
  step.value = 'declined'
}

function handleBack() {
  if (step.value === 'declined') {
    declineReason.value = null
    step.value = 'confirm'
    return
  }
  step.value = 'amount'
}

function openBillingAndInvoices() {
  handleClose()
  settingsDialog.show(isCloud ? 'workspace' : 'credits')
}

async function handleBuy() {
  if (paymentLocked.value || !isValidAmount.value || !canTopUp.value) {
    return
  }

  loading.value = true
  paymentSubmitted.value = true
  balanceBeforeCharge.value = balance.value ? currentBalanceCredits() : null
  const attemptStartedAt = Date.now()
  try {
    telemetry?.trackApiCreditTopupButtonPurchaseClicked(payAmount.value)
    telemetry?.trackBillingEvent({
      operation: 'topup',
      stage: 'started',
      outcome: 'pending'
    })
    telemetry?.trackBillingEvent({
      operation: 'operation',
      stage: 'started',
      outcome: 'pending',
      operation_type: 'topup'
    })

    const amountCents = payAmount.value * 100
    const response = await topup(amountCents)
    if (!response) {
      paymentSubmitted.value = false
      telemetry?.trackBillingEvent({
        operation: 'topup',
        stage: 'failed',
        outcome: 'failure',
        failure_category: 'unknown',
        duration_ms: Date.now() - attemptStartedAt
      })
      telemetry?.trackBillingEvent({
        operation: 'operation',
        stage: 'failed',
        outcome: 'failure',
        operation_type: 'topup',
        failure_category: 'unknown',
        duration_ms: Date.now() - attemptStartedAt
      })
      return
    }

    if (response.status === 'completed') {
      telemetry?.trackBillingEvent({
        operation: 'topup',
        stage: 'succeeded',
        outcome: 'success',
        billing_op_id: response.billing_op_id,
        duration_ms: Date.now() - attemptStartedAt
      })
      telemetry?.trackBillingEvent({
        operation: 'operation',
        stage: 'succeeded',
        outcome: 'success',
        operation_type: 'topup',
        billing_op_id: response.billing_op_id,
        duration_ms: Date.now() - attemptStartedAt
      })
      await Promise.allSettled([fetchBalance(), fetchStatus()])
      showSuccess()
    } else if (response.status === 'pending') {
      void billingOperationStore
        .startOperation(response.billing_op_id, 'topup', {
          attemptStartedAt,
          autoHandleRequiresAction: true
        })
        .then((operation) => {
          paymentSubmitted.value = false
          if (operation.status === 'succeeded') {
            showSuccess()
          } else if (operation.status === 'failed') {
            showDeclined(operation.errorMessage)
          }
        })
        .catch(() => {
          reportPurchaseError(attemptStartedAt, response.billing_op_id)
        })
    } else {
      // Synchronous 'failed' here means the charge was declined, not rejected pre-attempt.
      paymentSubmitted.value = false
      telemetry?.trackBillingEvent({
        operation: 'topup',
        stage: 'failed',
        outcome: 'failure',
        billing_op_id: response.billing_op_id,
        failure_category: 'provider_decline',
        duration_ms: Date.now() - attemptStartedAt
      })
      telemetry?.trackBillingEvent({
        operation: 'operation',
        stage: 'failed',
        outcome: 'failure',
        operation_type: 'topup',
        billing_op_id: response.billing_op_id,
        failure_category: 'provider_decline',
        duration_ms: Date.now() - attemptStartedAt
      })
      showDeclined(null)
    }
  } catch (error) {
    reportPurchaseError(attemptStartedAt, undefined, error)
  } finally {
    loading.value = false
  }
}

function reportPurchaseError(
  attemptStartedAt: number,
  billingOpId?: string,
  error?: unknown
) {
  paymentSubmitted.value = false
  console.error('Purchase failed', ...(error === undefined ? [] : [error]))

  telemetry?.trackBillingEvent({
    operation: 'topup',
    stage: 'failed',
    outcome: 'failure',
    ...(billingOpId ? { billing_op_id: billingOpId } : {}),
    failure_category:
      error === undefined ? 'unknown' : categorizeBillingApiError(error),
    duration_ms: Date.now() - attemptStartedAt
  })
  telemetry?.trackBillingEvent({
    operation: 'operation',
    stage: 'failed',
    outcome: 'failure',
    operation_type: 'topup',
    ...(billingOpId ? { billing_op_id: billingOpId } : {}),
    failure_category:
      error === undefined ? 'unknown' : categorizeBillingApiError(error),
    duration_ms: Date.now() - attemptStartedAt
  })
  const missingPaymentMethod =
    error instanceof WorkspaceApiError && error.code === 'NO_PAYMENT_METHOD'
  toast.add({
    severity: 'error',
    summary: t('credits.topUp.purchaseError'),
    detail: missingPaymentMethod
      ? t('credits.topUp.noPaymentMethodError')
      : t('credits.topUp.purchaseErrorDetail', {
          error:
            error instanceof Error
              ? error.message
              : t('credits.topUp.unknownError')
        })
  })
}
</script>

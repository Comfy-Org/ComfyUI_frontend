<template>
  <div
    class="flex min-h-[500px] w-[min(512px,95vw)] flex-col rounded-2xl border border-border-default bg-base-background shadow-[1px_1px_8px_0_rgba(0,0,0,0.4)]"
  >
    <!-- Header -->
    <div class="flex items-center justify-between p-8">
      <div class="flex items-center gap-2">
        <button
          v-if="step === 'confirm'"
          class="cursor-pointer rounded-sm border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-base-foreground disabled:pointer-events-none disabled:opacity-40"
          :disabled="paymentLocked"
          :aria-label="$t('g.back')"
          @click="step = 'amount'"
        >
          <i class="icon-[lucide--arrow-left] size-5" />
        </button>
        <h2
          v-if="step !== 'verifying'"
          class="m-0 text-base font-bold text-base-foreground"
        >
          {{ dialogTitle }}
        </h2>
      </div>
      <button
        class="cursor-pointer rounded-sm border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-base-foreground focus-visible:ring-1 focus-visible:ring-border-default focus-visible:outline-none"
        :aria-label="$t('g.close')"
        @click="() => handleClose(!topupIsParkedWithoutLink)"
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
          {{ verificationMessage }}
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
              'h-10 w-full text-base font-medium focus-visible:ring-border-default',
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
        <NumberField
          :model-value="payAmount"
          :min="0"
          :max="MAX_AMOUNT"
          :step="getStepAmount(payAmount)"
          :format-options="{ maximumFractionDigits: 0 }"
          @update:model-value="handlePayAmountChange"
        >
          <NumberFieldDecrement />
          <span class="shrink-0 text-base font-semibold text-base-foreground"
            >$</span
          >
          <NumberFieldInput
            :aria-label="$t('credits.topUp.youPay')"
            class="text-lg font-medium"
          />
          <NumberFieldIncrement />
        </NumberField>
      </div>

      <!-- You Get -->
      <div class="flex flex-1 flex-col gap-3">
        <div class="text-sm text-muted-foreground">
          {{ $t('credits.topUp.youGet') }}
        </div>
        <NumberField
          v-model="creditsModel"
          :min="0"
          :max="usdToCredits(MAX_AMOUNT)"
          :step="getCreditsStepAmount(creditsModel)"
          :format-options="{ maximumFractionDigits: 0 }"
        >
          <NumberFieldDecrement />
          <i class="icon-[lucide--coins] size-4 shrink-0 text-gold-500" />
          <NumberFieldInput
            :aria-label="$t('credits.topUp.youGet')"
            class="text-lg font-medium"
          />
          <NumberFieldIncrement />
        </NumberField>
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
      <div v-if="step === 'verifying'">
        <Button
          v-if="topupCanResumeAuthentication"
          variant="primary"
          size="lg"
          class="h-10 w-full justify-center"
          :loading="topupIsAuthenticating"
          :disabled="!canTopUp"
          @click="resumeTopupAuthentication"
        >
          {{ $t('subscription.preview.completeVerification') }}
        </Button>
        <Button
          v-else-if="topupIsFailedRetryable"
          variant="primary"
          size="lg"
          class="h-10 w-full justify-center"
          @click="startOverTopup"
        >
          {{ $t('credits.topUp.startOver') }}
        </Button>
        <Button
          v-else-if="topupIsParkedWithoutLink"
          variant="secondary"
          size="lg"
          class="h-10 w-full justify-center"
          @click="() => handleClose(false)"
        >
          {{ $t('g.ok') }}
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
          {{ primaryActionLabel }}
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
import { useToast } from '@/components/ui/toast'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { creditsToUsd, usdToCredits } from '@/base/credits/comfyCredits'
import Button from '@/components/ui/button/Button.vue'
import NumberField from '@/components/ui/number-field/NumberField.vue'
import NumberFieldDecrement from '@/components/ui/number-field/NumberFieldDecrement.vue'
import NumberFieldIncrement from '@/components/ui/number-field/NumberFieldIncrement.vue'
import NumberFieldInput from '@/components/ui/number-field/NumberFieldInput.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useExternalLink } from '@/composables/useExternalLink'
import { useTelemetry } from '@/platform/telemetry'
import { usePendingTopup } from '@/composables/billing/usePendingTopup'
import { isCloud } from '@/platform/distribution/types'
import type {
  CheckoutJourneyPhaseEvent,
  PaymentIntentSource
} from '@/platform/telemetry/types'
import { categorizeBillingApiError } from '@/platform/telemetry/utils/billingFailureCategory'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { reportError } from '@/platform/telemetry/reportError'
import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'
import { isBlockedOnCustomerPhase } from '@/platform/workspace/billing/customerAttention'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useHasSavedPaymentMethod } from '@/platform/workspace/composables/useHasSavedPaymentMethod'
import { useTopupOperation } from '@/platform/workspace/composables/useTopupOperation'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'
import {
  bindOperationToCheckoutJourney,
  clearCheckoutJourney,
  getActiveCheckoutJourney,
  resolveCheckoutAssignment,
  resolveCheckoutJourney,
  resolveEntrySource,
  toCheckoutJourneyContext
} from '@/platform/workspace/utils/checkoutJourney'
import type { CheckoutJourneyRecord } from '@/platform/workspace/utils/checkoutJourney'
import { api } from '@/scripts/api'
import { useAuthStore } from '@/stores/authStore'
import { useDialogStore } from '@/stores/dialogStore'
import { cn } from '@comfyorg/tailwind-utils'

const { isInsufficientCredits = false, source } = defineProps<{
  isInsufficientCredits?: boolean
  source?: PaymentIntentSource
}>()

const { n, t } = useI18n()
const dialogStore = useDialogStore()
const settingsDialog = useSettingsDialog()
const telemetry = useTelemetry()
const toast = useToast()
const { buildDocsUrl, docsPaths } = useExternalLink()
const { fetchBalance, fetchStatus, manageSubscription } = useBillingContext()
const { canTopUp } = useBillingCapabilities()

const workspaceStore = useTeamWorkspaceStore()
const billingOperationStore = useBillingOperationStore()

function emitTopupJourneyPhase(
  record: CheckoutJourneyRecord,
  phase: CheckoutJourneyPhaseEvent
): void {
  telemetry?.trackCheckoutJourneyEvent({
    ...toCheckoutJourneyContext(record),
    ...phase
  })
}

function enterTopupJourney(): void {
  const workspaceId = workspaceStore.activeWorkspaceId
  const ownerUid = useAuthStore().userId
  if (!workspaceId || !ownerUid) return

  const entrySource = resolveEntrySource(source, 'settings_billing')
  const resolved = resolveCheckoutJourney({
    actorUid: ownerUid,
    workspaceId,
    entryFlow: 'topup',
    entrySource,
    intent: entrySource,
    assignment: resolveCheckoutAssignment(api.getServerFeatures())
  })
  if (resolved.status === 'blocked' || resolved.resumed) return

  emitTopupJourneyPhase(resolved.record, { phase: 'entered' })
}

onMounted(enterTopupJourney)
const {
  isAddingCredits,
  topupOperation,
  topup,
  retryPaymentAuthentication,
  dismissOperation
} = useTopupOperation()
// Start over invalidates the attempt in flight: on the SDK rail the purchase
// call resolves only at settlement, so a superseded attempt must not unlock
// or close the dialog for the attempt that replaced it.
let purchaseAttempt = 0
const topupActionUrl = computed(() => topupOperation.value?.actionUrl ?? null)
const topupAuthenticationError = computed(
  () => topupOperation.value?.errorMessage ?? null
)
const topupCanResumeAuthentication = computed(
  () => topupOperation.value?.canRetryAuthentication ?? false
)
const topupIsAuthenticating = computed(
  () => topupOperation.value?.isAuthenticating ?? false
)
const topupIsFailedRetryable = computed(
  () => topupOperation.value?.authenticationState === 'failed_retryable'
)
// Parked on the customer with no link to send them to. The operation stays open
// server-side, and that also refuses a replacement purchase, so this state
// explains the wait rather than offering a restart that would be rejected.
// Leaving this screen keeps the pending-top-up marker: the copy sends the
// customer off to pay elsewhere, and the marker outlives the wait, so it is
// what refreshes the balance when they come back to a settled purchase.
// Latent on this rail today — only the legacy hosted-checkout path sets the
// marker, so usually there is none here to keep. Preserving it is still right,
// and it starts paying off if this rail ever sets one when it parks.
const topupIsParkedWithoutLink = computed(
  () =>
    !topupActionUrl.value &&
    isBlockedOnCustomerPhase(topupOperation.value?.phase)
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
const loading = ref(false)
const paymentSubmitted = ref(false)
const step = ref<'amount' | 'confirm' | 'verifying'>(
  topupOperation.value && canTopUp.value ? 'verifying' : 'amount'
)

const { hasSavedPaymentMethod } = useHasSavedPaymentMethod()

// Computed
const pricingUrl = computed(() =>
  buildDocsUrl(docsPaths.partnerNodesPricing, { includeLocale: true })
)

const paymentNote = computed(() =>
  hasSavedPaymentMethod.value
    ? t('credits.topUp.chargedImmediatelyNote')
    : t('credits.topUp.paymentDetailsRequiredNote')
)

const dialogTitle = computed(() => {
  if (step.value === 'confirm') return t('credits.topUp.confirmTitle')
  return t(
    isInsufficientCredits
      ? 'credits.topUp.addMoreCreditsToRun'
      : 'credits.topUp.addMoreCredits'
  )
})
const verificationMessage = computed(() => {
  if (topupReconciliationOperationId.value) {
    return t('billingOperation.reconciliationDetail')
  }
  if (topupAuthenticationError.value) return topupAuthenticationError.value
  if (topupIsParkedWithoutLink.value) {
    return t('credits.topUp.awaitingBankApprovalBody')
  }
  return t('credits.topUp.verifyBody')
})
const primaryActionLabel = computed(() =>
  step.value === 'confirm'
    ? t('credits.topUp.payAmount', { amount: displayTotal.value })
    : t('subscription.addCredits')
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
    isAddingCredits.value ||
    !!topupOperation.value
)

watch(
  [isAddingCredits, topupOperation, canTopUp],
  ([addingCredits, operation, allowed]) => {
    if (addingCredits || operation) loading.value = false
    if (step.value === 'verifying' && !addingCredits && !operation) {
      step.value = 'amount'
      return
    }
    if (operation && allowed) {
      step.value = 'verifying'
    }
  }
)

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
}

function handlePresetClick(amount: number) {
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
    toast.error(t('credits.topUp.manageBillingError'), { duration: 5000 })
  })
}

function openTopupVerification() {
  if (!topupActionUrl.value) return
  window.open(topupActionUrl.value, '_blank', 'noopener,noreferrer')
}

function resumeTopupAuthentication() {
  const operation = topupOperation.value
  if (!operation || !canTopUp.value) return
  void retryPaymentAuthentication(operation.opId)
}

function startOverTopup() {
  purchaseAttempt += 1
  const operation = topupOperation.value
  if (operation) dismissOperation(operation.opId)
  paymentSubmitted.value = false
  step.value = 'amount'
}

function handleClose(clearTracking = true) {
  if (clearTracking) {
    usePendingTopup().clearPendingTopup()
  }
  dialogStore.closeDialog({ key: 'top-up-credits' })
}

async function handleBuy() {
  if (paymentLocked.value || !isValidAmount.value || !canTopUp.value) {
    return
  }

  purchaseAttempt += 1
  const attempt = purchaseAttempt
  const isCurrentAttempt = () => attempt === purchaseAttempt
  loading.value = true
  paymentSubmitted.value = true
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

    const submittingJourney = getActiveCheckoutJourney()
    if (submittingJourney) {
      emitTopupJourneyPhase(submittingJourney, { phase: 'submitted' })
    }

    const amountCents = payAmount.value * 100
    const response = await topup(amountCents)
    await handleTopupResponse(
      response,
      submittingJourney,
      attemptStartedAt,
      isCurrentAttempt
    )
  } catch (error) {
    reportPurchaseError(attemptStartedAt, undefined, error, isCurrentAttempt())
  } finally {
    if (isCurrentAttempt()) loading.value = false
  }
}

async function handleTopupResponse(
  response: Awaited<ReturnType<typeof topup>>,
  submittingJourney: CheckoutJourneyRecord | null,
  attemptStartedAt: number,
  isCurrentAttempt: () => boolean
) {
  if (!response) {
    if (isCurrentAttempt()) paymentSubmitted.value = false
    trackTopupFailure('unknown', undefined, attemptStartedAt)
    return
  }

  linkTopupJourney(submittingJourney, response.billing_op_id)
  if (response.status === 'completed') {
    await completeTopup(
      response.billing_op_id,
      attemptStartedAt,
      isCurrentAttempt
    )
    return
  }
  if (response.status === 'pending') {
    monitorPendingTopup(
      response.billing_op_id,
      attemptStartedAt,
      isCurrentAttempt
    )
    return
  }
  reportDeclinedTopup(
    response.billing_op_id,
    attemptStartedAt,
    isCurrentAttempt()
  )
}

function linkTopupJourney(
  submittingJourney: CheckoutJourneyRecord | null,
  billingOpId: string
) {
  if (
    !submittingJourney ||
    getActiveCheckoutJourney()?.journey_id !== submittingJourney.journey_id
  )
    return
  const linkedJourney = bindOperationToCheckoutJourney(billingOpId)
  if (linkedJourney) {
    emitTopupJourneyPhase(linkedJourney, {
      phase: 'operation_linked',
      billing_op_id: billingOpId
    })
  }
}

async function completeTopup(
  billingOpId: string,
  attemptStartedAt: number,
  isCurrentAttempt: () => boolean
) {
  if (getActiveCheckoutJourney()?.billing_op_id === billingOpId) {
    clearCheckoutJourney()
  }
  trackTopupOutcome('succeeded', billingOpId, attemptStartedAt)
  toast.success(t('credits.topUp.purchaseSuccess'), { duration: 5000 })
  await Promise.allSettled([fetchBalance(), fetchStatus()])
  if (!isCurrentAttempt()) return
  handleClose(false)
  settingsDialog.show(isCloud ? 'workspace' : 'credits')
}

function monitorPendingTopup(
  billingOpId: string,
  attemptStartedAt: number,
  isCurrentAttempt: () => boolean
) {
  void billingOperationStore
    .startOperation(billingOpId, 'topup', {
      attemptStartedAt,
      autoHandleRequiresAction: true
    })
    .then(() => {
      if (isCurrentAttempt()) paymentSubmitted.value = false
    })
    .catch(() => {
      reportPurchaseError(
        attemptStartedAt,
        billingOpId,
        undefined,
        isCurrentAttempt()
      )
    })
}

function reportDeclinedTopup(
  billingOpId: string,
  attemptStartedAt: number,
  currentAttempt: boolean
) {
  if (currentAttempt) paymentSubmitted.value = false
  trackTopupOutcome('failed', billingOpId, attemptStartedAt)
  toast.error(t('credits.topUp.purchaseError'), {
    description: t('credits.topUp.unknownError')
  })
}

function trackTopupOutcome(
  stage: 'succeeded' | 'failed',
  billingOpId: string,
  attemptStartedAt: number
) {
  if (stage === 'failed') {
    trackTopupFailure('provider_decline', billingOpId, attemptStartedAt)
    return
  }
  telemetry?.trackBillingEvent({
    operation: 'topup',
    stage,
    outcome: 'success',
    billing_op_id: billingOpId,
    duration_ms: Date.now() - attemptStartedAt
  })
  telemetry?.trackBillingEvent({
    operation: 'operation',
    stage,
    outcome: 'success',
    operation_type: 'topup',
    billing_op_id: billingOpId,
    duration_ms: Date.now() - attemptStartedAt
  })
}

function trackTopupFailure(
  failureCategory: 'unknown' | 'provider_decline',
  billingOpId: string | undefined,
  attemptStartedAt: number
) {
  const operation = {
    stage: 'failed' as const,
    outcome: 'failure' as const,
    ...(billingOpId && { billing_op_id: billingOpId }),
    failure_category: failureCategory,
    duration_ms: Date.now() - attemptStartedAt
  }
  telemetry?.trackBillingEvent({ operation: 'topup', ...operation })
  telemetry?.trackBillingEvent({
    operation: 'operation',
    operation_type: 'topup',
    ...operation
  })
}

function reportPurchaseError(
  attemptStartedAt: number,
  billingOpId?: string,
  error?: unknown,
  currentAttempt = true
) {
  if (currentAttempt) paymentSubmitted.value = false
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
  toast.error(t('credits.topUp.purchaseError'), {
    description: purchaseErrorDetail(error)
  })
}

function purchaseErrorDetail(error?: unknown): string {
  const code = error instanceof WorkspaceApiError ? error.code : undefined
  if (code === 'NO_PAYMENT_METHOD') {
    return t('credits.topUp.noPaymentMethodError')
  }
  // Only one billing operation is open at a time, so this refusal means the
  // previous purchase has not settled or expired yet — not that anything failed.
  if (code === 'SUBSCRIPTION_CHANGE_IN_PROGRESS') {
    return t('credits.topUp.changeInProgressError')
  }
  return t('credits.topUp.purchaseErrorDetail', {
    error:
      error instanceof Error ? error.message : t('credits.topUp.unknownError')
  })
}
</script>

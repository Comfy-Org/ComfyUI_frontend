<template>
  <Card class="flex min-h-[500px] w-[min(512px,95vw)] flex-col shadow-md">
    <!-- Header -->
    <div class="flex items-center justify-between p-8">
      <div class="flex items-center gap-2">
        <button
          v-if="step === 'confirm'"
          class="cursor-pointer rounded-sm border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          :disabled="paymentLocked"
          :aria-label="$t('g.back')"
          @click="showAmountStep"
        >
          <i class="icon-[lucide--arrow-left] size-5" />
        </button>
        <DialogTitle
          v-if="step === 'amount' || step === 'confirm'"
          class="m-0 font-bold"
        >
          {{
            step === 'confirm'
              ? $t('credits.topUp.confirmTitle')
              : isInsufficientCredits
                ? $t('credits.topUp.addMoreCreditsToRun')
                : $t('credits.topUp.addMoreCredits')
          }}
        </DialogTitle>
      </div>
      <button
        class="cursor-pointer rounded-sm border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        :aria-label="$t('g.close')"
        @click="
          () =>
            handleClose(
              !topupIsParkedWithoutLink &&
                step !== 'checkoutOpened' &&
                step !== 'checkoutBlocked'
            )
        "
      >
        <i class="icon-[lucide--x] size-6" />
      </button>
    </div>
    <p
      v-if="isInsufficientCredits && step === 'amount'"
      class="m-0 px-8 pb-4 text-sm text-muted-foreground"
    >
      {{ $t('credits.topUp.insufficientWorkflowMessage') }}
    </p>

    <template v-if="step === 'confirm'">
      <p class="m-0 px-8 text-sm text-muted-foreground">
        {{ $t('credits.topUp.confirmSubtitle') }}
      </p>
      <div class="flex flex-col gap-3 px-8 pt-6 font-semibold">
        <span class="flex items-center gap-2 py-2 text-2xl tabular-nums">
          <i class="icon-[lucide--coins] size-5 text-credit" />
          {{ formatNumber(creditsModel) }}
        </span>
        <div class="flex items-center justify-between border-t pt-4 text-base">
          <span>
            {{ $t('subscription.preview.totalDueToday') }}
          </span>
          <span class="tabular-nums">
            {{ displayTotal }}
          </span>
        </div>
      </div>
      <p
        v-if="checkoutRecovery === 'refused'"
        class="m-0 px-8 pt-4 text-sm text-muted-foreground"
      >
        {{ $t('credits.topUp.noPaymentMethodCheckoutHint') }}
      </p>
      <p
        v-else-if="checkoutRecovery === 'failed'"
        role="alert"
        class="m-0 px-8 pt-4 text-sm text-destructive"
      >
        {{ $t('credits.topUp.checkoutOpenFailed') }}
      </p>
    </template>

    <div
      v-if="step === 'checkoutOpened'"
      class="flex flex-col items-center gap-3 px-8 text-center"
    >
      <DialogTitle class="m-0 text-center text-xl lg:text-2xl">
        {{ $t('credits.topUp.checkoutOpenedTitle') }}
      </DialogTitle>
      <p class="m-0 text-sm text-balance text-muted-foreground">
        {{ $t('credits.topUp.checkoutOpenedBody') }}
      </p>
      <p
        v-if="checkoutReopenFailed"
        role="alert"
        class="m-0 text-sm text-destructive"
      >
        {{ $t('credits.topUp.checkoutOpenFailed') }}
      </p>
    </div>

    <div
      v-if="step === 'checkoutBlocked'"
      class="flex flex-col items-center gap-3 px-8 text-center"
    >
      <DialogTitle class="m-0 text-center text-xl lg:text-2xl">
        {{ $t('credits.topUp.checkoutBlockedTitle') }}
      </DialogTitle>
      <p class="m-0 text-sm text-balance text-muted-foreground">
        {{ $t('credits.topUp.checkoutBlockedBody') }}
      </p>
    </div>

    <div
      v-if="step === 'defaultCardBlocked'"
      class="flex flex-col items-center gap-3 px-8 text-center"
    >
      <DialogTitle class="m-0 text-center text-xl lg:text-2xl">
        {{ $t('credits.topUp.defaultCardBlockedTitle') }}
      </DialogTitle>
      <p class="m-0 text-sm text-balance text-muted-foreground">
        {{ $t('credits.topUp.defaultCardBlockedBody') }}
      </p>
    </div>

    <template v-if="step === 'verifying'">
      <div class="flex flex-col items-center gap-3 px-8 text-center">
        <i class="icon-[lucide--shield-alert] size-10 text-warning" />
        <DialogTitle class="m-0 text-xl lg:text-2xl">
          {{ $t('credits.topUp.verifyTitle') }}
        </DialogTitle>
        <p class="m-0 text-sm text-balance text-muted-foreground">
          {{ verifyingBody }}
        </p>
        <span v-if="topupReconciliationOperationId" class="font-mono text-sm">
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
          v-for="amount in TOPUP_AMOUNT_PRESETS_USD"
          :key="amount"
          :autofocus="amount === 50"
          variant="secondary"
          size="lg"
          :class="
            cn(
              'h-10 w-full text-base focus-visible:ring-ring',
              selectedPreset === amount && 'bg-muted'
            )
          "
          @click="handlePresetClick(amount)"
        >
          ${{ amount }}
        </Button>
      </div>
      <p
        v-if="planCreditCopy"
        class="m-0 pt-3 text-sm text-muted-foreground"
        data-testid="top-up-plan-credit-line"
      >
        {{ planCreditCopy }}
      </p>
    </div>
    <!-- Amount (USD) / Credits -->
    <div v-if="step === 'amount'" class="flex gap-2 px-8 pt-8">
      <!-- You Pay -->
      <div
        class="flex min-w-0 flex-1 flex-col gap-3"
        data-testid="top-up-pay-amount"
      >
        <div class="text-sm text-muted-foreground">
          {{ $t('credits.topUp.youPay') }}
        </div>
        <FormNumberField
          class="w-full"
          :aria-label="$t('credits.topUp.youPay')"
          input-class="text-lg font-medium"
          :model-value="payAmount"
          :min="0"
          :max="MAX_AMOUNT"
          :step="getStepAmount(payAmount)"
          :format-options="{ maximumFractionDigits: 0 }"
          @update:model-value="handlePayAmountChange"
        >
          <template #prefix>
            <span class="shrink-0 text-base font-semibold">$</span>
          </template>
        </FormNumberField>
      </div>

      <!-- You Get -->
      <div class="flex min-w-0 flex-1 flex-col gap-3">
        <div class="text-sm text-muted-foreground">
          {{ $t('credits.topUp.youGet') }}
        </div>
        <FormNumberField
          v-model="creditsModel"
          class="w-full"
          :aria-label="$t('credits.topUp.youGet')"
          input-class="text-lg font-medium"
          :min="0"
          :max="usdToCredits(MAX_AMOUNT)"
          :step="getCreditsStepAmount(creditsModel)"
          :format-options="{ maximumFractionDigits: 0 }"
        >
          <template #prefix>
            <i class="icon-[lucide--coins] size-4 shrink-0 text-credit" />
          </template>
        </FormNumberField>
      </div>
    </div>

    <!-- Warnings -->

    <p
      v-if="negativeBalanceCredits !== null && step === 'amount'"
      class="m-0 px-8 pt-4 text-sm text-muted-foreground"
    >
      {{
        $t(
          'credits.topUp.negativeBalanceNotice',
          { credits: formatNumber(negativeBalanceCredits) },
          negativeBalanceCredits
        )
      }}
    </p>
    <p
      v-if="isBelowMin && step === 'amount'"
      class="m-0 flex items-center justify-center gap-1 px-8 pt-4 text-center text-sm text-destructive"
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
      class="m-0 flex items-center justify-center gap-1 px-8 pt-4 text-center text-sm text-warning"
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
          v-if="topupIsFailedRetryable"
          variant="primary"
          size="lg"
          class="w-full"
          @click="startOverTopup"
        >
          {{ $t('credits.topUp.startOver') }}
        </Button>
        <Button
          v-else-if="topupIsParkedWithoutLink"
          variant="secondary"
          size="lg"
          class="w-full"
          @click="() => handleClose(false)"
        >
          {{ $t('g.ok') }}
        </Button>
        <Button
          v-else-if="!topupReconciliationOperationId"
          variant="primary"
          size="lg"
          class="w-full"
          :disabled="!topupActionUrl || !canTopUp"
          :loading="!topupActionUrl"
          :aria-label="$t('subscription.preview.completeVerification')"
          @click="openTopupVerification"
        >
          {{ $t('subscription.preview.completeVerification') }}
        </Button>
      </div>
      <div
        v-else-if="step === 'checkoutOpened'"
        class="flex flex-col items-center gap-4"
      >
        <Button
          variant="secondary"
          size="lg"
          class="w-full"
          @click="() => handleClose(false)"
        >
          {{ $t('g.close') }}
        </Button>
        <Button
          variant="link"
          size="md"
          :disabled="!canTopUp"
          :loading
          @click="reopenCheckout"
        >
          {{ $t('credits.topUp.reopenCheckout') }}
          <i class="icon-[lucide--external-link] size-4" />
        </Button>
      </div>
      <Button
        v-else-if="step === 'checkoutBlocked'"
        variant="primary"
        size="lg"
        class="w-full"
        :loading="loading"
        @click="retryBlockedCheckout"
      >
        {{ $t('credits.topUp.openCheckout') }}
        <i class="icon-[lucide--external-link] size-4" />
      </Button>
      <Button
        v-else-if="step === 'defaultCardBlocked' && blockedDefaultCardUrl"
        as="a"
        :href="blockedDefaultCardUrl"
        target="_blank"
        rel="noopener"
        variant="primary"
        size="lg"
        class="w-full no-underline"
        @click="followBlockedDefaultCardLink"
      >
        {{ $t('credits.topUp.openPaymentPage') }}
        <i class="icon-[lucide--external-link] size-4" />
      </Button>
      <div v-else class="flex flex-col gap-2">
        <Button
          v-if="step === 'confirm' && topupActionUrl && canTopUp"
          variant="primary"
          size="lg"
          @click="openTopupVerification"
        >
          {{ $t('subscription.preview.completeVerification') }}
        </Button>
        <Button
          v-if="step === 'confirm' && checkoutRecovery"
          variant="primary"
          size="lg"
          :disabled="!isValidAmount || paymentLocked || !canTopUp"
          :loading="paymentInFlight"
          @click="continueToCheckout"
        >
          {{ $t('credits.topUp.continueToCheckout') }}
          <i class="icon-[lucide--external-link] size-4" />
        </Button>
        <Button
          v-else
          :disabled="!isValidAmount || paymentLocked || !canTopUp"
          :loading="paymentInFlight"
          :variant="
            step === 'confirm' && topupActionUrl ? 'tertiary' : 'primary'
          "
          size="lg"
          class="tabular-nums"
          :data-dd-action-name="BILLING_ACTION_NAME.topUpPrimary"
          @click="handlePrimaryAction"
        >
          {{
            step === 'confirm'
              ? $t('credits.topUp.payAmount', { amount: displayTotal })
              : $t('subscription.addCredits')
          }}
        </Button>
        <Button
          v-if="step === 'confirm' && checkoutRecovery"
          variant="secondary"
          size="lg"
          :disabled="paymentLocked"
          :loading="openingDefaultCardPortal"
          @click="setDefaultCard"
        >
          {{ $t('credits.topUp.setDefaultCard') }}
        </Button>
      </div>
      <div
        v-if="step === 'amount'"
        class="flex items-center justify-center gap-1"
      >
        <a
          :href="pricingUrl"
          target="_blank"
          class="flex items-center gap-1 text-sm text-muted-foreground no-underline transition-colors hover:text-foreground"
        >
          {{ $t('credits.topUp.viewPricing') }}
          <i class="icon-[lucide--external-link] size-4" />
        </a>
      </div>
    </div>
  </Card>
</template>

<script setup lang="ts">
import Card from '@/components/ui/card/Card.vue'
import { BILLING_ACTION_NAME } from '@/platform/telemetry/billingActionNames'
import type { BillingOperationTerminal } from '@comfyorg/account-core/billing'
import {
  getTopupAmountPreset,
  TOPUP_AMOUNT_PRESETS_USD
} from '@comfyorg/account-core/billing'
import { useToast } from '@/components/ui/toast/toastStore'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  centsToCredits,
  creditsToUsd,
  usdToCredits
} from '@/base/credits/comfyCredits'
import Button from '@/components/ui/button/Button.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import FormNumberField from '@/components/common/FormNumberField.vue'
import { watchForTopupBalanceUpdate } from '@/platform/billing/composables/topupBalanceRefresh'
import { useTopUpPlanCreditCopy } from '@/platform/billing/composables/useTopUpPlanCreditCopy'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useExternalLink } from '@/composables/useExternalLink'
import { useTelemetry } from '@/platform/telemetry'
import { usePendingTopup } from '@/platform/billing/composables/usePendingTopup'
import { isCloud } from '@/platform/distribution/types'
import type { PaymentIntentSource } from '@/platform/telemetry/types'
import { categorizeBillingApiError } from '@/platform/telemetry/utils/billingFailureCategory'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import type { CreateTopupResponse } from '@/platform/workspace/api/workspaceApi'
import {
  WorkspaceApiError,
  workspaceApi
} from '@/platform/workspace/api/workspaceApi'
import type { BillingTab } from '@/platform/billing/billingTab'
import { reserveBillingTab } from '@/platform/billing/billingTab'
import { registerRefreshOnReturn } from '@/platform/billing/refreshOnReturn'
import { topupCheckoutReturnUrl } from '@/platform/billing/topupCheckoutReturnUrl'
import { isBlockedOnCustomerPhase } from '@/platform/billing/customerAttention'
import { UncreditedTopupResponse } from '@/platform/billing/sdk/topupOperationView'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useTopupOperation } from '@/platform/billing/composables/useTopupOperation'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import {
  bindOperationToCheckoutJourney,
  clearCheckoutJourney,
  getActiveCheckoutJourney,
  resolveCheckoutAssignment,
  resolveCheckoutJourney,
  resolveEntrySource
} from '@/platform/billing/utils/checkoutJourney'
import {
  trackCheckoutJourneyPhase,
  useCheckoutJourneyExit
} from '@/platform/billing/utils/checkoutJourneyTelemetry'
import { api } from '@/scripts/api'
import { useAuthStore } from '@/stores/authStore'
import { useDialogStore } from '@/stores/dialogStore'
import { getErrorMessage } from '@/utils/errorUtil'
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
const { balance, fetchBalance, fetchStatus } = useBillingContext()
const planCreditCopy = useTopUpPlanCreditCopy()
const billingCapabilities = useBillingCapabilities()
const { canTopUp } = billingCapabilities

const workspaceStore = useTeamWorkspaceStore()

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
    paymentIntentSource: source,
    intent: entrySource,
    assignment: resolveCheckoutAssignment(api.getServerFeatures())
  })
  if (resolved.status === 'blocked' || resolved.resumed) return

  trackCheckoutJourneyPhase(resolved.record, { phase: 'entered' })
}

onMounted(enterTopupJourney)
useCheckoutJourneyExit()
const {
  billingClient,
  isAddingCredits,
  topupOperation,
  topup,
  createHostedCheckout,
  dismissOperation,
  adoptPendingOperation
} = useTopupOperation()
// Start over invalidates the attempt in flight: on the SDK rail the purchase
// call resolves only at settlement, so a superseded attempt must not unlock
// or close the dialog for the attempt that replaced it.
let purchaseAttempt = 0
const topupActionUrl = computed(() => topupOperation.value?.actionUrl ?? null)
const topupAuthenticationError = computed(
  () => topupOperation.value?.errorMessage ?? null
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
const verifyingBody = computed(() => {
  if (topupReconciliationOperationId.value) {
    return t('billingOperation.reconciliationDetail')
  }
  if (topupAuthenticationError.value) return topupAuthenticationError.value
  if (topupIsParkedWithoutLink.value) {
    return t('credits.topUp.awaitingBankApprovalBody')
  }
  return t('credits.topUp.verifyBody')
})

// Constants
const MIN_AMOUNT = 5
const MAX_AMOUNT = 10000
const DEFAULT_AMOUNT = 50

function wholeDollarsOrNull(cents: number | null | undefined): number | null {
  if (cents == null) return null
  const dollars = cents / 100
  return Number.isInteger(dollars) ? dollars : null
}

// State
const suggestedAmount = computed(() =>
  wholeDollarsOrNull(balance.value?.suggestedTopupAmountCents)
)
const selectedPreset = ref<number | null>(
  suggestedAmount.value === null ? DEFAULT_AMOUNT : null
)
const payAmount = ref(suggestedAmount.value ?? DEFAULT_AMOUNT)
const amountEditedByUser = ref(false)

watch(suggestedAmount, (amount) => {
  if (amount === null || amountEditedByUser.value || step.value !== 'amount')
    return
  payAmount.value = amount
  selectedPreset.value = null
})
const loading = ref(false)
const paymentSubmitted = ref(false)
const checkoutRecovery = ref<'refused' | 'failed' | null>(null)
const blockedDefaultCardUrl = ref<string | null>(null)
const checkoutReopenFailed = ref(false)
const stepBeforeCheckoutBlocked = ref<'confirm' | 'checkoutOpened'>('confirm')
const step = ref<
  | 'amount'
  | 'confirm'
  | 'verifying'
  | 'checkoutOpened'
  | 'checkoutBlocked'
  | 'defaultCardBlocked'
>(topupOperation.value && canTopUp.value ? 'verifying' : 'amount')

// Computed
const pricingUrl = computed(() =>
  buildDocsUrl(docsPaths.partnerNodesPricing, { includeLocale: true })
)

const creditsModel = computed({
  get: () => usdToCredits(payAmount.value),
  set: (newCredits: number) => {
    payAmount.value = Math.round(creditsToUsd(newCredits))
    selectedPreset.value = null
    amountEditedByUser.value = true
  }
})

const isValidAmount = computed(
  () => payAmount.value >= MIN_AMOUNT && payAmount.value <= MAX_AMOUNT
)

const negativeBalanceCredits = computed(() => {
  const info = balance.value
  const cents = info?.effectiveBalanceMicros
  if (cents === undefined || cents >= 0) return null
  if (info?.effectiveBalanceAuthoritative === false) return null
  return centsToCredits(-cents)
})

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

const paymentInFlight = computed(
  () =>
    loading.value ||
    paymentSubmitted.value ||
    isAddingCredits.value ||
    !!topupOperation.value
)

const openingDefaultCardPortal = ref(false)

const paymentLocked = computed(
  () => paymentInFlight.value || openingDefaultCardPortal.value
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
  amountEditedByUser.value = true
}

function handlePresetClick(amount: number) {
  payAmount.value = amount
  selectedPreset.value = amount
  amountEditedByUser.value = true
}

function handlePrimaryAction() {
  if (step.value === 'amount') {
    telemetry?.trackBillingEvent({
      operation: 'topup',
      stage: 'intent',
      outcome: 'pending',
      payment_intent_source: source
    })
    step.value = 'confirm'
    return
  }
  void handleBuy()
}

function openTopupVerification() {
  if (!topupActionUrl.value) return
  window.open(topupActionUrl.value, '_blank', 'noopener,noreferrer')
}

function showAmountStep() {
  stopPayRetryOnCardReturn()
  checkoutRecovery.value = null
  step.value = 'amount'
}

function startOverTopup() {
  purchaseAttempt += 1
  const operation = topupOperation.value
  if (operation) dismissOperation(operation.opId)
  paymentSubmitted.value = false
  showAmountStep()
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
  checkoutRecovery.value = null
  loading.value = true
  paymentSubmitted.value = true
  const attemptStartedAt = Date.now()
  const amountCents = payAmount.value * 100
  try {
    telemetry?.trackApiCreditTopupButtonPurchaseClicked(payAmount.value)
    telemetry?.trackBillingEvent({
      operation: 'topup',
      stage: 'started',
      outcome: 'pending',
      payment_intent_source: source,
      amount_cents: amountCents,
      amount_preset: getTopupAmountPreset(selectedPreset.value)
    })
    telemetry?.trackBillingEvent({
      operation: 'operation',
      stage: 'started',
      outcome: 'pending',
      operation_type: 'topup',
      billing_client: billingClient
    })

    const submittingJourney = getActiveCheckoutJourney()
    if (submittingJourney) {
      trackCheckoutJourneyPhase(submittingJourney, { phase: 'submitted' })
    }

    const response = await topup(amountCents)
    if (!response) {
      if (isCurrentAttempt()) paymentSubmitted.value = false
      reportTerminal(attemptStartedAt, {
        stage: 'failed',
        outcome: 'failure',
        failure_category: 'unknown'
      })
      return
    }

    // Only correlate the response to the journey that submitted it: the user
    // may have closed this dialog and started another journey while the
    // request was in flight, and that later journey must not be bound here.
    const submittingJourneyStillActive =
      submittingJourney !== null &&
      getActiveCheckoutJourney()?.journey_id === submittingJourney.journey_id
    if (submittingJourneyStillActive) {
      const linkedJourney = bindOperationToCheckoutJourney(
        response.billing_op_id
      )
      if (linkedJourney) {
        trackCheckoutJourneyPhase(linkedJourney, {
          phase: 'operation_linked',
          billing_op_id: response.billing_op_id
        })
      }
    }

    reportResponseTerminal(response, attemptStartedAt)

    if (response.status === 'completed') {
      if (
        getActiveCheckoutJourney()?.billing_op_id === response.billing_op_id
      ) {
        clearCheckoutJourney()
      }
      toast.success(t('credits.topUp.purchaseSuccess'), { duration: 5000 })
      await Promise.allSettled([fetchBalance(), fetchStatus()])
      if (!isCurrentAttempt()) return
      handleClose(false)
      settingsDialog.show(isCloud ? 'workspace' : 'credits')
    } else if (response.status === 'pending') {
      void adoptPendingOperation(response.billing_op_id, {
        attemptStartedAt,
        paymentIntentSource: source
      })
        .then(() => {
          if (isCurrentAttempt()) paymentSubmitted.value = false
        })
        .catch(() => {
          reportPurchaseError(
            attemptStartedAt,
            response.billing_op_id,
            undefined,
            isCurrentAttempt()
          )
        })
    } else {
      if (isCurrentAttempt()) paymentSubmitted.value = false
      toast.error(t('credits.topUp.purchaseError'), {
        description: t('credits.topUp.unknownError')
      })
    }
  } catch (error) {
    reportPurchaseError(attemptStartedAt, undefined, error, isCurrentAttempt())
  } finally {
    if (isCurrentAttempt()) loading.value = false
  }
}

function reportPurchaseError(
  attemptStartedAt: number,
  billingOpId?: string,
  error?: unknown,
  currentAttempt = true
) {
  if (currentAttempt) paymentSubmitted.value = false
  console.error('Purchase failed', ...(error === undefined ? [] : [error]))

  reportTerminal(
    attemptStartedAt,
    {
      stage: 'failed',
      outcome: 'failure',
      failure_category:
        error === undefined ? 'unknown' : categorizeBillingApiError(error)
    },
    billingOpId
  )
  if (isNoPaymentMethodRefusal(error)) {
    if (currentAttempt) checkoutRecovery.value = 'refused'
    return
  }
  toast.error(t('credits.topUp.purchaseError'), {
    description: purchaseErrorDetail(error)
  })
}

function isNoPaymentMethodRefusal(error: unknown): boolean {
  return (
    error instanceof WorkspaceApiError && error.code === 'NO_PAYMENT_METHOD'
  )
}

let unmounted = false
let stopDefaultCardReturnRefresh: (() => void) | null = null
let checkoutScope: AbortController | null = null
watch(
  () => workspaceStore.workspaceTransitionGeneration,
  () => {
    checkoutScope?.abort()
    stopPayRetryOnCardReturn()
  },
  { flush: 'sync' }
)
onUnmounted(() => {
  unmounted = true
  checkoutScope?.abort()
  stopPayRetryOnCardReturn()
})

function watchCheckoutCompletion() {
  usePendingTopup().startPendingTopup()
  step.value = 'checkoutOpened'
  watchForTopupBalanceUpdate({
    onBalanceIncreased: async () => {
      if (!unmounted) handleClose(false)
    },
    source: {
      current: () => balance.value?.amountMicros ?? null,
      fetch: async () => {
        const [balanceRead, statusRead] = await Promise.allSettled([
          fetchBalance(),
          fetchStatus()
        ])
        if (balanceRead.status === 'rejected') throw balanceRead.reason
        if (statusRead.status === 'rejected') throw statusRead.reason
        return balance.value?.amountMicros ?? null
      }
    }
  })
}

function stopPayRetryOnCardReturn() {
  stopDefaultCardReturnRefresh?.()
  stopDefaultCardReturnRefresh = null
}

function armPayRetryAfterNextDeparture() {
  stopPayRetryOnCardReturn()
  const arm = () => {
    stopPayRetryOnCardReturn()
    armPayRetryOnCardReturn()
  }
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') arm()
  }
  window.addEventListener('blur', arm)
  document.addEventListener('visibilitychange', onVisibility)
  stopDefaultCardReturnRefresh = () => {
    window.removeEventListener('blur', arm)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}

function armPayRetryOnCardReturn() {
  stopPayRetryOnCardReturn()
  const launchedGeneration = workspaceStore.workspaceTransitionGeneration
  stopDefaultCardReturnRefresh = registerRefreshOnReturn(async () => {
    const stop = stopDefaultCardReturnRefresh
    stopDefaultCardReturnRefresh = null
    stop?.()
    if (step.value !== 'confirm') return
    if (workspaceStore.workspaceTransitionGeneration !== launchedGeneration) {
      return
    }
    const attempt = purchaseAttempt
    await handleBuy()
    if (unmounted) return
    if (workspaceStore.workspaceTransitionGeneration !== launchedGeneration) {
      return
    }
    if (checkoutRecovery.value === 'refused') {
      armPayRetryAfterNextDeparture()
      return
    }
    if (purchaseAttempt === attempt) armPayRetryOnCardReturn()
  })
}

async function setDefaultCard() {
  if (paymentLocked.value) return
  const portalTab = reserveBillingTab()
  openingDefaultCardPortal.value = true
  try {
    const { url } = await workspaceApi.getPaymentPortalUrl(
      window.location.href,
      'payment_method_update'
    )
    if (unmounted) {
      portalTab?.close()
      return
    }
    if (!url) return reportDefaultCardPortalFailure(portalTab)
    if (!portalTab) {
      blockedDefaultCardUrl.value = url
      step.value = 'defaultCardBlocked'
      return
    }
    portalTab.navigate(url)
    armPayRetryOnCardReturn()
  } catch {
    reportDefaultCardPortalFailure(portalTab)
  } finally {
    openingDefaultCardPortal.value = false
  }
}

function followBlockedDefaultCardLink() {
  step.value = 'confirm'
  armPayRetryOnCardReturn()
}

function reportDefaultCardPortalFailure(portalTab: BillingTab | null) {
  portalTab?.close()
  if (unmounted) return
  toast.error(t('credits.topUp.setDefaultCardError'), {
    description: t('credits.topUp.unknownError')
  })
}

async function continueToCheckout() {
  if (!(canTopUp.value && isValidAmount.value && !paymentLocked.value)) {
    return
  }
  if ((await openCheckoutInReservedTab()) === 'failed') {
    checkoutRecovery.value = 'failed'
  }
}

async function retryBlockedCheckout() {
  if (!canTopUp.value || loading.value) return
  const returnStep = stepBeforeCheckoutBlocked.value
  if ((await openCheckoutInReservedTab()) !== 'failed') return
  step.value = returnStep
  if (returnStep === 'checkoutOpened') checkoutReopenFailed.value = true
  else checkoutRecovery.value = 'failed'
}

async function reopenCheckout() {
  if (!canTopUp.value || loading.value) return
  checkoutReopenFailed.value = false
  checkoutReopenFailed.value = (await openCheckoutInReservedTab()) === 'failed'
}

async function openCheckoutInReservedTab(): Promise<
  'opened' | 'blocked' | 'failed' | 'abandoned'
> {
  const returnUrl = topupCheckoutReturnUrl()
  if (!returnUrl) return 'failed'
  const checkoutTab = reserveBillingTab()
  if (!checkoutTab) {
    if (step.value === 'confirm' || step.value === 'checkoutOpened') {
      stepBeforeCheckoutBlocked.value = step.value
    }
    step.value = 'checkoutBlocked'
    return 'blocked'
  }
  const scope = new AbortController()
  checkoutScope = scope
  loading.value = true
  try {
    if (!balance.value) await Promise.allSettled([fetchBalance()])
    const checkoutUrl = await createHostedCheckout(
      payAmount.value * 100,
      returnUrl,
      scope.signal
    )
    if (unmounted || scope.signal.aborted) {
      checkoutTab.close()
      return 'abandoned'
    }
    checkoutTab.navigate(checkoutUrl)
    watchCheckoutCompletion()
    return 'opened'
  } catch (error) {
    checkoutTab.close()
    console.error('Hosted top-up checkout failed to open', error)
    return unmounted || scope.signal.aborted ? 'abandoned' : 'failed'
  } finally {
    if (checkoutScope === scope) checkoutScope = null
    loading.value = false
  }
}

/**
 * The terminal a response's status implies. A synchronous `failed` is a
 * declined charge, not a pre-attempt rejection; a `pending` one is the
 * poller's to report once it settles.
 */
const RESPONSE_TERMINALS: Record<
  CreateTopupResponse['status'],
  BillingOperationTerminal | undefined
> = {
  completed: { stage: 'succeeded', outcome: 'success' },
  failed: {
    stage: 'failed',
    outcome: 'failure',
    failure_category: 'provider_decline'
  },
  pending: undefined
}

function reportResponseTerminal(
  response: CreateTopupResponse,
  attemptStartedAt: number
) {
  const terminal =
    response instanceof UncreditedTopupResponse
      ? response.terminal
      : RESPONSE_TERMINALS[response.status]
  if (terminal) {
    reportTerminal(attemptStartedAt, terminal, response.billing_op_id)
  }
}

function reportTerminal(
  attemptStartedAt: number,
  terminal: BillingOperationTerminal,
  billingOpId?: string
) {
  const attempt = {
    ...(billingOpId ? { billing_op_id: billingOpId } : {}),
    duration_ms: Date.now() - attemptStartedAt
  }
  // No timeout stage on the top-up funnel; the poller reports it as failed too.
  telemetry?.trackBillingEvent(
    terminal.stage === 'succeeded'
      ? {
          operation: 'topup',
          stage: 'succeeded',
          outcome: 'success',
          payment_intent_source: source,
          ...attempt
        }
      : {
          operation: 'topup',
          stage: 'failed',
          outcome: 'failure',
          payment_intent_source: source,
          failure_category: terminal.failure_category,
          ...attempt
        }
  )
  telemetry?.trackBillingEvent({
    operation: 'operation',
    operation_type: 'topup',
    billing_client: billingClient,
    ...terminal,
    ...attempt
  })
}

function purchaseErrorDetail(error?: unknown): string {
  const code = error instanceof WorkspaceApiError ? error.code : undefined
  // Only one billing operation is open at a time, so this refusal means the
  // previous purchase has not settled or expired yet — not that anything failed.
  if (code === 'SUBSCRIPTION_CHANGE_IN_PROGRESS') {
    return t('credits.topUp.changeInProgressError')
  }
  return t('credits.topUp.purchaseErrorDetail', {
    error: getErrorMessage(error) ?? t('credits.topUp.unknownError')
  })
}
</script>

<template>
  <div
    class="flex min-h-[500px] w-[min(512px,95vw)] flex-col rounded-2xl border border-border-default bg-base-background shadow-[1px_1px_8px_0_rgba(0,0,0,0.4)]"
  >
    <!-- Header -->
    <div class="flex items-center justify-between p-8">
      <div class="flex items-center gap-2">
        <button
          v-if="step === 'confirm' || step === 'declined'"
          class="cursor-pointer rounded-sm border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-base-foreground"
          :aria-label="$t('g.back')"
          @click="handleBack"
        >
          <i class="icon-[lucide--arrow-left] size-5" />
        </button>
        <h2
          v-if="step === 'amount' || step === 'confirm'"
          class="m-0 text-lg font-bold text-base-foreground"
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

    <!-- Confirm step -->
    <template v-if="step === 'confirm'">
      <p class="m-0 px-8 text-sm text-muted-foreground">
        {{ $t('credits.topUp.confirmSubtitle') }}
      </p>
      <div class="flex flex-col gap-3 px-8 pt-6">
        <span
          class="flex items-center gap-2 py-2 text-2xl font-semibold text-base-foreground tabular-nums"
        >
          <i class="icon-[lucide--component] size-5 text-gold-500" />
          {{ formatNumber(creditsModel) }}
        </span>
        <div
          v-if="savedMethods?.length === 1"
          class="flex h-10 items-center gap-3 rounded-lg bg-secondary-background px-4"
        >
          <i class="icon-[lucide--credit-card] size-4 text-muted-foreground" />
          <span class="text-sm text-base-foreground">
            {{ savedMethod?.brand }}
          </span>
          <span class="text-sm text-muted-foreground tabular-nums">
            ·· {{ savedMethod?.last4 }}
          </span>
          <Button
            variant="link"
            size="lg"
            class="ml-auto h-auto p-0 text-sm"
            @click="handleChangePaymentMethod"
          >
            {{ $t('credits.topUp.changePaymentMethod') }}
          </Button>
        </div>
        <SingleSelect
          v-else
          v-model="selectedMethodId"
          :options="methodOptions"
          size="lg"
        >
          <template #icon>
            <i
              :class="
                cn(
                  'size-4 shrink-0 text-muted-foreground',
                  savedMethod?.type === 'alipay' && 'icon-[lucide--wallet]',
                  savedMethod?.type === 'bank' && 'icon-[lucide--landmark]',
                  (!savedMethod || savedMethod.type === 'card') &&
                    'icon-[lucide--credit-card]'
                )
              "
            />
          </template>
        </SingleSelect>
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
        <p class="m-0 text-xs text-muted-foreground">
          {{ $t('credits.topUp.chargedImmediatelyNote') }}
        </p>
      </div>
    </template>

    <!-- Success step -->
    <template v-if="step === 'success'">
      <div class="flex flex-col items-center gap-3 px-8 text-center">
        <i
          class="icon-[lucide--circle-check] size-10 text-success-background"
        />
        <h2
          class="m-0 text-center text-xl font-semibold text-base-foreground lg:text-2xl"
        >
          {{ $t('subscription.success.allSet') }}
        </h2>
        <i18n-t
          keypath="credits.topUp.viewChargeNote"
          tag="p"
          class="m-0 text-sm text-balance text-muted-foreground"
        >
          <template #billing>
            <button
              class="cursor-pointer border-none bg-transparent p-0 font-inter text-sm text-base-foreground underline-offset-2 hover:underline"
              @click="handleViewBilling"
            >
              {{ $t('subscription.billingAndInvoices') }}
            </button>
          </template>
        </i18n-t>
      </div>
      <div class="flex flex-col gap-2 px-8 pt-6">
        <div class="flex flex-col gap-2 rounded-lg bg-secondary-background p-4">
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">
              {{ $t('credits.topUp.previousBalance') }}
            </span>
            <span class="font-semibold text-base-foreground tabular-nums">
              {{ formatNumber(successSummary?.previous ?? 0) }}
            </span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">
              {{ $t('credits.topUp.addedLabel') }}
            </span>
            <span class="font-semibold text-base-foreground tabular-nums">
              +{{ formatNumber(successSummary?.added ?? 0) }}
            </span>
          </div>
          <div
            class="flex items-center justify-between border-t border-border-default pt-2 text-sm"
          >
            <span class="font-semibold text-base-foreground">
              {{ $t('credits.topUp.newBalance') }}
            </span>
            <span
              class="flex items-center gap-1 text-base font-semibold text-base-foreground tabular-nums"
            >
              <i class="icon-[lucide--component] size-4 text-gold-500" />
              {{
                formatNumber(
                  (successSummary?.previous ?? 0) + (successSummary?.added ?? 0)
                )
              }}
            </span>
          </div>
        </div>
      </div>
    </template>

    <!-- Declined step -->
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
        <p class="m-0 text-sm text-muted-foreground">
          {{ $t('credits.topUp.declinedDescription') }}
        </p>
      </div>
      <div v-if="declineReason" class="flex flex-col gap-1 px-8 pt-6">
        <div class="flex flex-col gap-1 rounded-lg bg-secondary-background p-4">
          <span class="text-xs text-muted-foreground">
            {{ $t('credits.topUp.stripeReasoning') }}
          </span>
          <span class="text-sm text-base-foreground">
            {{ declineReason }}
          </span>
        </div>
      </div>
    </template>

    <!-- Verifying step: pending 3DS challenge on a charge already in flight -->
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
          {{ $t('credits.topUp.verifyBody') }}
        </p>
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
            <i class="icon-[lucide--component] size-4 shrink-0 text-gold-500" />
          </template>
        </FormattedNumberStepper>
      </div>
    </div>

    <!-- Warnings -->

    <p
      v-if="isBelowMin && step === 'amount'"
      class="m-0 flex items-center justify-center gap-1 px-8 pt-4 text-center text-sm text-red-500"
    >
      <i class="icon-[lucide--component] size-4" />
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
      <i class="icon-[lucide--component] size-4" />
      {{
        $t('credits.topUp.maxAllowed', {
          credits: formatNumber(usdToCredits(MAX_AMOUNT))
        })
      }}
      <span>{{ $t('credits.topUp.needMore') }}</span>
      <a
        href="https://www.comfy.org/cloud/enterprise"
        target="_blank"
        class="ml-1 text-inherit"
        >{{ $t('credits.topUp.contactUs') }}</a
      >
    </p>

    <div class="mt-auto flex flex-col gap-8 p-8">
      <Button
        v-if="step === 'success'"
        variant="secondary"
        size="lg"
        class="h-10 justify-center"
        @click="handleSuccessClose"
      >
        {{ $t('g.close') }}
      </Button>
      <Button
        v-else-if="step === 'declined'"
        variant="secondary"
        size="lg"
        class="h-10 justify-center"
        @click="handleChangePaymentMethod"
      >
        {{ $t('credits.topUp.updatePaymentMethod') }}
      </Button>
      <Button
        v-else-if="step === 'verifying'"
        variant="primary"
        size="lg"
        class="h-10 justify-center"
        @click="openTopupVerification"
      >
        {{ $t('subscription.preview.completeVerification') }}
      </Button>
      <div v-else class="flex flex-col gap-2">
        <Button
          v-if="topupActionUrl && permissions.canTopUp"
          variant="primary"
          size="lg"
          class="h-10 justify-center"
          @click="openTopupVerification"
        >
          {{ $t('subscription.preview.completeVerification') }}
        </Button>
        <Button
          :disabled="!isValidAmount || loading || isPolling"
          :loading="loading || isPolling"
          :variant="topupActionUrl ? 'tertiary' : 'primary'"
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { creditsToUsd, usdToCredits } from '@/base/credits/comfyCredits'
import Button from '@/components/ui/button/Button.vue'
import SingleSelect from '@/components/ui/single-select/SingleSelect.vue'
import FormattedNumberStepper from '@/components/ui/stepper/FormattedNumberStepper.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useBillingRouting } from '@/composables/billing/useBillingRouting'
import { useTelemetry } from '@/platform/telemetry'
import { clearTopupTracking } from '@/platform/telemetry/topupTracker'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'
import { useDialogStore } from '@/stores/dialogStore'
import { cn } from '@comfyorg/tailwind-utils'

// BE contract pending: the parent supplies the workspace's saved payment
// methods once the billing status/preview response carries them; the charge
// call will need the chosen method id. Null keeps the confirm step
// unreachable, matching today's behavior.
interface SavedPaymentMethod {
  id: string
  type: 'card' | 'alipay' | 'bank'
  brand?: string
  last4?: string
}

const { isInsufficientCredits = false, savedMethods = null } = defineProps<{
  isInsufficientCredits?: boolean
  savedMethods?: SavedPaymentMethod[] | null
}>()

const { t } = useI18n()
const dialogStore = useDialogStore()
const settingsDialog = useSettingsDialog()
const telemetry = useTelemetry()
const { balance, fetchBalance, fetchStatus, topup, manageSubscription } =
  useBillingContext()
const { shouldUseWorkspaceBilling } = useBillingRouting()
const { permissions } = useWorkspaceUI()

const billingOperationStore = useBillingOperationStore()
const isPolling = computed(() => billingOperationStore.isAddingCredits)
const topupActionUrl = computed(
  () => billingOperationStore.topupActionOperation?.actionUrl ?? null
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
const step = ref<'amount' | 'confirm' | 'success' | 'declined' | 'verifying'>(
  billingOperationStore.topupActionOperation?.actionUrl &&
    permissions.value.canTopUp
    ? 'verifying'
    : 'amount'
)
const successSummary = ref<{ previous: number; added: number } | null>(null)
const declineReason = ref<string | null>(null)

const selectedMethodId = ref(savedMethods?.[0]?.id ?? '')

const savedMethod = computed(
  () =>
    savedMethods?.find((m) => m.id === selectedMethodId.value) ??
    savedMethods?.[0] ??
    null
)

const methodOptions = computed(() => [
  ...(savedMethods ?? []).map((m) => ({
    name: m.type === 'card' ? `${m.brand} ·· ${m.last4}` : (m.brand ?? m.type),
    value: m.id
  })),
  { name: t('credits.topUp.addNewPaymentMethod'), value: 'add-new' }
])

watch(selectedMethodId, async (id, previous) => {
  if (id === 'add-new') {
    selectedMethodId.value = previous
    await manageSubscription()
  }
})

// Computed

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

const displayTotal = computed(
  () =>
    '$' +
    payAmount.value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
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
  showCeilingWarning.value = false
}

function handlePresetClick(amount: number) {
  showCeilingWarning.value = false
  payAmount.value = amount
  selectedPreset.value = amount
}

function handlePrimaryAction() {
  if (step.value === 'amount' && savedMethods?.length) {
    step.value = 'confirm'
    return
  }
  void handleBuy()
}

function handleBack() {
  if (step.value === 'declined') {
    declineReason.value = null
    step.value = 'confirm'
    return
  }
  step.value = 'amount'
}

async function handleChangePaymentMethod() {
  await manageSubscription()
}

function handleClose(clearTracking = true) {
  if (clearTracking) {
    clearTopupTracking()
  }
  dialogStore.closeDialog({ key: 'top-up-credits' })
}

async function handleBuy() {
  if (
    loading.value ||
    !isValidAmount.value ||
    (shouldUseWorkspaceBilling.value && !permissions.value.canTopUp)
  ) {
    return
  }

  const previousCredits = balance.value
    ? Math.round(usdToCredits(balance.value.amountMicros / 1_000_000))
    : 0

  loading.value = true
  try {
    telemetry?.trackApiCreditTopupButtonPurchaseClicked(payAmount.value)

    const amountCents = payAmount.value * 100
    const response = await topup(amountCents)
    if (!response) return

    if (response.status === 'completed') {
      telemetry?.trackBillingEvent({
        operation: 'topup',
        stage: 'succeeded',
        outcome: 'success',
        billing_op_id: response.billing_op_id
      })
      await Promise.allSettled([fetchBalance(), fetchStatus()])
      successSummary.value = {
        previous: previousCredits,
        added: creditsModel.value
      }
      step.value = 'success'
    } else if (response.status === 'pending') {
      const operation = await billingOperationStore.startOperation(
        response.billing_op_id,
        'topup'
      )
      if (operation.status === 'succeeded') {
        await Promise.allSettled([fetchBalance(), fetchStatus()])
        successSummary.value = {
          previous: previousCredits,
          added: creditsModel.value
        }
        step.value = 'success'
      } else if (operation.status === 'failed') {
        declineReason.value = operation.errorMessage
        step.value = 'declined'
      }
    } else {
      telemetry?.trackBillingEvent({
        operation: 'topup',
        stage: 'failed',
        outcome: 'failure',
        billing_op_id: response.billing_op_id,
        failure_category: 'unknown'
      })
      // BE contract pending: decline reason for the "Stripe reasoning" tile.
      declineReason.value = null
      step.value = 'declined'
    }
  } catch (error) {
    console.error('Purchase failed:', error)

    const errorMessage =
      error instanceof Error ? error.message : t('credits.topUp.unknownError')
    telemetry?.trackBillingEvent({
      operation: 'topup',
      stage: 'failed',
      outcome: 'failure',
      failure_category: 'unknown'
    })
    declineReason.value = errorMessage
    step.value = 'declined'
  } finally {
    loading.value = false
  }
}

function openTopupVerification() {
  if (!topupActionUrl.value) return
  window.open(topupActionUrl.value, '_blank', 'noopener,noreferrer')
}

function handleSuccessClose() {
  handleClose(false)
}

function handleViewBilling() {
  handleClose(false)
  settingsDialog.show('workspace')
}
</script>

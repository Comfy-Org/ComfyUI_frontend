<template>
  <Card class="flex min-h-[500px] w-[min(512px,95vw)] flex-col shadow-md">
    <div class="flex items-center justify-between p-8">
      <DialogTitle v-if="isAmountStep" class="m-0 font-bold">
        {{
          isInsufficientCredits
            ? $t('credits.topUp.addMoreCreditsToRun')
            : $t('credits.topUp.addMoreCredits')
        }}
      </DialogTitle>
      <button
        class="ml-auto cursor-pointer rounded-sm border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        :aria-label="$t('g.close')"
        @click="closeDialog"
      >
        <i class="icon-[lucide--x] size-6" />
      </button>
    </div>
    <p
      v-if="isInsufficientCredits && isAmountStep"
      class="m-0 px-8 text-sm text-muted-foreground"
    >
      {{ $t('credits.topUp.insufficientWorkflowMessage') }}
    </p>

    <div
      v-if="isHandOffStep"
      class="flex flex-col items-center gap-3 px-8 text-center"
    >
      <DialogTitle class="m-0 text-center text-xl lg:text-2xl">
        {{ $t('credits.topUp.checkoutOpenedTitle') }}
      </DialogTitle>
      <p class="m-0 text-sm text-balance text-muted-foreground">
        {{ $t('credits.topUp.checkoutOpenedBody') }}
      </p>
      <p
        v-if="state.kind === 'checkoutOpened' && state.reopenFailed"
        role="alert"
        class="m-0 text-sm text-destructive"
      >
        {{ $t('credits.topUp.checkoutOpenFailed') }}
      </p>
    </div>

    <div
      v-if="state.kind === 'checkoutBlocked'"
      class="flex flex-col items-center gap-3 px-8 text-center"
    >
      <DialogTitle class="m-0 text-center text-xl lg:text-2xl">
        {{ $t('credits.topUp.checkoutBlockedTitle') }}
      </DialogTitle>
      <p class="m-0 text-sm text-balance text-muted-foreground">
        {{ $t('credits.topUp.checkoutBlockedBody') }}
      </p>
    </div>

    <template v-if="isAmountStep">
      <div class="px-8">
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
      </div>
      <div class="flex gap-2 px-8 pt-8">
        <div
          class="flex min-w-0 flex-1 flex-col gap-3"
          data-testid="top-up-pay-amount"
        >
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
            <span class="shrink-0 text-base font-semibold">$</span>
            <NumberFieldInput
              :aria-label="$t('credits.topUp.youPay')"
              class="text-lg font-medium"
            />
            <NumberFieldIncrement />
          </NumberField>
        </div>

        <div class="flex min-w-0 flex-1 flex-col gap-3">
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
            <i class="icon-[lucide--coins] size-4 shrink-0 text-credit" />
            <NumberFieldInput
              :aria-label="$t('credits.topUp.youGet')"
              class="text-lg font-medium"
            />
            <NumberFieldIncrement />
          </NumberField>
        </div>
      </div>

      <p
        v-if="negativeBalanceCredits !== null"
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
        v-if="isBelowMin"
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
        v-if="showCeilingWarning"
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
      <p
        v-if="state.kind === 'amount' && state.checkoutOpenFailed"
        role="alert"
        class="m-0 px-8 pt-4 text-sm text-destructive"
      >
        {{ $t('credits.topUp.checkoutOpenFailed') }}
      </p>
    </template>

    <div class="mt-auto flex flex-col gap-8 p-8">
      <div v-if="isHandOffStep" class="flex flex-col items-center gap-4">
        <Button
          variant="secondary"
          size="lg"
          class="w-full"
          @click="closeDialog"
        >
          {{ $t('g.close') }}
        </Button>
        <Button
          variant="link"
          size="md"
          :disabled="!canTopUp"
          :loading="state.kind === 'reopeningCheckout'"
          @click="reopenCheckout"
        >
          {{ $t('credits.topUp.reopenCheckout') }}
          <i class="icon-[lucide--external-link] size-4" />
        </Button>
      </div>
      <Button
        v-else-if="state.kind === 'checkoutBlocked'"
        as="a"
        :href="state.checkoutUrl"
        target="_blank"
        rel="noopener"
        variant="primary"
        size="lg"
        class="w-full"
        @click="followBlockedCheckoutLink"
      >
        {{ $t('credits.topUp.openCheckout') }}
        <i class="icon-[lucide--external-link] size-4" />
      </Button>
      <template v-else>
        <Button
          variant="primary"
          size="lg"
          :disabled="!canContinue"
          :loading="state.kind === 'creatingCheckout'"
          :data-dd-action-name="BILLING_ACTION_NAME.topUpPrimary"
          @click="continueToPayment"
        >
          {{ $t('credits.topUp.buyCredits') }}
          <i class="icon-[lucide--external-link] size-4" />
        </Button>
        <div class="flex items-center justify-center gap-1">
          <a
            :href="pricingUrl"
            target="_blank"
            class="flex items-center gap-1 text-sm text-muted-foreground no-underline transition-colors hover:text-foreground"
          >
            {{ $t('credits.topUp.viewPricing') }}
            <i class="icon-[lucide--external-link] size-4" />
          </a>
        </div>
      </template>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { TOPUP_AMOUNT_PRESETS_USD } from '@comfyorg/account-core/billing'
import { cn } from '@comfyorg/tailwind-utils'
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'

import {
  centsToCredits,
  creditsToUsd,
  usdToCredits
} from '@/base/credits/comfyCredits'
import Button from '@/components/ui/button/Button.vue'
import Card from '@/components/ui/card/Card.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import NumberField from '@/components/ui/number-field/NumberField.vue'
import NumberFieldDecrement from '@/components/ui/number-field/NumberFieldDecrement.vue'
import NumberFieldIncrement from '@/components/ui/number-field/NumberFieldIncrement.vue'
import NumberFieldInput from '@/components/ui/number-field/NumberFieldInput.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useExternalLink } from '@/composables/useExternalLink'
import { useTelemetry } from '@/platform/telemetry'
import { BILLING_ACTION_NAME } from '@/platform/telemetry/billingActionNames'
import type { PaymentIntentSource } from '@/platform/telemetry/types'
import type { BillingTab } from '@/platform/workspace/billing/billingTab'
import { reserveBillingTab } from '@/platform/workspace/billing/billingTab'
import { watchHostedTopupCheckout } from '@/platform/workspace/billing/openHostedBillingTab'
import type {
  TopupCheckoutDialogEvent,
  TopupCheckoutDialogState
} from '@/platform/workspace/billing/topupCheckoutDialogState'
import {
  INITIAL_TOPUP_CHECKOUT_DIALOG_STATE,
  transitionTopupCheckoutDialog
} from '@/platform/workspace/billing/topupCheckoutDialogState'
import { topupCheckoutReturnUrl } from '@/platform/workspace/billing/topupCheckoutReturnUrl'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useTopupCheckout } from '@/platform/workspace/composables/useTopupCheckout'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import {
  resolveCheckoutAssignment,
  resolveCheckoutJourney,
  resolveEntrySource
} from '@/platform/workspace/utils/checkoutJourney'
import {
  trackCheckoutJourneyPhase,
  useCheckoutJourneyExit
} from '@/platform/workspace/utils/checkoutJourneyTelemetry'
import { api } from '@/scripts/api'
import { useAuthStore } from '@/stores/authStore'
import { useDialogStore } from '@/stores/dialogStore'

const { isInsufficientCredits = false, source } = defineProps<{
  isInsufficientCredits?: boolean
  source?: PaymentIntentSource
}>()

const MIN_AMOUNT = 5
const MAX_AMOUNT = 10000
const DEFAULT_AMOUNT = 50

const dialogStore = useDialogStore()
const telemetry = useTelemetry()
const { buildDocsUrl, docsPaths } = useExternalLink()
const { balance } = useBillingContext()
const { canTopUp } = useBillingCapabilities()
const workspaceStore = useTeamWorkspaceStore()
const { createHostedCheckout } = useTopupCheckout()

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

let unmounted = false
onUnmounted(() => {
  unmounted = true
})

const state = shallowRef<TopupCheckoutDialogState>(
  INITIAL_TOPUP_CHECKOUT_DIALOG_STATE
)

function dispatch(event: TopupCheckoutDialogEvent): void {
  state.value = transitionTopupCheckoutDialog(state.value, event)
}

const isAmountStep = computed(
  () => state.value.kind === 'amount' || state.value.kind === 'creatingCheckout'
)

const isHandOffStep = computed(
  () =>
    state.value.kind === 'checkoutOpened' ||
    state.value.kind === 'reopeningCheckout'
)

function wholeDollarsOrNull(cents: number | null | undefined): number | null {
  if (cents == null) return null
  const dollars = cents / 100
  return Number.isInteger(dollars) ? dollars : null
}

const suggestedAmount = wholeDollarsOrNull(
  balance.value?.suggestedTopupAmountCents
)
const selectedPreset = ref<number | null>(
  suggestedAmount === null ? DEFAULT_AMOUNT : null
)
const payAmount = ref(suggestedAmount ?? DEFAULT_AMOUNT)

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

const canContinue = computed(() => canTopUp.value && isValidAmount.value)

const negativeBalanceCredits = computed(() => {
  const info = balance.value
  const cents = info?.effectiveBalanceMicros
  if (cents === undefined || cents >= 0) return null
  if (info?.effectiveBalanceAuthoritative === false) return null
  return centsToCredits(-cents)
})

const isBelowMin = computed(() => payAmount.value < MIN_AMOUNT)
const showCeilingWarning = computed(() => payAmount.value >= MAX_AMOUNT)

function formatNumber(num: number): string {
  return num.toLocaleString('en-US')
}

function getStepAmount(currentAmount: number): number {
  if (currentAmount < 100) return 5
  if (currentAmount < 1000) return 50
  return 100
}

function getCreditsStepAmount(currentCredits: number): number {
  const usdAmount = creditsToUsd(currentCredits)
  return usdToCredits(getStepAmount(usdAmount))
}

function handlePayAmountChange(value: number) {
  payAmount.value = value
  selectedPreset.value = null
}

function handlePresetClick(amount: number) {
  payAmount.value = amount
  selectedPreset.value = amount
}

function closeDialog() {
  dialogStore.closeDialog({ key: 'top-up-credits' })
}

function handOff(checkoutTab: BillingTab, checkoutUrl: string) {
  checkoutTab.navigate(checkoutUrl)
  watchHostedTopupCheckout()
}

function trackPaymentIntent() {
  telemetry?.trackApiCreditTopupButtonPurchaseClicked(payAmount.value)
  telemetry?.trackBillingEvent({
    operation: 'topup',
    stage: 'intent',
    outcome: 'pending',
    payment_intent_source: source
  })
}

async function createCheckoutInReservedTab() {
  const returnUrl = topupCheckoutReturnUrl()
  if (!returnUrl) {
    dispatch({ type: 'checkoutFailed' })
    return
  }
  const checkoutTab = reserveBillingTab()
  const outcome = await createHostedCheckout(payAmount.value * 100, returnUrl)
  if (unmounted) {
    checkoutTab?.close()
    return
  }
  if (outcome.status === 'failed') {
    checkoutTab?.close()
    console.error('Hosted top-up checkout failed to open', outcome.error)
    dispatch({ type: 'checkoutFailed' })
    return
  }
  if (checkoutTab) handOff(checkoutTab, outcome.checkoutUrl)
  dispatch({
    type: 'checkoutCreated',
    checkoutUrl: outcome.checkoutUrl,
    tabOpened: checkoutTab !== null
  })
}

async function continueToPayment() {
  if (state.value.kind !== 'amount') return
  if (!canContinue.value) return
  trackPaymentIntent()
  dispatch({ type: 'continueRequested' })
  await createCheckoutInReservedTab()
}

async function reopenCheckout() {
  if (state.value.kind !== 'checkoutOpened') return
  if (!canContinue.value) return
  dispatch({ type: 'reopenRequested' })
  await createCheckoutInReservedTab()
}

function followBlockedCheckoutLink() {
  watchHostedTopupCheckout()
  dispatch({ type: 'blockedCheckoutLinkOpened' })
}
</script>

<template>
  <AddCreditsDialog
    :ports
    :can-top-up="canTopUp && !readingActivation"
    :top-up-denial="topUpDenial ?? undefined"
    :min-topup-cents="balance?.minTopupCents"
    :max-topup-cents="balance?.maxTopupCents"
    :suggested-topup-cents="balance?.suggestedTopupAmountCents"
    :negative-balance-credits="negativeBalanceCredits"
    :pending-topup="pendingTopup"
    :plan-line="planLine"
    :auto-top-up="autoTopUpChoice.offer.value"
    :billing-url="autoTopUpChoice.billingUrl.value"
    :auto-top-up-setup-hidden="!autoTopUpChoice.platformAvailable.value"
    :opens-in="handsPopupsToSystemBrowser() ? 'browser' : 'tab'"
    :support-url="billingSupportUrl"
    :locale
    :translate
    :title-as="DialogTitle"
    @close="close"
    @set-up-auto-top-up="autoTopUpOffer.track"
    @decline-auto-top-up="autoTopUpOffer.trackDeclined"
  >
    <template v-if="isInsufficientCredits" #description>
      <p class="m-0 text-muted-foreground">
        {{ $t('credits.topUp.insufficientWorkflowMessage') }}
      </p>
    </template>
  </AddCreditsDialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AddCreditsTranslate } from '@comfyorg/account-core/billing'
import { addCreditsRefusalFor } from '@comfyorg/account-core/billing'
import type { AddCreditsPorts } from '@comfyorg/account-ui/billing'
import { AddCreditsDialog } from '@comfyorg/account-ui/billing'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'
import { useTelemetry } from '@comfyorg/telemetry'
import type { PaymentIntentSource } from '@comfyorg/telemetry/types'

import { centsToCredits } from '@/base/credits/comfyCredits'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  addCreditsPendingTopup,
  topupCheckoutFailure
} from '@/platform/billing/addCredits/addCreditsFacts'
import { readAutoTopUpActivation } from '@/platform/billing/addCredits/autoTopUpActivation'
import { billingApi } from '@/platform/billing/api/billingApi'
import { reserveBillingTab } from '@/platform/billing/billingTab'
import {
  issueLocalBillingHandoff,
  reserveBillingHandoffTab
} from '@/platform/billing/localBillingHandoff'
import { opensLocalBillingHandoff } from '@/platform/billing/localBillingWebEnabled'
import { handsPopupsToSystemBrowser } from '@/platform/distribution/desktopBrowser'
import { watchForTopupBalanceUpdate } from '@/platform/billing/composables/topupBalanceRefresh'
import { useAddCreditsAutoTopUpOffer } from '@/platform/billing/composables/useAddCreditsAutoTopUpOffer'
import { useAutoTopUpSetupOffer } from '@/platform/billing/composables/useAutoTopUpSetupOffer'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { usePendingTopup } from '@/platform/billing/composables/usePendingTopup'
import { useProcessingTopupPayment } from '@/platform/billing/composables/useProcessingTopupPayment'
import { useBillingDialogsAccess } from '@/platform/billing/subscription/composables/billingDialogsAccess'
import { useAddCreditsPlanLine } from '@/platform/billing/composables/useTopUpPlanCreditCopy'
import { useTopupOperation } from '@/platform/billing/composables/useTopupOperation'
import { topupCheckoutReturnUrl } from '@/platform/billing/topupCheckoutReturnUrl'
import {
  resolveCheckoutAssignment,
  resolveCheckoutJourney,
  resolveEntrySource
} from '@/platform/billing/utils/checkoutJourney'
import {
  trackCheckoutJourneyPhase,
  useCheckoutJourneyExit
} from '@/platform/billing/utils/checkoutJourneyTelemetry'
import { useWorkspaceIdentity } from '@/platform/workspace/ports/workspaceIdentity'
import { api } from '@/scripts/api'
import { useAuthStore } from '@/stores/authStore'
import { useDialogStore } from '@/stores/dialogStore'
import { buildSupportFormUrl } from '@/utils/supportFormUrl'

const { isInsufficientCredits = false, source } = defineProps<{
  isInsufficientCredits?: boolean
  source?: PaymentIntentSource
}>()

const BILLING_SUPPORT_URL =
  'https://comfysupport.portal.usepylon.com/forms/billing-refund-issue'

const authStore = useAuthStore()
const billingSupportUrl = computed(() =>
  buildSupportFormUrl(BILLING_SUPPORT_URL, {
    email: authStore.userEmail,
    userId: authStore.userId
  })
)

const { t, locale } = useI18n()
const translate: AddCreditsTranslate = (key, params = {}) =>
  t(`addCreditsDialog.${key}`, params)

const dialogStore = useDialogStore()
const { flags } = useFeatureFlags()
const telemetry = useTelemetry()
const workspaceIdentity = useWorkspaceIdentity()
const { balance, fetchBalance, fetchStatus } = useBillingContext()
const { canTopUp, topUpDenial } = useBillingCapabilities()
const autoTopUpOffer = useAutoTopUpSetupOffer()
const autoTopUpChoice = useAddCreditsAutoTopUpOffer()
const { payment: processingPayment } = useProcessingTopupPayment()
const { topupOperation, createHostedCheckout, quoteTopup } = useTopupOperation()
const planLine = useAddCreditsPlanLine()

const negativeBalanceCredits = computed(() => {
  const info = balance.value
  const cents = info?.effectiveBalanceMicros
  if (cents === undefined || cents >= 0) return undefined
  if (info?.effectiveBalanceAuthoritative === false) return undefined
  return centsToCredits(-cents)
})

const pendingTopup = computed(() =>
  addCreditsPendingTopup(topupOperation.value, processingPayment.value)
)

let paymentWatched = false
const readingActivation = shallowRef(false)

interface OwnedCheckout {
  readonly generation: number
  readonly activationSessionId?: string
}
let ownedCheckout: OwnedCheckout | undefined
function ownsCheckout(
  checkout: OwnedCheckout | undefined
): checkout is OwnedCheckout {
  return (
    checkout?.generation === workspaceIdentity.workspaceTransitionGeneration
  )
}

const opensHandoff = opensLocalBillingHandoff()

async function reopenForCurrentFlag(): Promise<void> {
  close()
  await nextTick()
  await useBillingDialogsAccess().showTopUpCreditsDialog({
    isInsufficientCredits,
    source
  })
}

async function createHandoffCheckout(
  amountCents: number,
  signal: AbortSignal
): ReturnType<AddCreditsPorts['createCheckout']> {
  const generation = workspaceIdentity.workspaceTransitionGeneration
  const issued = await issueLocalBillingHandoff(
    { intent: 'top-up', amountCents },
    signal
  )
  if (issued.status === 'error') {
    return {
      status: 'error',
      refusal: {
        kind: 'checkout_failed',
        ...(issued.message === undefined
          ? {}
          : { serverMessage: issued.message })
      }
    }
  }
  ownedCheckout = { generation }
  return { status: 'ok', url: issued.url }
}

const ports: AddCreditsPorts = {
  async quote(amountCents, signal) {
    const credits = await quoteTopup(amountCents, signal)
    return credits === null ? { status: 'error' } : { status: 'ok', credits }
  },
  get activatesAutoTopUp() {
    return !opensHandoff && flags.billingAutoTopUpAtCheckoutEnabled
  },
  singleUseCheckout: opensHandoff,
  async createCheckout(amountCents, signal, autoTopUp) {
    telemetry?.trackBillingEvent({
      operation: 'topup',
      stage: 'intent',
      outcome: 'pending',
      payment_intent_source: source
    })
    if (opensLocalBillingHandoff() !== opensHandoff) {
      void reopenForCurrentFlag()
      return { status: 'error', refusal: { kind: 'checkout_failed' } }
    }
    if (opensHandoff) return createHandoffCheckout(amountCents, signal)
    const returnUrl = topupCheckoutReturnUrl()
    if (!returnUrl) {
      return { status: 'error', refusal: { kind: 'checkout_failed' } }
    }
    const generation = workspaceIdentity.workspaceTransitionGeneration
    try {
      if (!balance.value) await Promise.allSettled([fetchBalance()])
      const { url, sessionId } = await createHostedCheckout(
        amountCents,
        returnUrl,
        signal,
        autoTopUp
      )
      const checkout = {
        generation,
        activationSessionId: autoTopUp && sessionId
      }
      if (!ownsCheckout(checkout)) {
        return { status: 'error', refusal: { kind: 'checkout_failed' } }
      }
      ownedCheckout = checkout
      return { status: 'ok', url }
    } catch (error) {
      return {
        status: 'error',
        refusal: addCreditsRefusalFor(topupCheckoutFailure(error))
      }
    }
  },
  reserveTab: opensHandoff ? reserveBillingHandoffTab : reserveBillingTab,
  watchPayment(landed) {
    if (!ownsCheckout(ownedCheckout)) return () => {}
    paymentWatched = true
    usePendingTopup().startPendingTopup()
    const scope = new AbortController()
    const stopOnWorkspaceChange = watch(
      () => workspaceIdentity.workspaceTransitionGeneration,
      () => scope.abort()
    )
    const stop = watchForTopupBalanceUpdate({
      onBalanceIncreased: async () => {
        const checkout = ownedCheckout
        if (!ownsCheckout(checkout)) return
        const { activationSessionId } = checkout
        if (activationSessionId === undefined) return landed()
        readingActivation.value = true
        const activation = await readAutoTopUpActivation(
          (signal) => billingApi.getTopupCheckout(activationSessionId, signal),
          scope.signal
        ).catch(() => null)
        if (activation !== null && ownsCheckout(checkout)) landed(activation)
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
    return () => {
      scope.abort()
      stopOnWorkspaceChange()
      stop()
    }
  },
  autoTopUpSetupUrl: autoTopUpOffer.setupUrl,
  ownsCheckout: () => ownsCheckout(ownedCheckout)
}

function close() {
  if (!paymentWatched && !topupOperation.value) {
    usePendingTopup().clearPendingTopup()
  }
  dialogStore.closeDialog({ key: 'top-up-credits' })
}

function enterTopupJourney(): void {
  const workspaceId = workspaceIdentity.activeWorkspaceId
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
</script>

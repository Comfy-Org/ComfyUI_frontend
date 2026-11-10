<template>
  <AddCreditsDialog
    :ports
    :can-top-up="canTopUp"
    :top-up-denial="topUpDenial ?? undefined"
    :min-topup-cents="balance?.minTopupCents"
    :max-topup-cents="balance?.maxTopupCents"
    :suggested-topup-cents="balance?.suggestedTopupAmountCents"
    :negative-balance-credits="negativeBalanceCredits"
    :pending-topup="pendingTopup"
    :plan-line="planLine"
    :auto-top-up="autoTopUpLine.offer.value"
    :billing-url="autoTopUpLine.billingUrl.value"
    :opens-in="handsPopupsToSystemBrowser() ? 'browser' : 'tab'"
    :support-url="BILLING_SUPPORT_URL"
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
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AddCreditsTranslate } from '@comfyorg/account-core/billing'
import { addCreditsRefusalFor } from '@comfyorg/account-core/billing'
import type { AddCreditsPorts } from '@comfyorg/account-ui/billing'
import { AddCreditsDialog } from '@comfyorg/account-ui/billing'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'
import { useTelemetry } from '@comfyorg/telemetry'
import type { PaymentIntentSource } from '@comfyorg/telemetry/types'

import { centsToCredits } from '@/base/credits/comfyCredits'
import {
  addCreditsPendingTopup,
  topupCheckoutFailure
} from '@/platform/billing/addCredits/addCreditsFacts'
import { reserveBillingTab } from '@/platform/billing/billingTab'
import { handsPopupsToSystemBrowser } from '@/platform/distribution/desktopBrowser'
import { watchForTopupBalanceUpdate } from '@/platform/billing/composables/topupBalanceRefresh'
import { useAddCreditsAutoTopUpLine } from '@/platform/billing/composables/useAddCreditsAutoTopUpLine'
import { useAutoTopUpSetupOffer } from '@/platform/billing/composables/useAutoTopUpSetupOffer'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { usePendingTopup } from '@/platform/billing/composables/usePendingTopup'
import { useProcessingTopupPayment } from '@/platform/billing/composables/useProcessingTopupPayment'
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

const { isInsufficientCredits = false, source } = defineProps<{
  isInsufficientCredits?: boolean
  source?: PaymentIntentSource
}>()

const BILLING_SUPPORT_URL =
  'https://comfysupport.portal.usepylon.com/forms/billing-refund-issue'

const { t, locale } = useI18n()
const translate: AddCreditsTranslate = (key, params = {}) =>
  t(`addCreditsDialog.${key}`, params)

const dialogStore = useDialogStore()
const telemetry = useTelemetry()
const workspaceIdentity = useWorkspaceIdentity()
const { balance, fetchBalance, fetchStatus } = useBillingContext()
const { canTopUp, topUpDenial } = useBillingCapabilities()
const autoTopUpOffer = useAutoTopUpSetupOffer()
const autoTopUpLine = useAddCreditsAutoTopUpLine()
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

const ports: AddCreditsPorts = {
  async quote(amountCents, signal) {
    const credits = await quoteTopup(amountCents, signal)
    return credits === null ? { status: 'error' } : { status: 'ok', credits }
  },
  async createCheckout(amountCents, signal) {
    telemetry?.trackBillingEvent({
      operation: 'topup',
      stage: 'intent',
      outcome: 'pending',
      payment_intent_source: source
    })
    const returnUrl = topupCheckoutReturnUrl()
    if (!returnUrl) {
      return { status: 'error', refusal: { kind: 'checkout_failed' } }
    }
    try {
      if (!balance.value) await Promise.allSettled([fetchBalance()])
      const url = await createHostedCheckout(amountCents, returnUrl, signal)
      return { status: 'ok', url }
    } catch (error) {
      return {
        status: 'error',
        refusal: addCreditsRefusalFor(topupCheckoutFailure(error))
      }
    }
  },
  reserveTab: reserveBillingTab,
  watchPayment(landed) {
    paymentWatched = true
    usePendingTopup().startPendingTopup()
    return watchForTopupBalanceUpdate({
      onBalanceIncreased: async () => landed(),
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
  },
  autoTopUpSetupUrl: autoTopUpOffer.setupUrl
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

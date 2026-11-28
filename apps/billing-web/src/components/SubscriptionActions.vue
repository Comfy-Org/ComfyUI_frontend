<script setup lang="ts">
/**
 * Cancel and resubscribe, offered only when the server's capabilities say so
 * and run through the shared commands. Cancel is not a checkout, so it goes
 * straight to `commands`; resubscribe can need a payment step, so it runs on
 * the checkout composable, whose continuation redirects this tab when the
 * server asks for a card.
 */
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'

import type {
  BillingCapabilities,
  SubscriptionCommandResult
} from '@comfyorg/account-core/billing'
import { useBillingClient, useCheckout } from '@comfyorg/account-ui/billing'

import { useHostedCopy } from '@/composables/useHostedCopy'
import { awaitBillingWebStripeKey } from '@/config/stripeKey'
import { useBillingEntry } from '@/entry/billingEntry'
import { createDeferredStripeChallengePort } from '@/session/stripeChallengePort'
import { createCancelFlowTelemetry } from '@/telemetry/cancelTelemetry'
import type { CancelledPlan } from '@/telemetry/cancelTelemetry'
import { createResubscribeTelemetry } from '@/telemetry/resubscribeTelemetry'

const { currentPlan } = defineProps<{
  /** The plan a cancel would end, for the cancel flow's telemetry. */
  currentPlan?: CancelledPlan
}>()

const emit = defineEmits<{
  /** The subscription changed on the server; readers over it are stale. */
  changed: []
}>()

const { t } = useI18n()
const { coded, refusal } = useHostedCopy()
const { capabilities, commands } = useBillingClient<
  'capabilities' | 'commands'
>(undefined)

const checkout = useCheckout({
  openUrl: (url) => window.location.assign(url),
  navigationMode: 'redirect',
  // Deferred: reads the key at challenge time, not this setup's snapshot.
  challengePort: createDeferredStripeChallengePort(awaitBillingWebStripeKey)
})
const { entry } = useBillingEntry()
const resubscribeAttempts = createResubscribeTelemetry()

const cancelFlow = createCancelFlowTelemetry({ plan: () => currentPlan })
onBeforeUnmount(() => cancelFlow.abandoned())

const allowed = ref<BillingCapabilities | undefined>()
const confirmingCancel = ref(false)
const cancelTrigger = ref<HTMLButtonElement | null>(null)
const confirmCancelAction = ref<HTMLButtonElement | null>(null)
const busy = ref(false)
const notice = ref<string | undefined>()
const failure = ref<string | undefined>()

function focusCancelTrigger() {
  cancelTrigger.value?.focus?.() || (cancelTrigger.value as any)?.$el?.focus?.()
}

function focusConfirmCancelAction() {
  confirmCancelAction.value?.focus?.() || (confirmCancelAction.value as any)?.$el?.focus?.()
}

async function readCapabilities(forceRefresh = false) {
  const result = await capabilities.read({ forceRefresh })
  allowed.value = result.status === 'ok' ? result.value.capabilities : undefined
}

onMounted(() => void readCapabilities())

async function settle(
  run: () => Promise<SubscriptionCommandResult>,
  done: string
) {
  busy.value = true
  notice.value = undefined
  failure.value = undefined
  // Held until the capabilities behind these buttons have been read again:
  // releasing on the command alone offers a second click against stale answers.
  try {
    const result = await run()
    if (result.status === 'error') {
      failure.value = refusal(result)
      return
    }
    if (result.value.phase !== 'succeeded') {
      failure.value = coded('outcome', result.value.phase)
      return
    }
    notice.value = done
    capabilities.invalidate()
    await readCapabilities(true)
    emit('changed')
  } finally {
    busy.value = false
  }
}

/** The trigger is replaced by these controls, so the keyboard has to follow. */
async function askToCancel() {
  confirmingCancel.value = true
  cancelFlow.intent()
  await nextTick()
  focusConfirmCancelAction()
}

async function keepPlan() {
  confirmingCancel.value = false
  cancelFlow.abandoned()
  await nextTick()
  focusCancelTrigger()
}

async function cancelSubscription() {
  confirmingCancel.value = false
  await settle(
    () => cancelFlow.confirm(() => commands.cancelSubscription()),
    t('hosted.subscription.cancelled')
  )
}

async function resubscribe() {
  await settle(
    () => resubscribeAttempts.run(entry.value, () => checkout.resubscribe()),
    t('hosted.subscription.resubscribed')
  )
}
</script>

<template>
  <section
    v-if="allowed?.can_cancel || allowed?.can_reactivate"
    class="flex flex-col gap-3"
  >
    <p v-if="notice" role="status" class="m-0 text-sm text-foreground">
      {{ notice }}
    </p>
    <p v-if="failure" role="alert" class="m-0 text-sm text-destructive">
      {{ failure }}
    </p>

    <div v-if="confirmingCancel" class="flex flex-col gap-3">
      <p class="m-0 text-sm text-muted-foreground">
        {{ t('hosted.subscription.cancelConfirm') }}
      </p>
      <div class="flex gap-2">
        <Button
          ref="confirmCancelAction"
          variant="destructive"
          :disabled="busy"
          @click="cancelSubscription"
        >
          {{ t('hosted.subscription.cancelConfirmAction') }}
        </Button>
        <Button
          variant="secondary"
          :disabled="busy"
          @click="keepPlan"
        >
          {{ t('hosted.subscription.keepPlan') }}
        </Button>
      </div>
    </div>

    <div v-else class="flex gap-2">
      <Button
        v-if="allowed?.can_cancel"
        ref="cancelTrigger"
        variant="secondary"
        :disabled="busy"
        @click="askToCancel"
      >
        {{ t('hosted.subscription.cancel') }}
      </Button>
      <Button
        v-if="allowed?.can_reactivate"
        variant="primary"
        :disabled="busy"
        @click="resubscribe"
      >
        {{ t('hosted.subscription.resubscribe') }}
      </Button>
    </div>
  </section>
</template>

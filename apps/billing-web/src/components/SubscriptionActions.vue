<script setup lang="ts">
/**
 * Cancel and resubscribe, offered only when the server's capabilities say so
 * and run through the shared commands. Cancel is not a checkout, so it goes
 * straight to `commands`; resubscribe can need a payment step, so it runs on
 * the checkout composable, whose continuation redirects this tab when the
 * server asks for a card.
 */
import { nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  BillingCapabilities,
  SubscriptionCommandResult
} from '@comfyorg/account-core/billing'
import { useBillingClient, useCheckout } from '@comfyorg/account-ui/billing'

import { useHostedCopy } from '@/composables/useHostedCopy'
import { billingWebStripeKey } from '@/config/stripeKey'
import { createStripeChallengePort } from '@/session/stripeChallengePort'

const emit = defineEmits<{
  /** The subscription changed on the server; readers over it are stale. */
  changed: []
}>()

const { t } = useI18n()
const { coded } = useHostedCopy()
const { capabilities, commands } = useBillingClient<
  'capabilities' | 'commands'
>(undefined)

const stripeKey = billingWebStripeKey()

const checkout = useCheckout({
  openUrl: (url) => window.location.assign(url),
  navigationMode: 'redirect',
  challengePort:
    stripeKey === undefined ? undefined : createStripeChallengePort(stripeKey)
})

const allowed = ref<BillingCapabilities | undefined>()
const confirmingCancel = ref(false)
const cancelTrigger = ref<HTMLButtonElement | null>(null)
const confirmCancelAction = ref<HTMLButtonElement | null>(null)
const busy = ref(false)
const notice = ref<string | undefined>()
const failure = ref<string | undefined>()

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
      failure.value = coded('failure', result.code)
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
  await nextTick()
  confirmCancelAction.value?.focus()
}

async function keepPlan() {
  confirmingCancel.value = false
  await nextTick()
  cancelTrigger.value?.focus()
}

async function cancelSubscription() {
  confirmingCancel.value = false
  await settle(
    () => commands.cancelSubscription(),
    t('hosted.subscription.cancelled')
  )
}

async function resubscribe() {
  await settle(
    () => checkout.resubscribe(),
    t('hosted.subscription.resubscribed')
  )
}
</script>

<template>
  <section
    v-if="allowed?.can_cancel || allowed?.can_reactivate"
    class="flex flex-col gap-3"
  >
    <p v-if="notice" role="status" class="m-0 text-sm text-base-foreground">
      {{ notice }}
    </p>
    <p
      v-if="failure"
      role="alert"
      class="m-0 text-sm text-destructive-background"
    >
      {{ failure }}
    </p>

    <div v-if="confirmingCancel" class="flex flex-col gap-3">
      <p class="m-0 text-sm text-muted-foreground">
        {{ t('hosted.subscription.cancelConfirm') }}
      </p>
      <div class="flex gap-2">
        <button
          ref="confirmCancelAction"
          type="button"
          :disabled="busy"
          class="h-11 cursor-pointer rounded-lg bg-destructive-background px-5 font-semibold text-base-background disabled:cursor-not-allowed disabled:opacity-40"
          @click="cancelSubscription"
        >
          {{ t('hosted.subscription.cancelConfirmAction') }}
        </button>
        <button
          type="button"
          :disabled="busy"
          class="h-11 cursor-pointer rounded-lg bg-secondary-background px-5 font-medium text-base-foreground disabled:cursor-not-allowed disabled:opacity-40"
          @click="keepPlan"
        >
          {{ t('hosted.subscription.keepPlan') }}
        </button>
      </div>
    </div>

    <div v-else class="flex gap-2">
      <button
        v-if="allowed?.can_cancel"
        ref="cancelTrigger"
        type="button"
        :disabled="busy"
        class="h-11 cursor-pointer rounded-lg bg-secondary-background px-5 font-medium text-base-foreground disabled:cursor-not-allowed disabled:opacity-40"
        @click="askToCancel"
      >
        {{ t('hosted.subscription.cancel') }}
      </button>
      <button
        v-if="allowed?.can_reactivate"
        type="button"
        :disabled="busy"
        class="h-11 cursor-pointer rounded-lg bg-base-foreground px-5 font-semibold text-base-background disabled:cursor-not-allowed disabled:opacity-40"
        @click="resubscribe"
      >
        {{ t('hosted.subscription.resubscribe') }}
      </button>
    </div>
  </section>
</template>

<template>
  <div
    class="flex w-full max-w-[400px] flex-col rounded-2xl border border-border-default bg-base-background"
  >
    <div
      class="flex h-12 items-center justify-between border-b border-border-default px-4"
    >
      <h2 class="m-0 text-sm font-normal text-base-foreground">
        {{ $t('subscription.retentionOffer.title') }}
      </h2>
      <button
        class="cursor-pointer rounded-sm border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-base-foreground focus-visible:ring-1 focus-visible:ring-border-default focus-visible:outline-none"
        :aria-label="$t('g.close')"
        :disabled="phase === 'accepting'"
        @click="close"
      >
        <i class="pi pi-times size-4" />
      </button>
    </div>

    <div class="flex flex-col gap-2 p-4">
      <p
        v-if="phase === 'offered'"
        class="m-0 text-base font-semibold text-base-foreground"
      >
        {{ $t('subscription.retentionOffer.headline', { percent }) }}
      </p>
      <p class="m-0 text-sm text-muted-foreground" role="status">
        {{ message }}
      </p>
    </div>

    <div class="flex items-center justify-end gap-4 p-4">
      <template v-if="phase === 'offered' || phase === 'accepting'">
        <Button
          variant="muted-textonly"
          :disabled="phase === 'accepting'"
          @click="onDecide('continueToCancel')"
        >
          {{ $t('subscription.retentionOffer.continueToCancel') }}
        </Button>
        <Button
          variant="primary"
          size="lg"
          :loading="phase === 'accepting'"
          @click="acceptOffer"
        >
          {{ $t('subscription.retentionOffer.accept') }}
        </Button>
      </template>
      <template v-else-if="phase === 'failed'">
        <Button variant="muted-textonly" @click="close">
          {{ $t('g.close') }}
        </Button>
        <Button variant="destructive" @click="onDecide('continueToCancel')">
          {{ $t('subscription.retentionOffer.continueToCancel') }}
        </Button>
      </template>
      <template v-else-if="phase === 'unconfirmed'">
        <Button variant="muted-textonly" @click="close">
          {{ $t('g.close') }}
        </Button>
        <Button variant="primary" @click="acceptOffer">
          {{ $t('subscription.retentionOffer.checkAgain') }}
        </Button>
      </template>
      <Button v-else variant="primary" @click="close">
        {{ $t('g.close') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatQuoteMoney } from '@comfyorg/account-ui/billing/checkout'
import type {
  RetentionFlowSubscription,
  RetentionOffer
} from '@comfyorg/ingest-types'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useRetentionOffer } from '@/platform/cloud/subscription/composables/useRetentionOffer'
import type { RetentionOfferOutcome } from '@/platform/cloud/subscription/utils/retentionOffer'
import {
  discountedAmount,
  outcomeOnClose
} from '@/platform/cloud/subscription/utils/retentionOffer'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'

const {
  offer,
  subscription,
  sessionId,
  workspaceId,
  isScopeCurrent,
  onDecide
} = defineProps<{
  offer: RetentionOffer
  subscription: RetentionFlowSubscription
  sessionId: string
  workspaceId: string
  isScopeCurrent: () => boolean
  onDecide: (outcome: RetentionOfferOutcome) => void
}>()

const { t, locale } = useI18n()
const { phase, accept } = useRetentionOffer(sessionId, workspaceId)

const percent = offer.percent_off
const months = offer.duration_in_months
const monthlyAmount = subscription.unit_amount * subscription.quantity

const statusMessageKeys = {
  accepting: 'subscription.retentionOffer.applying',
  failed: 'subscription.retentionOffer.failed',
  unconfirmed: 'subscription.retentionOffer.unconfirmed'
} as const

const offerMessage = computed(() =>
  t(
    'subscription.retentionOffer.body',
    {
      regular: formatQuoteMoney(
        monthlyAmount,
        subscription.currency,
        locale.value
      ),
      discounted: formatQuoteMoney(
        discountedAmount(monthlyAmount, offer),
        subscription.currency,
        locale.value
      ),
      months,
      date: new Date(subscription.period_end * 1000).toLocaleDateString(
        locale.value,
        { month: 'long', day: 'numeric', year: 'numeric' }
      )
    },
    months
  )
)

const message = computed(() => {
  const current = phase.value
  if (current === 'offered') return offerMessage.value
  if (current === 'applied')
    return t('subscription.retentionOffer.applied', { percent, months }, months)
  return t(statusMessageKeys[current])
})

onMounted(() => {
  workspaceApi
    .recordRetentionFlowEvent({ session_id: sessionId, event: 'offer_shown' })
    .catch((error: unknown) =>
      reportError(error, {
        surface: 'billing',
        errorType: 'retention_offer_exposure_not_recorded'
      })
    )
})

function close() {
  onDecide(outcomeOnClose(phase.value))
}

async function acceptOffer() {
  if (!isScopeCurrent()) {
    useToastStore().add({
      severity: 'warn',
      summary: t('subscription.cancelDialog.workspaceChanged')
    })
    close()
    return
  }
  await accept()
}
</script>

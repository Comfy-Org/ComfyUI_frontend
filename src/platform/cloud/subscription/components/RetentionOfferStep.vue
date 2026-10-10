<template>
  <CancellationStepLayout
    :title="heading.title"
    :subtitle="heading.subtitle"
    :close-disabled="phase === 'accepting'"
    :on-close="close"
  >
    <template v-if="phase === 'applied'" #title-icon>
      <i
        class="icon-[lucide--circle-check-big] size-6 text-success-background"
        aria-hidden="true"
      />
    </template>

    <div
      v-if="phase === 'offered' || phase === 'accepting'"
      class="flex flex-col gap-3"
    >
      <div
        class="flex flex-col gap-3 rounded-[14px] border border-border-subtle bg-secondary-background/50 px-4 py-5 shadow-xs"
      >
        <div class="flex items-center justify-between gap-2">
          <p class="m-0 text-sm font-medium text-base-foreground">
            {{
              $t('subscription.retentionOffer.stayOnPlan', { plan: planName })
            }}
          </p>
          <Badge
            variant="compact"
            class="bg-base-foreground text-base-background"
          >
            {{ $t('subscription.retentionOffer.percentOff', { percent }) }}
          </Badge>
        </div>
        <p class="m-0 flex flex-wrap items-baseline gap-1.5">
          <span
            class="text-[32px] leading-[1.15] font-semibold text-base-foreground"
          >
            {{ discountedPrice }}
          </span>
          <span class="text-sm text-muted-foreground">
            {{ $t('subscription.retentionOffer.perMonth') }}
          </span>
          <span class="text-sm text-muted-foreground line-through">
            {{ regularPrice }}
          </span>
        </p>
        <p class="m-0 text-sm text-muted-foreground">
          {{
            $t(
              'subscription.retentionOffer.term',
              { regular: regularPrice, months },
              months
            )
          }}
        </p>
        <div class="h-px bg-border-subtle" role="presentation" />
        <p class="m-0 text-sm text-muted-foreground">{{ keepMessage }}</p>
      </div>
      <p class="m-0 text-sm text-muted-foreground">
        {{
          $t(
            'subscription.retentionOffer.finePrint',
            { plan: planName, regular: regularPrice, months },
            months
          )
        }}
      </p>
    </div>

    <div v-else-if="phase === 'applied'" class="flex flex-col gap-5">
      <div
        class="flex flex-col gap-3 rounded-[14px] border border-border-subtle bg-secondary-background/50 p-4 shadow-xs"
      >
        <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span class="flex items-center gap-2 text-base-foreground">
            {{
              $t('subscription.retentionOffer.nextPayments', { months }, months)
            }}
            <Badge
              variant="compact"
              class="bg-base-foreground text-base-background"
            >
              {{ $t('subscription.retentionOffer.appliedBadge') }}
            </Badge>
          </span>
          <span class="flex items-center gap-2">
            <span class="text-muted-foreground line-through">
              {{ regularAmount }}
            </span>
            <span class="text-base-foreground">
              {{
                $t('subscription.retentionOffer.pricePerMonth', {
                  price: discountedMonthlyAmount
                })
              }}
            </span>
          </span>
        </div>
        <p class="m-0 text-sm text-muted-foreground">
          {{
            $t(
              'subscription.retentionOffer.savings',
              { savings, months },
              months
            )
          }}
        </p>
      </div>
      <p class="m-0 text-sm text-muted-foreground">
        {{
          $t('subscription.retentionOffer.renewsAt', {
            regular: regularAmount,
            date: fullPriceDate
          })
        }}
      </p>
    </div>

    <p
      v-else-if="phase === 'failed' || phase === 'declined'"
      class="m-0 text-xs/5 text-muted-foreground"
    >
      {{ $t('subscription.retentionOffer.supportCode') }}
    </p>

    <template #actions>
      <template v-if="phase === 'offered' || phase === 'accepting'">
        <Button
          variant="inverted"
          size="lg"
          :loading="phase === 'accepting'"
          @click="acceptOffer"
        >
          {{
            $t('subscription.retentionOffer.accept', {
              plan: planName,
              percent
            })
          }}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          :disabled="phase === 'accepting'"
          @click="onDecide('continueToCancel')"
        >
          {{ $t('subscription.cancelFlow.continueCancelling') }}
        </Button>
      </template>
      <template v-else-if="phase === 'failed'">
        <Button variant="inverted" size="lg" @click="acceptOffer">
          {{ $t('subscription.retentionOffer.tryAgain') }}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          @click="onDecide('continueToCancel')"
        >
          {{ $t('subscription.cancelFlow.continueCancelling') }}
        </Button>
      </template>
      <template v-else-if="phase === 'declined' || phase === 'expired'">
        <Button variant="textonly" size="lg" @click="close">
          {{ $t('subscription.cancelFlow.keepPlan') }}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          @click="onDecide('continueToCancel')"
        >
          {{ $t('subscription.cancelFlow.continueCancelling') }}
        </Button>
      </template>
      <template v-else-if="phase === 'unconfirmed'">
        <Button variant="inverted" size="lg" @click="acceptOffer">
          {{ $t('subscription.retentionOffer.checkAgain') }}
        </Button>
        <Button variant="secondary" size="lg" @click="close">
          {{ $t('g.close') }}
        </Button>
      </template>
      <Button v-else variant="secondary" size="lg" class="w-24" @click="close">
        {{ $t('subscription.cancelFlow.done') }}
      </Button>
    </template>
  </CancellationStepLayout>
</template>

<script setup lang="ts">
import { formatQuoteMoney } from '@comfyorg/account-ui/billing/checkout'
import type {
  RetentionFlowSubscription,
  RetentionOffer
} from '@comfyorg/ingest-types'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import Badge from '@/components/ui/badge/Badge.vue'
import Button from '@/components/ui/button/Button.vue'
import { useToast } from '@/components/ui/toast/toastStore'
import CancellationStepLayout from '@/platform/cloud/subscription/components/CancellationStepLayout.vue'
import { useCancellationPlan } from '@/platform/cloud/subscription/composables/useCancellationPlan'
import { useRetentionOffer } from '@/platform/cloud/subscription/composables/useRetentionOffer'
import type {
  RetentionOfferOutcome,
  RetentionOfferPhase
} from '@/platform/cloud/subscription/utils/retentionOffer'
import {
  discountedAmount,
  fullPriceRenewal,
  outcomeOnClose
} from '@/platform/cloud/subscription/utils/retentionOffer'
import { formatCurrencyCents } from '@/utils/numberUtil'

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

const { t, n, locale } = useI18n()
const { planName, creditGrant, includesCustomLoRAs } = useCancellationPlan()
const { phase, accept, recordShown } = useRetentionOffer(sessionId, workspaceId)

const percent = offer.percent_off
const months = offer.duration_in_months
const monthlyAmount = subscription.unit_amount * subscription.quantity
const discountedMonthly = discountedAmount(monthlyAmount, offer)

function headlinePrice(cents: number) {
  return formatCurrencyCents(locale.value, cents, subscription.currency)
}

function exactAmount(cents: number) {
  return formatQuoteMoney(cents, subscription.currency, locale.value)
}

function formatDate(date: Date) {
  return date.toLocaleDateString(locale.value, {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

const regularPrice = computed(() => headlinePrice(monthlyAmount))
const discountedPrice = computed(() => headlinePrice(discountedMonthly))
const regularAmount = computed(() => exactAmount(monthlyAmount))
const discountedMonthlyAmount = computed(() => exactAmount(discountedMonthly))
const savings = computed(() =>
  exactAmount((monthlyAmount - discountedMonthly) * months)
)
const discountStartDate = computed(() =>
  formatDate(new Date(subscription.period_end * 1000))
)
const fullPriceDate = computed(() =>
  formatDate(fullPriceRenewal(subscription.period_end, months))
)

const keepMessage = computed(() => {
  const grant = creditGrant.value
  if (grant?.cycle !== 'monthly')
    return t('subscription.retentionOffer.keepEverything', {
      plan: planName.value
    })
  const named = { credits: n(grant.credits), plan: planName.value }
  return includesCustomLoRAs.value
    ? t('subscription.retentionOffer.keepCreditsAndLoRAs', named)
    : t('subscription.retentionOffer.keepCredits', named)
})

const heading = computed(() => {
  const offered = {
    title: t('subscription.retentionOffer.title'),
    subtitle: t('subscription.retentionOffer.subtitle')
  }
  const headings: Record<
    RetentionOfferPhase,
    { title: string; subtitle: string }
  > = {
    offered,
    accepting: offered,
    applied: {
      title: t('subscription.retentionOffer.appliedTitle', {
        plan: planName.value
      }),
      subtitle: t(
        'subscription.retentionOffer.appliedBody',
        { percent, months, date: discountStartDate.value },
        months
      )
    },
    failed: {
      title: t('subscription.retentionOffer.failedTitle'),
      subtitle: t('subscription.retentionOffer.failedBody', {
        plan: planName.value
      })
    },
    declined: {
      title: t('subscription.retentionOffer.failedTitle'),
      subtitle: t('subscription.retentionOffer.declinedBody', {
        plan: planName.value
      })
    },
    expired: {
      title: t('subscription.retentionOffer.expiredTitle'),
      subtitle: t('subscription.retentionOffer.expiredBody')
    },
    unconfirmed: {
      title: t('subscription.retentionOffer.unconfirmedTitle'),
      subtitle: t('subscription.retentionOffer.unconfirmedBody')
    }
  }
  return headings[phase.value]
})

onMounted(() => {
  void recordShown()
})

function close() {
  onDecide(outcomeOnClose(phase.value))
}

async function acceptOffer() {
  if (!isScopeCurrent()) {
    useToast().warning(t('subscription.cancelDialog.workspaceChanged'))
    close()
    return
  }
  await accept()
}
</script>

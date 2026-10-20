<template>
  <div v-if="banner" class="@container">
    <div
      role="status"
      class="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background p-4 @2xl:flex-row @2xl:items-center @2xl:gap-2"
      data-testid="billing-checkout-banner"
    >
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <div class="flex items-center gap-2">
          <i
            class="icon-[lucide--circle-alert] size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span class="text-sm text-foreground">{{ copy.title }}</span>
        </div>
        <p class="m-0 pl-6 text-sm text-muted-foreground">{{ copy.body }}</p>
        <p
          v-if="checkoutFailed"
          role="alert"
          class="m-0 pl-6 text-sm text-destructive"
        >
          {{ $t(`${prefix}.plan.openFailed`) }}
        </p>
      </div>
      <div class="flex shrink-0 flex-wrap items-center gap-2 pl-6 @2xl:pl-0">
        <Button variant="textonly" size="lg" @click="dismiss">
          {{ $t(`${prefix}.dismiss`) }}
        </Button>
        <Button
          v-if="banner.kind === 'failed' && canTopUp"
          :variant="emphasis"
          size="lg"
          @click="emit('addCredits')"
        >
          {{ $t('workspacePanel.billingTab.credits.addCredits') }}
        </Button>
        <template v-else-if="checkoutAction && canSubscribeSelfServe">
          <Button
            v-if="blockedCheckoutUrl"
            as="a"
            :href="blockedCheckoutUrl"
            target="_blank"
            rel="noopener"
            variant="secondary"
            size="lg"
            class="no-underline"
          >
            {{ $t(`${prefix}.plan.${checkoutAction.label}`) }}
            <i
              class="icon-[lucide--arrow-up-right] size-4"
              aria-hidden="true"
            />
          </Button>
          <Button
            v-else
            variant="secondary"
            size="lg"
            :loading="subscription.launch.value.state === 'opening'"
            @click="
              subscription.openCheckout(
                checkoutAction.plan,
                checkoutAction.opId
              )
            "
          >
            {{ $t(`${prefix}.plan.${checkoutAction.label}`) }}
            <i
              class="icon-[lucide--arrow-up-right] size-4"
              aria-hidden="true"
            />
          </Button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { BillingOpReceiptPlan } from '@comfyorg/ingest-types'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatUsdFromCents } from '@/base/credits/comfyCredits'
import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { addCreditsEmphasis } from '@/platform/workspace/components/dialogs/settings/billing/topupCheckoutBanner'
import { pickCheckoutBanner } from '@/platform/workspace/components/dialogs/settings/billing/subscriptionCheckoutBanner'
import type { CheckoutBanner } from '@/platform/workspace/components/dialogs/settings/billing/subscriptionCheckoutBanner'
import { useSubscriptionCheckoutBanner } from '@/platform/workspace/components/dialogs/settings/billing/useSubscriptionCheckoutBanner'
import { useTopupCheckoutBanner } from '@/platform/workspace/components/dialogs/settings/billing/useTopupCheckoutBanner'
import { useWorkspaceTierLabel } from '@/platform/workspace/composables/useWorkspaceTierLabel'

const { canTopUp, canSubscribeSelfServe, availableCents } = defineProps<{
  canTopUp: boolean
  canSubscribeSelfServe: boolean
  availableCents: number | null
}>()
const emit = defineEmits<{
  addCredits: []
  emphasis: ['secondary' | 'inverted']
}>()

const prefix = 'workspacePanel.billingTab.topupCheckout'

const { t, locale } = useI18n()
const { fetchStatus } = useBillingContext()
const { formatTierName } = useWorkspaceTierLabel()
const topup = useTopupCheckoutBanner()
const subscription = useSubscriptionCheckoutBanner(fetchStatus)

const banner = computed(() =>
  pickCheckoutBanner([subscription.banner.value, topup.banner.value])
)
const emphasis = computed(() => {
  const shown = banner.value
  const topupBanner =
    shown?.kind === 'failed' ||
    shown?.kind === 'processing' ||
    shown?.kind === 'creditsApplying'
      ? shown
      : null
  return addCreditsEmphasis(availableCents, topupBanner)
})
watch(emphasis, (variant) => emit('emphasis', variant), { immediate: true })

const checkoutAction = computed(() => {
  const shown = banner.value
  if (shown?.kind === 'planUnfinished') {
    return { label: 'continuePayment', plan: shown.plan, opId: shown.opId }
  }
  if (shown?.kind === 'planFailed' && shown.retryable && shown.plan) {
    return { label: 'tryAgain', plan: shown.plan, opId: shown.opId }
  }
  return null
})

const shownOpId = computed(() =>
  banner.value && 'opId' in banner.value ? banner.value.opId : null
)

const blockedCheckoutUrl = computed(() => {
  const launch = subscription.launch.value
  return launch.state === 'blocked' && launch.opId === shownOpId.value
    ? launch.url
    : null
})

const checkoutFailed = computed(() => {
  const launch = subscription.launch.value
  return launch.state === 'failed' && launch.opId === shownOpId.value
})

function dismiss() {
  if (shownOpId.value) subscription.dismiss()
  else topup.dismiss()
}

function usd(cents: number) {
  return formatUsdFromCents({
    cents,
    locale: locale.value,
    numberOptions: {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2
    }
  })
}

function failedTitle(paymentAmountCents: number | null) {
  return paymentAmountCents === null
    ? t(`${prefix}.failed.titleNoAmount`)
    : t(`${prefix}.failed.title`, { amount: usd(paymentAmountCents) })
}

function planCopy(key: string, plan: BillingOpReceiptPlan | null) {
  const name = formatTierName(plan?.tier, false)
  return name
    ? t(`${prefix}.plan.${key}`, { plan: name })
    : t(`${prefix}.plan.${key}NoPlan`)
}

function bannerCopy(shown: CheckoutBanner) {
  switch (shown.kind) {
    case 'failed':
      return {
        title: failedTitle(shown.paymentAmountCents),
        body: t(`${prefix}.failed.body`)
      }
    case 'creditsApplying':
      return {
        title: t(`${prefix}.creditsApplying.title`),
        body: t(`${prefix}.creditsApplying.body`)
      }
    case 'processing':
      return {
        title: t(`${prefix}.processing.title`),
        body: t(`${prefix}.processing.body`)
      }
    case 'planUnfinished':
      return {
        title: t(`${prefix}.plan.unfinishedTitle`),
        body: planCopy('unfinishedBody', shown.plan)
      }
    case 'planProcessing':
      return {
        title: t(`${prefix}.processing.title`),
        body: planCopy('processingBody', shown.plan)
      }
    case 'planFailed':
      return {
        title: planCopy('failedTitle', shown.plan),
        body: t(`${prefix}.plan.failedBody`)
      }
  }
}

const copy = computed(() =>
  banner.value ? bannerCopy(banner.value) : { title: '', body: '' }
)
</script>

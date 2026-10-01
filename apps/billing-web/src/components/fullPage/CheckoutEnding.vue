<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatQuoteMoney } from '@comfyorg/account-ui/billing/checkout'
import { buttonVariants } from '@comfyorg/design-system/button.variants'
import { cn } from '@comfyorg/tailwind-utils'

import type {
  EndingKind,
  EndingScreen,
  ReceiptRow
} from '@/checkout/endingScreen'
import { endingReceipt } from '@/checkout/endingScreen'
import { longDate } from '@/checkout/longDate'
import { supportLinkWithCode } from '@/checkout/payVerdict'
import type { SuccessBreakdown } from '@/checkout/successBreakdown'
import { namedPlan } from '@/checkout/summaryLedger'
import EndingCodeCard from '@/components/fullPage/EndingCodeCard.vue'
import type { EndingPlan } from '@/components/fullPage/EndingPlanCard.vue'
import EndingPlanCard from '@/components/fullPage/EndingPlanCard.vue'
import SuccessCloseFooter from '@/components/fullPage/SuccessCloseFooter.vue'
import { useHostedCopy } from '@/composables/useHostedCopy'

type Tone = 'done' | 'waiting' | 'refused'

/**
 * How each ending reads. The done family closes back to the product; the
 * waiting family ends on support, since closing changes nothing about money
 * still moving; the refused family offers the one action that can help.
 */
const ENDINGS: Readonly<
  Record<
    EndingKind,
    {
      readonly tone: Tone
      readonly primary?: 'close' | 'retry' | 'view_plans'
      readonly support: boolean
    }
  >
> = {
  success: { tone: 'done', primary: 'close', support: false },
  completed: { tone: 'done', primary: 'close', support: false },
  already_completed: { tone: 'done', primary: 'close', support: false },
  in_progress: { tone: 'waiting', support: true },
  received: { tone: 'waiting', support: true },
  unconfirmed: { tone: 'waiting', support: true },
  refused: { tone: 'refused', support: true },
  plan_unavailable: { tone: 'refused', primary: 'view_plans', support: true },
  load_failed: { tone: 'refused', primary: 'retry', support: true }
}

const ICON: Readonly<Record<Tone, string>> = {
  done: 'icon-[lucide--circle-check-big] text-success-background',
  waiting: 'icon-[lucide--clock] text-warning-background',
  refused: 'icon-[lucide--circle-alert] text-muted-foreground'
}

const {
  screen,
  workspace,
  plan,
  breakdown,
  closesItself = false
} = defineProps<{
  screen: EndingScreen
  workspace: string
  plan?: EndingPlan
  breakdown?: SuccessBreakdown
  closesItself?: boolean
}>()

const emit = defineEmits<{ close: []; retry: []; viewPlans: [] }>()

const { t, locale } = useI18n()
const { coded } = useHostedCopy()

const ending = computed(() => ENDINGS[screen.kind])
const copyKey = computed(() => `checkout.fullPage.ending.${screen.kind}`)
const bodyKey = computed(() => {
  if (screen.kind === 'refused') return `${copyKey.value}.body.${screen.copy}`
  if (screen.kind === 'load_failed')
    return `${copyKey.value}.body.${screen.cause}`
  return `${copyKey.value}.body`
})
const bodyParams = computed(() =>
  screen.kind === 'refused' && screen.copy === 'change_scheduled'
    ? {
        workspace,
        plan: namedPlan(
          { t, tierName: (tier) => coded('tier', tier) },
          screen.scheduled.plan,
          screen.scheduled.plan.duration === 'ANNUAL'
        ),
        date: longDate(screen.scheduled.effectiveAt, locale.value)
      }
    : { workspace }
)
const code = computed(() => ('code' in screen ? screen.code : undefined))
const receipt = computed(() => endingReceipt(screen))
/** A plan card stands in for the reference; without the plan's listing the code stays. */
const planCard = computed(() => (receipt.value.namesPlan ? plan : undefined))
const showsCode = computed(
  () =>
    code.value !== undefined &&
    planCard.value === undefined &&
    !receipt.value.rowsReplaceCode
)
const creditsAdded = computed(() =>
  'receipt' in screen ? screen.receipt?.creditsAdded : undefined
)

const R = 'checkout.fullPage.ending.receipt'
const credits = (count: number) =>
  new Intl.NumberFormat(locale.value).format(count)
const money = (cents: number) => formatQuoteMoney(cents, 'usd', locale.value)

/** Each row the receipt shows, as label and value; a plan row needs the plan's name. */
const receiptRows = computed(() =>
  receipt.value.rows.flatMap((row) => {
    const value = rowValue(row)
    return value === undefined
      ? []
      : [{ kind: row.kind, label: t(`${R}.${row.kind}`), value }]
  })
)

function rowValue(row: ReceiptRow): string | undefined {
  switch (row.kind) {
    case 'payment':
    case 'amount_paid':
      return money(row.cents)
    case 'adding':
      return t(`${R}.addingValue`)
    case 'added':
      return t(`${R}.creditCount`, { count: credits(row.credits) })
    case 'plan':
      return plan?.name
  }
}
const supportLink = computed(() => supportLinkWithCode(code.value))
const primary = computed(() => ending.value.primary)

function act() {
  if (primary.value === 'close') emit('close')
  else if (primary.value === 'retry') emit('retry')
  else if (primary.value === 'view_plans') emit('viewPlans')
}
</script>

<template>
  <main
    class="dark-theme fixed inset-0 flex items-center justify-center overflow-auto bg-base-background p-6 font-inter"
  >
    <section
      class="flex w-full max-w-96 flex-col items-center gap-8 text-center"
      data-testid="checkout-ending"
    >
      <div class="flex flex-col items-center gap-3">
        <i :class="cn(ICON[ending.tone], 'size-10')" aria-hidden="true" />
        <h1
          class="m-0 text-2xl font-semibold text-balance text-base-foreground sm:whitespace-nowrap"
        >
          {{ t(`${copyKey}.title`) }}
        </h1>
        <p class="m-0 text-sm/5 text-muted-foreground">
          {{ t(bodyKey, bodyParams) }}
        </p>
        <i18n-t
          v-if="screen.kind === 'in_progress'"
          keypath="checkout.fullPage.ending.in_progress.warning"
          tag="p"
          class="m-0 text-sm/5 text-muted-foreground"
        >
          <template #dontPayAgain>
            <strong class="font-bold">
              {{ t('checkout.fullPage.ending.in_progress.dontPayAgain') }}
            </strong>
          </template>
        </i18n-t>
      </div>

      <EndingPlanCard
        v-if="planCard"
        :plan="planCard"
        :credits-added
        :breakdown
      />

      <dl
        v-if="receiptRows.length > 0"
        class="m-0 flex w-full flex-col gap-2 rounded-lg bg-secondary-background p-4 text-left text-sm"
        data-testid="checkout-ending-receipt"
      >
        <div
          v-for="row in receiptRows"
          :key="row.kind"
          class="flex items-baseline justify-between gap-4"
        >
          <dt class="text-muted-foreground">{{ row.label }}</dt>
          <dd class="m-0 text-base-foreground tabular-nums">
            {{ row.value }}
          </dd>
        </div>
      </dl>

      <EndingCodeCard
        v-if="showsCode && code !== undefined"
        :label="t(`${copyKey}.codeLabel`)"
        :code
      />

      <div class="flex w-full flex-col items-center gap-4">
        <p
          v-if="ending.tone === 'waiting'"
          class="m-0 text-sm/5 text-muted-foreground"
        >
          {{ t('checkout.fullPage.ending.closeLine') }}
        </p>
        <button
          v-if="primary !== undefined"
          type="button"
          :class="
            cn(
              'h-10 w-full cursor-pointer rounded-lg px-4 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-base-background focus-visible:outline-none',
              primary === 'close'
                ? 'bg-secondary-background text-base-foreground hover:bg-secondary-background-hover'
                : 'bg-base-foreground text-base-background hover:opacity-90'
            )
          "
          @click="act"
        >
          {{ t(`checkout.fullPage.ending.actions.${primary}`) }}
        </button>
        <SuccessCloseFooter
          v-if="screen.kind === 'success'"
          :closes-itself
          @close="emit('close')"
        />
        <a
          v-if="ending.support"
          :href="supportLink"
          :class="
            cn(
              buttonVariants({ variant: 'textonly', size: 'lg' }),
              'w-full font-semibold no-underline'
            )
          "
        >
          {{ t('checkout.fullPage.outcome.contactSupport') }}
        </a>
      </div>
    </section>
  </main>
</template>

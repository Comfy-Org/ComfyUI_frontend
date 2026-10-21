<template>
  <section
    v-if="autoTopUpSetup?.state !== 'unavailable'"
    class="flex flex-col"
    data-testid="billing-auto-top-up-card"
  >
    <Skeleton v-if="state.kind === 'loading'" class="h-16 w-full" />
    <p
      v-else-if="state.kind === 'unavailable'"
      class="m-0 flex items-center gap-1 rounded-lg border border-border p-4 text-sm text-muted-foreground"
      role="alert"
    >
      {{ $t('workspacePanel.billingTab.autoTopUp.unavailable') }}
      <Button variant="link" size="sm" @click="retry">
        {{ $t('workspacePanel.billingTab.tryAgain') }}
      </Button>
    </p>
    <div
      v-else-if="view"
      :class="
        cn(
          'flex items-start justify-between gap-4 rounded-lg border p-4',
          view.status.border
        )
      "
    >
      <div class="flex min-w-0 flex-col gap-1">
        <h3
          class="m-0 flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          {{ $t('workspacePanel.billingTab.autoTopUp.title') }}
          <span
            :class="
              cn(
                'flex items-center gap-1 text-xs font-normal',
                view.status.text
              )
            "
            data-testid="billing-auto-top-up-status"
          >
            <span
              :class="cn('size-1.5 rounded-full', view.status.dot)"
              aria-hidden="true"
            />
            {{ $t(view.status.label) }}
          </span>
        </h3>
        <p
          v-for="line in view.lines"
          :key="line.text"
          class="m-0 flex items-center gap-1 text-sm text-muted-foreground"
          data-testid="billing-auto-top-up-line"
        >
          {{ line.text }}
          <Button
            v-if="line.tooltip"
            :tooltip="line.tooltip"
            :aria-label="line.tooltip"
            variant="muted-textonly"
            size="icon-sm"
          >
            <i class="icon-[lucide--info] size-4" aria-hidden="true" />
          </Button>
        </p>
      </div>
      <Button
        as="a"
        :href
        target="_blank"
        rel="noopener"
        :variant="view.status.action.variant"
        class="shrink-0"
        @click="track"
      >
        {{ $t(view.status.action.label) }}
        <i class="icon-[lucide--external-link] size-4" aria-hidden="true" />
      </Button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { AutoTopUpCardAction } from '@comfyorg/account-core/billing'
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatCredits, formatUsdFromCents } from '@/base/credits/comfyCredits'
import Button from '@/components/ui/button/Button.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import type { AutoReloadSettings } from '@/platform/workspace/api/workspaceApi'
import { formatPlanDate } from '@/platform/workspace/components/dialogs/settings/billing/planRow'
import { useBillingAutoTopUpCard } from '@/platform/workspace/components/dialogs/settings/billing/useBillingAutoTopUpCard'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { usePlatformHandoff } from '@/platform/workspace/composables/usePlatformHandoff'

type Status = AutoReloadSettings['status']

interface Line {
  text: string
  tooltip?: string
}

const NEUTRAL = {
  border: 'border-border',
  text: 'text-muted-foreground'
} as const

const DANGER = {
  border: 'border-destructive-background',
  text: 'text-destructive-background'
} as const

const MANAGE = {
  id: 'manage',
  label: 'workspacePanel.billingTab.autoTopUp.actions.manage',
  variant: 'secondary'
} as const

const UPDATE_PAYMENT = {
  id: 'update_payment',
  label: 'workspacePanel.billingTab.autoTopUp.actions.updatePayment',
  variant: 'inverted'
} as const

const STATUS = {
  failed: {
    ...DANGER,
    label: 'workspacePanel.billingTab.autoTopUp.status.failed',
    dot: 'bg-destructive-background',
    action: UPDATE_PAYMENT
  },
  off: {
    ...NEUTRAL,
    label: 'workspacePanel.billingTab.autoTopUp.status.off',
    dot: 'bg-muted-foreground',
    action: {
      id: 'turn_on',
      label: 'workspacePanel.billingTab.autoTopUp.actions.turnOn',
      variant: 'secondary'
    }
  },
  on_hold: {
    ...NEUTRAL,
    label: 'workspacePanel.billingTab.autoTopUp.status.onHold',
    dot: 'bg-warning-background',
    action: UPDATE_PAYMENT
  },
  paused_by_budget: {
    ...NEUTRAL,
    label: 'workspacePanel.billingTab.autoTopUp.status.paused',
    dot: 'bg-warning-background',
    action: MANAGE
  },
  on: {
    ...NEUTRAL,
    label: 'workspacePanel.billingTab.autoTopUp.status.on',
    dot: 'bg-success-background',
    action: MANAGE
  }
} as const satisfies Record<
  Status,
  {
    label: string
    dot: string
    border: string
    text: string
    action: { id: AutoTopUpCardAction; label: string; variant: string }
  }
>

const { t, locale } = useI18n()
const { autoTopUpSetup } = useBillingCapabilities()
const { state, retry } = useBillingAutoTopUpCard(
  () => autoTopUpSetup.value?.state !== 'unavailable'
)

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

function credits(value: number) {
  return formatCredits({
    value,
    locale: locale.value,
    numberOptions: { maximumFractionDigits: 0 }
  })
}

function day(isoDate: string) {
  return formatPlanDate(isoDate, locale.value, 'monthly')
}

function limitTooltip(resetsAt: string | null) {
  return resetsAt === null
    ? t('workspacePanel.billingTab.autoTopUp.limitTooltipNoDate')
    : t('workspacePanel.billingTab.autoTopUp.limitTooltip', {
        date: day(resetsAt)
      })
}

function ruleLines({
  reload_amount_cents: amountCents,
  reload_credits: reloadCredits,
  threshold_credits: thresholdCredits
}: AutoReloadSettings): Line[] {
  if (amountCents === null) return []
  if (reloadCredits === null) return []
  if (thresholdCredits === null) return []
  return [
    {
      text: t('workspacePanel.billingTab.autoTopUp.rule', {
        amount: usd(amountCents),
        credits: credits(reloadCredits),
        threshold: credits(thresholdCredits)
      })
    }
  ]
}

function limitLines(settings: AutoReloadSettings): Line[] {
  if (settings.monthly_budget_cents === null) return []
  return [
    {
      text: t('workspacePanel.billingTab.autoTopUp.limit', {
        spent: usd(settings.spent_this_cycle_cents),
        limit: usd(settings.monthly_budget_cents)
      }),
      tooltip: limitTooltip(settings.cycle_resets_at)
    }
  ]
}

function pausedLine({ cycle_resets_at: resumesAt }: AutoReloadSettings): Line {
  return {
    text:
      resumesAt === null
        ? t('workspacePanel.billingTab.autoTopUp.pausedNoDate')
        : t('workspacePanel.billingTab.autoTopUp.paused', {
            date: day(resumesAt)
          }),
    tooltip: limitTooltip(resumesAt)
  }
}

const LINES: Record<Status, (settings: AutoReloadSettings) => Line[]> = {
  failed: () => [{ text: t('workspacePanel.billingTab.autoTopUp.failed') }],
  off: () => [{ text: t('workspacePanel.billingTab.autoTopUp.off') }],
  on_hold: (settings) => [
    ...ruleLines(settings),
    { text: t('workspacePanel.billingTab.autoTopUp.onHold') }
  ],
  paused_by_budget: (settings) => [
    ...ruleLines(settings),
    pausedLine(settings)
  ],
  on: (settings) => [...ruleLines(settings), ...limitLines(settings)]
}

function isStatus(status: string): status is Status {
  return Object.hasOwn(STATUS, status)
}

const view = computed(() => {
  if (state.value.kind !== 'loaded') return null
  const { settings } = state.value
  const status = isStatus(settings.status) ? settings.status : 'off'
  return { status: STATUS[status], lines: LINES[status](settings) }
})

const { href, track } = usePlatformHandoff('/profile/billing', () => ({
  target: 'auto_top_up',
  action: view.value?.status.action.id ?? 'turn_on'
}))
</script>

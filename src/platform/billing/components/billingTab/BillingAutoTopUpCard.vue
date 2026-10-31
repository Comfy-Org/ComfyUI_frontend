<template>
  <section
    v-if="autoTopUpSetup?.state !== 'unavailable'"
    class="flex flex-col"
    data-testid="billing-auto-top-up-card"
  >
    <div
      v-if="state.kind === 'loading'"
      class="rounded-xl border border-card px-5 py-4"
    >
      <Skeleton class="h-16 w-full" />
    </div>
    <p
      v-else-if="state.kind === 'unavailable'"
      class="m-0 flex items-center gap-1 rounded-xl border border-card px-5 py-4 text-sm text-muted-foreground"
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
          'flex items-start justify-between gap-4 rounded-xl border px-5 py-4',
          view.status.border
        )
      "
    >
      <div class="flex min-w-0 flex-col gap-1">
        <h3
          class="m-0 flex items-center gap-2 text-sm font-medium text-foreground"
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
              :class="cn('size-1.75 rounded-full', view.status.dot)"
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
            <i class="icon-[lucide--info] size-3.5" aria-hidden="true" />
          </Button>
        </p>
      </div>
      <Button
        as="a"
        :href
        target="_blank"
        rel="noopener"
        :variant="view.status.action.variant"
        size="md"
        class="shrink-0"
        @click="track"
      >
        {{ $t(view.status.action.label) }}
        <i :class="view.status.action.icon" aria-hidden="true" />
      </Button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { AutoTopUpCardAction } from '@comfyorg/account-core/billing'
import { cn } from '@comfyorg/tailwind-utils'
import { computedAsync } from '@vueuse/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatCredits, formatUsdFromCents } from '@/base/credits/comfyCredits'
import Button from '@comfyorg/design-system/button/Button'
import Skeleton from '@comfyorg/design-system/skeleton/Skeleton'
import type { AutoReloadSettings } from '@comfyorg/billing-core'
import { zAutoReloadSettings } from '@comfyorg/ingest-types/zod'
import { formatPlanDate } from '@/platform/billing/components/billingTab/planRow'
import { useBillingAutoTopUpCard } from '@/platform/billing/composables/useBillingAutoTopUpCard'
import { useAutoTopUpCardViewed } from '@/platform/billing/composables/useAutoTopUpCardViewed'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { usePlatformHandoff } from '@/platform/billing/composables/usePlatformHandoff'
import { useBillingSdkStore } from '@/platform/billing/sdk/billingSdkStore'

type Status = AutoReloadSettings['status']
type ViewKey =
  | Status
  | 'turnedOff'
  | 'maximumReached'
  | 'noPaymentMethod'
  | 'noDefaultPaymentMethod'

interface Line {
  text: string
  tooltip?: string
}

const NEUTRAL = {
  border: 'border-card',
  text: 'text-muted-foreground'
} as const

const OPEN = 'icon-[lucide--arrow-up-right]'
const EXTERNAL = 'icon-[lucide--external-link]'

const DANGER = {
  border: 'border-destructive',
  text: 'text-destructive'
} as const

const MANAGE = {
  id: 'manage',
  label: 'workspacePanel.billingTab.autoTopUp.actions.manage',
  variant: 'secondary',
  icon: OPEN
} as const

const UPDATE_PAYMENT = {
  id: 'update_payment',
  label: 'workspacePanel.billingTab.autoTopUp.actions.updatePayment',
  variant: 'inverted',
  icon: EXTERNAL
} as const

const STATUS = {
  failed: {
    ...DANGER,
    label: 'workspacePanel.billingTab.autoTopUp.status.failed',
    dot: 'bg-destructive',
    action: UPDATE_PAYMENT
  },
  turnedOff: {
    ...DANGER,
    label: 'workspacePanel.billingTab.autoTopUp.status.turnedOff',
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
      variant: 'secondary',
      icon: EXTERNAL
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
    label: 'workspacePanel.billingTab.autoTopUp.status.limitReached',
    dot: 'bg-warning-background',
    action: MANAGE
  },
  maximumReached: {
    ...NEUTRAL,
    label: 'workspacePanel.billingTab.autoTopUp.status.maximumReached',
    dot: 'bg-warning-background',
    action: MANAGE
  },
  noPaymentMethod: {
    ...NEUTRAL,
    label: 'workspacePanel.billingTab.autoTopUp.status.off',
    dot: 'bg-muted-foreground',
    action: {
      ...UPDATE_PAYMENT,
      label: 'workspacePanel.billingTab.autoTopUp.actions.addPaymentMethod',
      variant: 'secondary',
      icon: OPEN
    }
  },
  noDefaultPaymentMethod: {
    ...NEUTRAL,
    label: 'workspacePanel.billingTab.autoTopUp.status.off',
    dot: 'bg-muted-foreground',
    action: { ...UPDATE_PAYMENT, variant: 'secondary', icon: OPEN }
  },
  on: {
    ...NEUTRAL,
    label: 'workspacePanel.billingTab.autoTopUp.status.on',
    dot: 'bg-success-background',
    action: MANAGE
  }
} as const satisfies Record<
  ViewKey,
  {
    label: string
    dot: string
    border: string
    text: string
    action: {
      id: AutoTopUpCardAction
      label: string
      variant: string
      icon: string
    }
  }
>

const { t, locale } = useI18n()
const { autoTopUpSetup } = useBillingCapabilities()
const { scope, state, isReady, ensureRead, retry } = useBillingAutoTopUpCard()
ensureRead()

useAutoTopUpCardViewed(() => {
  const current = state.value
  return autoTopUpSetup.value?.state !== 'unavailable' &&
    isReady.value &&
    current.kind === 'loaded'
    ? current.settings.status
    : undefined
})

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
  target_credits: targetCredits,
  threshold_credits: thresholdCredits
}: AutoReloadSettings): Line[] {
  if (targetCredits === null) return []
  if (thresholdCredits === null) return []
  return [
    {
      text: t('workspacePanel.billingTab.autoTopUp.rule', {
        target: credits(targetCredits),
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

const BUDGET_COPY = {
  paused: {
    dated: 'workspacePanel.billingTab.autoTopUp.paused',
    undated: 'workspacePanel.billingTab.autoTopUp.pausedNoDate'
  },
  pausedByRemainder: {
    dated: 'workspacePanel.billingTab.autoTopUp.pausedByRemainder',
    undated: 'workspacePanel.billingTab.autoTopUp.pausedByRemainderNoDate'
  },
  maximumReached: {
    dated: 'workspacePanel.billingTab.autoTopUp.maximumReached',
    undated: 'workspacePanel.billingTab.autoTopUp.maximumReachedNoDate'
  }
} as const

function budgetLine(
  copy: keyof typeof BUDGET_COPY,
  { cycle_resets_at: resetsAt }: AutoReloadSettings
): Line {
  const { dated, undated } = BUDGET_COPY[copy]
  return {
    text: resetsAt === null ? t(undated) : t(dated, { date: day(resetsAt) }),
    tooltip: limitTooltip(resetsAt)
  }
}

const LINES: Record<ViewKey, (settings: AutoReloadSettings) => Line[]> = {
  failed: () => [{ text: t('workspacePanel.billingTab.autoTopUp.failed') }],
  turnedOff: () => [
    { text: t('workspacePanel.billingTab.autoTopUp.turnedOff') }
  ],
  off: () => [{ text: t('workspacePanel.billingTab.autoTopUp.off') }],
  noPaymentMethod: () => [
    { text: t('workspacePanel.billingTab.autoTopUp.noPaymentMethod') }
  ],
  noDefaultPaymentMethod: () => [
    { text: t('workspacePanel.billingTab.autoTopUp.noDefaultPaymentMethod') }
  ],
  on_hold: (settings) => [
    ...ruleLines(settings),
    { text: t('workspacePanel.billingTab.autoTopUp.onHold') }
  ],
  paused_by_budget: (settings) => [
    ...ruleLines(settings),
    budgetLine(
      settings.paused_by_budget_remainder ? 'pausedByRemainder' : 'paused',
      settings
    )
  ],
  maximumReached: (settings) => [
    ...ruleLines(settings),
    budgetLine('maximumReached', settings)
  ],
  on: (settings) => [...ruleLines(settings), ...limitLines(settings)]
}

function isStatus(status: string): status is Status {
  return zAutoReloadSettings.shape.status.safeParse(status).success
}

const needsDefaultPaymentMethod = computed(
  () =>
    autoTopUpSetup.value?.state === 'frozen' &&
    autoTopUpSetup.value.reason === 'default_payment_method_missing'
)

const savedPaymentMethodsRead = computedAsync(async () => {
  const requestScope = scope.value
  if (!needsDefaultPaymentMethod.value) return null
  const result = await useBillingSdkStore().readPaymentMethods()
  return result.status === 'ok'
    ? { scope: requestScope, methods: result.value }
    : null
}, null)

const savedPaymentMethods = computed(() => {
  const read = savedPaymentMethodsRead.value
  return read?.scope === scope.value ? read.methods : null
})

function offViewKey(): ViewKey {
  if (!needsDefaultPaymentMethod.value) return 'off'
  return savedPaymentMethods.value?.length === 0
    ? 'noPaymentMethod'
    : 'noDefaultPaymentMethod'
}

function viewKey(settings: AutoReloadSettings): ViewKey {
  if (!isStatus(settings.status)) return 'off'
  if (settings.status === 'off') return offViewKey()
  if (
    settings.status === 'failed' &&
    settings.disabled_reason === 'consecutive_declines'
  ) {
    return 'turnedOff'
  }
  if (
    settings.status === 'paused_by_budget' &&
    settings.monthly_budget_is_default
  ) {
    return 'maximumReached'
  }
  return settings.status
}

const view = computed(() => {
  if (state.value.kind !== 'loaded') return null
  const { settings } = state.value
  const key = viewKey(settings)
  return { status: STATUS[key], lines: LINES[key](settings) }
})

const { href, track } = usePlatformHandoff('/profile/billing', () => ({
  target: 'auto_top_up',
  action: view.value?.status.action.id ?? 'turn_on'
}))
</script>

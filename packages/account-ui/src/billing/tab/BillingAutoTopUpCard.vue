<template>
  <section
    v-if="!isAutoTopUpNotAvailable(setup)"
    :class="cn('flex flex-col', classes?.root)"
    data-testid="billing-auto-top-up-card"
  >
    <div
      v-if="state.kind === 'loading'"
      :class="cn('rounded-xl border border-border px-5 py-4', classes?.card)"
    >
      <div class="flex flex-col gap-3">
        <Skeleton class="h-4 w-1/5" />
        <Skeleton class="h-4 w-1/2" />
      </div>
    </div>
    <p
      v-else-if="state.kind === 'unavailable'"
      :class="
        cn(
          'm-0 flex items-center gap-1 rounded-xl border border-border px-5 py-4 text-sm text-muted-foreground',
          classes?.card,
          classes?.unavailable
        )
      "
      role="alert"
    >
      {{ copy.unavailable }}
      <slot name="retry" :label="copy.tryAgain">
        <CheckoutButton variant="link" size="sm" @click="emit('retry')">
          {{ copy.tryAgain }}
        </CheckoutButton>
      </slot>
    </p>
    <div
      v-else-if="view"
      :class="
        cn(
          'flex items-center justify-between gap-4 rounded-xl border px-5 py-4',
          tone.border,
          classes?.card
        )
      "
    >
      <div class="flex min-w-0 flex-col gap-1">
        <h3
          :class="
            cn(
              'm-0 flex items-center gap-2 text-sm font-medium text-foreground',
              classes?.title
            )
          "
        >
          {{ copy.title }}
          <span
            :class="
              cn(
                'flex items-center gap-1 text-xs font-normal',
                tone.text,
                classes?.status
              )
            "
            data-testid="billing-auto-top-up-status"
          >
            <span
              :class="cn('size-1.75 rounded-full', DOT[view.key])"
              aria-hidden="true"
            />
            {{ copy.status[view.status] }}
          </span>
        </h3>
        <p
          v-for="line in view.lines"
          :key="line.text"
          :class="
            cn(
              'm-0 flex items-center gap-1 text-sm text-muted-foreground',
              classes?.line
            )
          "
          data-testid="billing-auto-top-up-line"
        >
          {{ line.text }}
          <BillingInfoTip v-if="line.tooltip" :text="line.tooltip" />
        </p>
      </div>
      <slot
        name="action"
        :action="view.action"
        :label="copy.actions[view.actionLabel]"
        :variant="actionVariant"
        :icon="OPEN"
      >
        <BillingBannerActionButton
          :href="actionHref"
          :label="copy.actions[view.actionLabel]"
          :variant="actionVariant"
          size="md"
          :class="classes?.action"
          @click="emit('action', view.action)"
        >
          <i :class="OPEN" aria-hidden="true" />
        </BillingBannerActionButton>
      </slot>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type {
  AutoTopUpCardAction,
  AutoTopUpCardState,
  AutoTopUpOffView,
  AutoTopUpOffViewFacts
} from '@comfyorg/account-core/billing'
import { isAutoTopUpNotAvailable } from '@comfyorg/account-core/billing'
import type { ButtonVariants } from '@comfyorg/design-system/button.variants'
import Skeleton from '@comfyorg/design-system/skeleton/Skeleton'
import { cn } from '@comfyorg/tailwind-utils'

import CheckoutButton from '#/billing/checkout/CheckoutButton.vue'
import BillingBannerActionButton from './BillingBannerActionButton.vue'
import BillingInfoTip from './BillingInfoTip.vue'
import { autoTopUpCardView } from './autoTopUpCardView'
import type { AutoTopUpCardCopy, AutoTopUpViewKey } from './autoTopUpCardView'

type ActionVariant = ButtonVariants['variant']

const OPEN = 'icon-[lucide--arrow-up-right]'

const NEUTRAL = { border: 'border-border', text: 'text-muted-foreground' }
const DANGER = { border: 'border-destructive', text: 'text-destructive' }

const DOT: Record<AutoTopUpViewKey, string> = {
  failed: 'bg-destructive',
  turnedOff: 'bg-destructive',
  off: 'bg-muted-foreground',
  on_hold: 'bg-warning',
  paused_by_budget: 'bg-warning',
  maximumReached: 'bg-warning-background',
  noPaymentMethod: 'bg-muted-foreground',
  noDefaultPaymentMethod: 'bg-muted-foreground',
  on: 'bg-success'
}

const DEFAULT_VARIANTS: Record<AutoTopUpViewKey, ActionVariant> = {
  failed: 'inverted',
  turnedOff: 'inverted',
  off: 'secondary',
  on_hold: 'inverted',
  paused_by_budget: 'secondary',
  maximumReached: 'secondary',
  noPaymentMethod: 'secondary',
  noDefaultPaymentMethod: 'secondary',
  on: 'secondary'
}

const {
  state,
  offView,
  setup,
  copy,
  locale,
  actionHref = null,
  variants,
  classes
} = defineProps<{
  state: AutoTopUpCardState
  offView: AutoTopUpOffView
  setup: AutoTopUpOffViewFacts['setup']
  copy: AutoTopUpCardCopy
  locale: string
  actionHref?: string | null
  variants?: Partial<Record<AutoTopUpViewKey, ActionVariant>>
  classes?: Partial<
    Record<
      'root' | 'card' | 'unavailable' | 'title' | 'status' | 'line' | 'action',
      string
    >
  >
}>()

const emit = defineEmits<{
  action: [action: AutoTopUpCardAction]
  retry: []
}>()

const view = computed(() =>
  state.kind === 'loaded'
    ? autoTopUpCardView(state.settings, offView, copy, locale)
    : null
)

const tone = computed(() =>
  view.value?.key === 'failed' || view.value?.key === 'turnedOff'
    ? DANGER
    : NEUTRAL
)

const actionVariant = computed(() =>
  view.value
    ? (variants?.[view.value.key] ?? DEFAULT_VARIANTS[view.value.key])
    : undefined
)
</script>

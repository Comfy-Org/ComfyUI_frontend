<template>
  <section
    v-if="setup?.state !== 'unavailable'"
    :class="cn('flex flex-col', classes?.root)"
    data-testid="billing-auto-top-up-card"
  >
    <div
      v-if="state.kind === 'loading'"
      :class="cn('rounded-xl border border-card px-5 py-4', classes?.card)"
    >
      <Skeleton class="h-16 w-full" />
    </div>
    <p
      v-else-if="state.kind === 'unavailable'"
      :class="
        cn(
          'm-0 flex items-center gap-1 rounded-xl border border-card px-5 py-4 text-sm text-muted-foreground',
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
          'flex items-start justify-between gap-4 rounded-xl border px-5 py-4',
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
          <TextTooltip v-if="line.tooltip" :text="line.tooltip">
            <CheckoutButton
              :aria-label="line.tooltip"
              variant="muted-textonly"
              size="icon-sm"
            >
              <i class="icon-[lucide--info] size-3.5" aria-hidden="true" />
            </CheckoutButton>
          </TextTooltip>
        </p>
      </div>
      <slot
        name="action"
        :action="view.action"
        :label="copy.actions[view.actionLabel]"
        :variant="actionVariant"
        :icon="actionIcon"
      >
        <CheckoutButton
          :variant="actionVariant"
          size="md"
          :class="cn('shrink-0', classes?.action)"
          @click="emit('action', view.action)"
        >
          {{ copy.actions[view.actionLabel] }}
          <i :class="actionIcon" aria-hidden="true" />
        </CheckoutButton>
      </slot>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * The Billing tab auto top-up card for served settings. Actions are emitted;
 * the host opens the billing site or rereads the settings.
 */
import { computed } from 'vue'

import type {
  AutoTopUpCardAction,
  AutoTopUpCardState,
  AutoTopUpOffView,
  AutoTopUpOffViewFacts
} from '@comfyorg/account-core/billing'
import type { ButtonVariants } from '@comfyorg/design-system/button.variants'
import Skeleton from '@comfyorg/design-system/skeleton/Skeleton'
import TextTooltip from '@comfyorg/design-system/tooltip/TextTooltip'
import { cn } from '@comfyorg/tailwind-utils'

import CheckoutButton from '#/billing/checkout/CheckoutButton.vue'
import { autoTopUpCardView } from './autoTopUpCardView'
import type { AutoTopUpCardCopy, AutoTopUpViewKey } from './autoTopUpCardView'

type ActionVariant = ButtonVariants['variant']

const OPEN = 'icon-[lucide--arrow-up-right]'
const EXTERNAL = 'icon-[lucide--external-link]'

const NEUTRAL = { border: 'border-card', text: 'text-muted-foreground' }
const DANGER = { border: 'border-destructive', text: 'text-destructive' }

const DOT: Record<AutoTopUpViewKey, string> = {
  failed: 'bg-destructive',
  turnedOff: 'bg-destructive-background',
  off: 'bg-muted-foreground',
  on_hold: 'bg-warning-background',
  paused_by_budget: 'bg-warning-background',
  maximumReached: 'bg-warning-background',
  noPaymentMethod: 'bg-muted-foreground',
  noDefaultPaymentMethod: 'bg-muted-foreground',
  on: 'bg-success-background'
}

const ICON: Record<AutoTopUpViewKey, string> = {
  failed: EXTERNAL,
  turnedOff: EXTERNAL,
  off: EXTERNAL,
  on_hold: EXTERNAL,
  paused_by_budget: OPEN,
  maximumReached: OPEN,
  noPaymentMethod: OPEN,
  noDefaultPaymentMethod: OPEN,
  on: OPEN
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

const { state, offView, setup, copy, locale, variants, classes } = defineProps<{
  state: AutoTopUpCardState
  offView: AutoTopUpOffView
  setup: AutoTopUpOffViewFacts['setup']
  copy: AutoTopUpCardCopy
  locale: string
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

const actionIcon = computed(() => (view.value ? ICON[view.value.key] : OPEN))
</script>

<template>
  <div
    :class="cn('@container', classes?.root)"
    :data-testid="`billing-banner-${view.kind}`"
  >
    <div
      role="status"
      :class="
        cn(
          'flex flex-col gap-3 rounded-xl border border-border bg-background',
          look.windowBreakpoint
            ? 'sm:flex-row sm:items-center sm:gap-2'
            : '@2xl:flex-row @2xl:items-center @2xl:gap-2',
          look.roomy ? 'p-4' : 'p-3',
          classes?.panel
        )
      "
    >
      <div
        :class="
          cn(
            'flex min-w-0 flex-1 flex-col',
            look.roomy ? 'gap-1' : 'gap-2',
            classes?.text
          )
        "
      >
        <div class="flex items-center gap-2">
          <i
            :class="
              cn(
                look.muted
                  ? 'icon-[lucide--circle-alert] text-muted-foreground'
                  : 'icon-[lucide--triangle-alert] text-warning',
                classes?.icon
              )
            "
            aria-hidden="true"
            data-testid="billing-banner-icon"
          />
          <span :class="cn('text-sm text-foreground', classes?.title)">
            {{ view.title }}
          </span>
        </div>
        <p :class="cn('m-0 pl-6 text-sm text-muted-foreground', classes?.body)">
          {{ view.body }}
        </p>
      </div>
      <div
        v-if="look.dismissKey !== null || look.action"
        :class="
          cn(
            'flex shrink-0 flex-wrap items-center gap-2 pl-6',
            look.windowBreakpoint ? 'sm:pl-0' : '@2xl:pl-0',
            classes?.actions
          )
        "
      >
        <slot
          v-if="look.dismissKey !== null"
          name="dismiss"
          :dismiss-key="look.dismissKey"
          :label="copy.dismiss"
        >
          <CheckoutButton
            variant="textonly"
            :size
            @click="emit('dismiss', look.dismissKey)"
          >
            {{ copy.dismiss }}
          </CheckoutButton>
        </slot>
        <slot
          v-if="look.action"
          name="action"
          :action="look.action"
          :href="look.href"
          :label="copy.actions[look.action]"
          :variant="actionVariant"
        >
          <BillingBannerActionButton
            :href="look.href"
            :label="copy.actions[look.action]"
            :variant="actionVariant"
            :size
            :loading
            @click="emit('action', look.action)"
          />
        </slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import CheckoutButton from '#/billing/checkout/CheckoutButton.vue'

import BillingBannerActionButton from './BillingBannerActionButton.vue'
import { billingBannerLook } from './billingBannerView'
import type {
  BillingBannerAction,
  BillingBannerCopy,
  BillingBannerView
} from './billingBannerView'

type ActionVariant = 'inverted' | 'secondary'

const {
  view,
  copy,
  loading = false,
  addCreditsVariant = 'secondary',
  classes
} = defineProps<{
  view: BillingBannerView
  copy: Pick<BillingBannerCopy, 'dismiss' | 'actions'>
  loading?: boolean
  addCreditsVariant?: ActionVariant
  classes?: Partial<
    Record<
      'root' | 'panel' | 'text' | 'icon' | 'title' | 'body' | 'actions',
      string
    >
  >
}>()

const emit = defineEmits<{
  action: [action: BillingBannerAction]
  dismiss: [dismissKey: string]
}>()

const look = computed(() => billingBannerLook(view))

const size = computed(() => (look.value.roomy ? 'lg' : 'md'))

const actionVariant = computed<ActionVariant>(() =>
  look.value.action === 'addCredits' ? addCreditsVariant : 'inverted'
)
</script>

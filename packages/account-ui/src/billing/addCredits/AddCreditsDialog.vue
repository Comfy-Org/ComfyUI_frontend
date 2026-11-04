<template>
  <div
    ref="root"
    :class="
      cn(
        'flex w-[min(400px,95vw)] flex-col rounded-2xl border bg-background text-sm text-foreground shadow-md',
        ui.root
      )
    "
    :style="{ marginTop: `${growth}px` }"
    data-testid="add-credits-dialog"
    :data-step="state.step"
  >
    <div :class="cn('flex items-center justify-between px-4 pt-4', ui.header)">
      <component
        :is="titleAs"
        :class="cn('m-0 text-base font-normal', ui.title)"
      >
        {{ title }}
      </component>
      <button
        type="button"
        :class="
          cn(
            buttonVariants({ variant: 'muted-textonly', size: 'icon' }),
            ui.close
          )
        "
        :aria-label="translate('close')"
        @click="emit('close')"
      >
        <i class="icon-[lucide--x]" aria-hidden="true" />
      </button>
    </div>

    <AddCreditsBlockedStep
      v-if="blockedUrl !== null"
      :checkout-url="blockedUrl"
      :translate
      :ui
      @follow="dialog.followBlockedLink"
    />
    <AddCreditsAmountStep
      v-else-if="dialog.amountView.value"
      :view="dialog.amountView.value"
      :quote="dialog.quote.value"
      :bounds
      :negative-balance-credits
      :plan-line
      :support-url
      :translate
      :format
      :ui
      @preset="dialog.pickPreset"
      @type="dialog.typeAmount"
      @continue="dialog.continueToCheckout"
    >
      <template #description><slot name="description" /></template>
      <template #notice="scope"><slot name="notice" v-bind="scope" /></template>
      <template #extra><slot name="extra" /></template>
    </AddCreditsAmountStep>
    <AddCreditsOpenedStep
      v-else-if="state.step === 'checkout_opened'"
      :amount-cents="state.amountCents"
      :credits="openedCredits"
      :refusal="state.refusal"
      :can-reopen="canTopUp && !addCreditsRefusalBlocks(state.refusal)"
      :support-url
      :translate
      :format
      :ui
      @reopen="dialog.reopenCheckout"
      @close="emit('close')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import type { Component } from 'vue'
import { useResizeObserver, useWindowSize } from '@vueuse/core'

import type {
  AddCreditsBounds,
  AddCreditsPendingTopup,
  AddCreditsPlanLine,
  AddCreditsTranslate,
  CapabilityDenialReason
} from '@comfyorg/account-core/billing'
import {
  ADD_CREDITS_FALLBACK_BOUNDS,
  addCreditsRefusalBlocks,
  addCreditsRefusalForDenial,
  initialAddCreditsAmount,
  translateAddCreditsDefault
} from '@comfyorg/account-core/billing'
import { buttonVariants } from '@comfyorg/design-system/button.variants'
import { cn } from '@comfyorg/tailwind-utils'

import AddCreditsAmountStep from './AddCreditsAmountStep.vue'
import AddCreditsBlockedStep from './AddCreditsBlockedStep.vue'
import AddCreditsOpenedStep from './AddCreditsOpenedStep.vue'
import type { AddCreditsUi } from './addCreditsPresentation'
import { addCreditsFormat } from './addCreditsPresentation'
import type { AddCreditsPorts } from './useAddCreditsDialog'
import { useAddCreditsDialog } from './useAddCreditsDialog'

const {
  ports,
  canTopUp,
  topUpDenial,
  minTopupCents,
  maxTopupCents,
  suggestedTopupCents,
  negativeBalanceCredits,
  pendingTopup,
  planLine,
  opensIn = 'tab',
  supportUrl,
  locale,
  translate = translateAddCreditsDefault,
  titleAs = 'h2',
  ui = {}
} = defineProps<{
  ports: AddCreditsPorts
  canTopUp: boolean
  topUpDenial?: CapabilityDenialReason
  minTopupCents?: number
  maxTopupCents?: number
  suggestedTopupCents?: number | null
  negativeBalanceCredits?: number
  pendingTopup?: AddCreditsPendingTopup
  planLine?: AddCreditsPlanLine
  opensIn?: 'tab' | 'browser'
  supportUrl: string
  locale: string
  translate?: AddCreditsTranslate
  titleAs?: string | Component
  ui?: AddCreditsUi
}>()

const emit = defineEmits<{ close: [] }>()

const bounds = computed<AddCreditsBounds>(() => ({
  minCents: minTopupCents ?? ADD_CREDITS_FALLBACK_BOUNDS.minCents,
  maxCents: maxTopupCents ?? ADD_CREDITS_FALLBACK_BOUNDS.maxCents
}))

const dialog = useAddCreditsDialog({
  ports,
  initialAmount: initialAddCreditsAmount(suggestedTopupCents),
  facts: () => ({
    bounds: bounds.value,
    canTopUp,
    canTopUpRefusal: addCreditsRefusalForDenial(topUpDenial),
    ...(pendingTopup === undefined ? {} : { pendingTopup })
  }),
  onLanded: () => emit('close')
})
const state = dialog.state

const format = computed(() => addCreditsFormat(locale))

const VIEWPORT_GUTTER_PX = 16
const root = useTemplateRef('root')
const defaultHeight = ref<number>()
const height = ref(0)
const { height: viewportHeight } = useWindowSize()
useResizeObserver(root, ([entry]) => {
  height.value = entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height
  defaultHeight.value ??= height.value
})
const growth = computed(() => {
  if (defaultHeight.value === undefined) return 0
  const room = viewportHeight.value - 2 * VIEWPORT_GUTTER_PX - height.value
  return Math.max(0, Math.min(height.value - defaultHeight.value, room))
})

const blockedUrl = computed(() => {
  const current = state.value
  if (current.step === 'checkout_blocked') return current.checkoutUrl
  return current.step === 'opening' && !current.tabReserved ? undefined : null
})

const title = computed(() => {
  if (state.value.step === 'checkout_opened') {
    return translate(
      opensIn === 'browser' ? 'opened.titleBrowser' : 'opened.title'
    )
  }
  return translate(blockedUrl.value === null ? 'title' : 'blocked.title')
})

const openedCredits = computed(() => {
  const quote = dialog.quote.value
  return quote?.status === 'ok' ? format.value.count(quote.credits) : '—'
})
</script>

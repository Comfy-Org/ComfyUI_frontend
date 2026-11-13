<template>
  <div
    ref="root"
    :class="
      cn(
        'flex max-h-[calc(100dvh-2rem)] min-h-0 w-[min(400px,95vw)] flex-col rounded-2xl border bg-background text-sm text-foreground shadow-md',
        ui.root
      )
    "
    :style="{ transform: `translateY(${growth / 2}px)` }"
    data-testid="add-credits-dialog"
    :data-step="state.step"
  >
    <div
      :class="
        cn('flex shrink-0 items-center justify-between px-4 pt-4', ui.header)
      "
    >
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
      :reissues="
        state.step === 'checkout_blocked' && state.checkoutUrl === undefined
      "
      :can-reissue="canTopUp"
      :translate
      :ui
      @follow="dialog.followBlockedLink"
      @reissue="dialog.reopenCheckout"
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
      <template #autoTopUp>
        <AddCreditsAutoTopUpCard
          v-if="autoTopUpOffer.kind === 'checkbox' && billingUrl"
          v-model:checked="autoTopUpFields.checked.value"
          :rules="autoTopUpOffer.rules"
          :default-card="autoTopUpOffer.defaultCard"
          :input="autoTopUpFields.input.value"
          :values="autoTopUpFields.values.value"
          :errors="autoTopUpFields.errors.value"
          :billing-url
          :locked="dialog.amountView.value?.locked ?? false"
          :translate
          :format
          :ui
          @edit="autoTopUpFields.edit"
        />
        <p
          v-else-if="autoTopUpOffer.kind === 'on'"
          :class="cn('m-0 text-muted-foreground', ui.line)"
          data-testid="add-credits-auto-top-up-is-on"
        >
          {{ translate('autoTopUp.isOn') }}
          <a
            :href="billingUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-inherit underline"
            >{{ translate('autoTopUp.manage')
            }}<i
              class="ml-0.5 icon-[lucide--arrow-up-right] size-3"
              aria-hidden="true"
          /></a>
        </p>
      </template>
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
    <AddCreditsAutoTopUpResultStep
      v-else-if="state.step === 'auto_top_up_on'"
      :settings="state.settings"
      :link-url="billingUrl"
      :translate
      :format
      :ui
      @close="emit('close')"
    />
    <AddCreditsAutoTopUpResultStep
      v-else-if="state.step === 'auto_top_up_failed'"
      :link-url="state.setupUrl"
      :translate
      :format
      :ui
      @close="emit('close')"
    />
    <AddCreditsAutoTopUpOfferStep
      v-else-if="state.step === 'auto_top_up_offer'"
      :setup-url="state.setupUrl"
      :translate
      :ui
      @set-up="setUpAutoTopUp"
      @close="declineAutoTopUp"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import type { Component } from 'vue'
import { useResizeObserver, useWindowSize } from '@vueuse/core'

import type {
  AddCreditsAutoTopUpOffer,
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
import AddCreditsAutoTopUpCard from './AddCreditsAutoTopUpCard.vue'
import AddCreditsAutoTopUpResultStep from './AddCreditsAutoTopUpResultStep.vue'
import AddCreditsAutoTopUpOfferStep from './AddCreditsAutoTopUpOfferStep.vue'
import AddCreditsBlockedStep from './AddCreditsBlockedStep.vue'
import AddCreditsOpenedStep from './AddCreditsOpenedStep.vue'
import type { AddCreditsUi } from './addCreditsPresentation'
import { addCreditsFormat } from './addCreditsPresentation'
import type { AddCreditsPorts } from './useAddCreditsDialog'
import { useAddCreditsAutoTopUp } from './useAddCreditsAutoTopUp'
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
  autoTopUp = { kind: 'hidden' },
  billingUrl,
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
  autoTopUp?: AddCreditsAutoTopUpOffer
  billingUrl?: string
  opensIn?: 'tab' | 'browser'
  supportUrl: string
  locale: string
  translate?: AddCreditsTranslate
  titleAs?: string | Component
  ui?: AddCreditsUi
}>()

const emit = defineEmits<{
  close: []
  setUpAutoTopUp: []
  declineAutoTopUp: []
}>()

function setUpAutoTopUp() {
  emit('setUpAutoTopUp')
  emit('close')
}

function declineAutoTopUp() {
  emit('declineAutoTopUp')
  emit('close')
}

const bounds = computed<AddCreditsBounds>(() => ({
  minCents: minTopupCents ?? ADD_CREDITS_FALLBACK_BOUNDS.minCents,
  maxCents: maxTopupCents ?? ADD_CREDITS_FALLBACK_BOUNDS.maxCents
}))

const autoTopUpOffer = computed<AddCreditsAutoTopUpOffer>(() => {
  if (!billingUrl) return { kind: 'hidden' }
  return autoTopUp.kind === 'checkbox' && !ports.activatesAutoTopUp
    ? { kind: 'hidden' }
    : autoTopUp
})

const autoTopUpFields = useAddCreditsAutoTopUp(
  autoTopUpOffer,
  () => dialog.pickedCents.value
)

const dialog = useAddCreditsDialog({
  ports,
  initialAmount: initialAddCreditsAmount(suggestedTopupCents),
  autoTopUp: autoTopUpFields.request,
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
  if (state.value.step === 'auto_top_up_on') {
    return translate('autoTopUpOn.title')
  }
  if (state.value.step === 'auto_top_up_failed') {
    return translate('autoTopUpFailed.title')
  }
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

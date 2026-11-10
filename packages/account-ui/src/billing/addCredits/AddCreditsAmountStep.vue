<template>
  <div :class="cn('flex flex-col gap-4 p-4', ui.body)">
    <slot name="description" />
    <RadioGroupRoot
      :model-value="selectedPreset"
      :disabled="view.locked"
      orientation="horizontal"
      :class="cn('grid grid-cols-4 gap-2', ui.presets)"
      :aria-label="translate('title')"
      @update:model-value="pickPreset"
    >
      <RadioGroupItem
        v-for="cents in ADD_CREDITS_PRESETS_CENTS"
        :key="cents"
        :value="String(cents)"
        :class="
          cn(
            buttonVariants({ variant: 'secondary', size: 'lg' }),
            'border border-solid border-transparent text-base data-[state=checked]:border-foreground',
            ui.preset
          )
        "
      >
        {{ format.dollars(cents) }}
      </RadioGroupItem>
    </RadioGroupRoot>

    <p
      v-if="negativeBalanceCredits !== undefined"
      :class="cn('m-0 text-muted-foreground', ui.line)"
      data-testid="add-credits-negative-balance"
    >
      {{
        translate('negativeBalance', {
          credits: format.count(negativeBalanceCredits)
        })
      }}
    </p>
    <p
      v-if="planLine"
      :class="cn('m-0 text-muted-foreground', ui.line)"
      data-testid="add-credits-plan-line"
    >
      {{ translate(`planLine.${planLine}`) }}
    </p>

    <AddCreditsAmountField
      :input="customInput"
      :error="amountError"
      :locked="view.locked"
      :label="translate('customAmountLabel')"
      :ui
      @type="emit('type', $event)"
    />

    <slot name="autoTopUp" />

    <slot
      name="notice"
      :notice="view.notice"
      :title="noticeCopy?.title"
      :body="noticeCopy?.body"
    >
      <AddCreditsNotice
        v-if="noticeCopy"
        :copy="noticeCopy"
        :kind="noticeKindOf(view.notice)"
        :support-url
        :support-label="translate('messageSupport')"
        :notice-class="ui.notice"
      />
    </slot>
    <slot v-if="!view.notice" name="extra" />
  </div>

  <AddCreditsAmountFooter
    :view
    :footer
    :support-url
    :translate
    :ui
    @continue="emit('continue')"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'

import type {
  AddCreditsAmountView,
  AddCreditsBounds,
  AddCreditsPlanLine,
  AddCreditsTranslate
} from '@comfyorg/account-core/billing'
import { ADD_CREDITS_PRESETS_CENTS } from '@comfyorg/account-core/billing'
import { buttonVariants } from '@comfyorg/design-system/button.variants'
import { cn } from '@comfyorg/tailwind-utils'

import AddCreditsAmountField from './AddCreditsAmountField.vue'
import AddCreditsAmountFooter from './AddCreditsAmountFooter.vue'
import AddCreditsNotice from './AddCreditsNotice.vue'
import type { AddCreditsFormat, AddCreditsUi } from './addCreditsPresentation'
import {
  amountErrorFor,
  footerCopyFor,
  noticeCopyFor,
  noticeKindOf
} from './addCreditsPresentation'
import type { AddCreditsQuote } from './useAddCreditsDialog'

const {
  view,
  quote,
  bounds,
  negativeBalanceCredits,
  planLine,
  supportUrl,
  translate,
  format,
  ui
} = defineProps<{
  view: AddCreditsAmountView
  quote: AddCreditsQuote | undefined
  bounds: AddCreditsBounds
  negativeBalanceCredits?: number
  planLine?: AddCreditsPlanLine
  supportUrl: string
  translate: AddCreditsTranslate
  format: AddCreditsFormat
  ui: AddCreditsUi
}>()

const emit = defineEmits<{
  preset: [cents: number]
  type: [input: string]
  continue: []
}>()

const context = computed(() => ({ translate, format }))
const selectedPreset = computed(() =>
  view.amount.kind === 'preset' ? String(view.amount.cents) : undefined
)
const customInput = computed(() =>
  view.amount.kind === 'custom' ? view.amount.input : ''
)
const amountError = computed(() => amountErrorFor(view, bounds, context.value))
const noticeCopy = computed(() => noticeCopyFor(view.notice, context.value))
const footer = computed(() => footerCopyFor(view, quote, context.value))

function pickPreset(value: unknown) {
  if (typeof value === 'string') emit('preset', Number(value))
}
</script>

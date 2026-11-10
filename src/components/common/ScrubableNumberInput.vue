<template>
  <div
    ref="container"
    :class="
      cn(
        'flex overflow-hidden rounded-md bg-input text-xs text-foreground',
        useWidgetHeight()
      )
    "
  >
    <slot name="background" />
    <Button
      v-if="!hideButtons"
      :aria-label="t('g.decrement')"
      data-testid="decrement"
      class="aspect-square h-full rounded-none p-0 hover:bg-muted disabled:opacity-30"
      variant="muted-textonly"
      size="unset"
      :disabled="!canDecrement"
      tabindex="-1"
      @click="updateValueBy(-step)"
    >
      <i class="icon-[lucide--minus]" />
    </Button>
    <div class="relative my-0.25 min-w-[4ch] flex-1 py-1.5">
      <input
        ref="inputField"
        v-bind="inputAttrs"
        :value="inputValue"
        :disabled
        :readonly="!!onInteraction && !textEdit"
        :class="
          cn(
            'absolute inset-0 truncate border-0 bg-transparent p-1 text-xs focus:outline-0'
          )
        "
        inputmode="decimal"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
        @input="updateDraft"
        @blur="handleBlur"
        @keyup.enter="handleBlur"
        @keydown.escape="cancelEdit"
        @keydown.up.prevent="updateValueBy(step)"
        @keydown.down.prevent="updateValueBy(-step)"
        @keydown.page-up.prevent="updateValueBy(10 * step)"
        @keydown.page-down.prevent="updateValueBy(-10 * step)"
      />
      <div
        ref="swipeElement"
        :class="
          cn(
            'absolute inset-0 z-10 cursor-ew-resize touch-pan-y',
            textEdit && 'pointer-events-none hidden'
          )
        "
        @pointerup="handlePointerUp"
      />
    </div>
    <slot />
    <Button
      v-if="!hideButtons"
      :aria-label="t('g.increment')"
      data-testid="increment"
      class="aspect-square h-full rounded-none p-0 hover:bg-muted disabled:opacity-30"
      variant="muted-textonly"
      size="unset"
      :disabled="!canIncrement"
      tabindex="-1"
      @click="updateValueBy(step)"
    >
      <i class="icon-[lucide--plus]" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { onClickOutside, usePointerSwipe, whenever } from '@vueuse/core'
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import type { NumberInputInteraction } from '@/types/numberInput'
import { useWidgetHeight } from '@/types/widgetTypes'
import { cn } from '@comfyorg/tailwind-utils'

const {
  min = -Number.MAX_VALUE,
  max = Number.MAX_VALUE,
  step = 1,
  disabled = false,
  hideButtons = false,
  displayValue,
  parseValue,
  onInteraction
} = defineProps<{
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  hideButtons?: boolean
  displayValue?: string
  parseValue?: (raw: string) => number | undefined
  onInteraction?: (interaction: NumberInputInteraction) => void
  inputAttrs?: Record<string, unknown>
}>()

const { t } = useI18n()
const modelValue = defineModel<number>({ default: 0 })

const container = useTemplateRef<HTMLDivElement>('container')
const inputField = useTemplateRef<HTMLInputElement>('inputField')
const swipeElement = useTemplateRef('swipeElement')
const textEdit = ref(false)
const draft = ref('')
const inputValue = computed(() =>
  onInteraction && textEdit.value
    ? draft.value
    : (displayValue ?? modelValue.value)
)

onClickOutside(container, () => {
  if (textEdit.value) textEdit.value = false
})

function clamp(value: number): number {
  return Math.min(max, Math.max(min, value))
}

const canDecrement = computed(
  () => !disabled && (!!onInteraction || modelValue.value > min)
)
const canIncrement = computed(
  () => !disabled && (!!onInteraction || modelValue.value < max)
)

function updateDraft(event: Event) {
  if (onInteraction && event.target instanceof HTMLInputElement) {
    draft.value = event.target.value
  }
}

function handleBlur(e: Event) {
  const target = e.target
  if (!(target instanceof HTMLInputElement)) return
  if (onInteraction) {
    if (!textEdit.value) return
    textEdit.value = false
    onInteraction({ kind: 'text', value: target.value })
    return
  }
  const raw = target.value.trim()
  const parsed = parseValue
    ? parseValue(raw)
    : raw === ''
      ? undefined
      : Number(raw)
  if (parsed != null && !isNaN(parsed)) {
    modelValue.value = clamp(parsed)
  } else {
    target.value = displayValue ?? String(modelValue.value)
  }
  textEdit.value = false
}

let dragDelta = 0
function edit() {
  if (disabled || textEdit.value) return
  textEdit.value = true
  if (onInteraction && inputField.value) {
    draft.value = String(modelValue.value)
    inputField.value.value = draft.value
  }
  inputField.value?.focus()
  inputField.value?.select()
}

function cancelEdit() {
  if (!onInteraction) return
  textEdit.value = false
  if (inputField.value) {
    inputField.value.value = displayValue ?? String(modelValue.value)
    inputField.value.blur()
  }
}

function handlePointerUp() {
  if (isSwiping.value) return
  edit()
}

const { distanceX, isSwiping } = usePointerSwipe(swipeElement, {
  threshold: onInteraction ? 0 : 50,
  onSwipeStart: () => (dragDelta = 0),
  onSwipe: () => {
    if (!onInteraction || disabled) return
    const delta = dragDelta - distanceX.value
    dragDelta = distanceX.value
    if (delta) onInteraction({ kind: 'drag', delta })
  },
  onSwipeEnd: () => (dragDelta = 0)
})

whenever(distanceX, () => {
  if (disabled || onInteraction) return
  const delta = ((distanceX.value - dragDelta) / 10) | 0
  dragDelta += delta * 10
  modelValue.value = clamp(modelValue.value - delta * step)
})

function updateValueBy(delta: number) {
  if (disabled) return
  if (onInteraction) {
    onInteraction({ kind: 'step', delta: delta / step })
    return
  }
  modelValue.value = Math.min(max, Math.max(min, modelValue.value + delta))
}

defineExpose({ edit })
</script>

<template>
  <div
    ref="container"
    class="flex h-7 rounded-lg bg-component-node-widget-background text-xs text-component-node-foreground"
  >
    <slot name="background" />
    <Button
      v-if="!hideButtons"
      :aria-label="t('g.decrement')"
      data-testid="decrement"
      class="aspect-8/7 h-full rounded-r-none hover:bg-base-foreground/20 disabled:opacity-30"
      variant="muted-textonly"
      :disabled="!canDecrement"
      tabindex="-1"
      @click="modelValue = clamp(modelValue - step)"
    >
      <i class="pi pi-minus" />
    </Button>
    <div class="relative my-0.25 min-w-[4ch] flex-1 py-1.5">
      <input
        ref="inputField"
        v-bind="inputAttrs"
        :value="displayValue ?? modelValue"
        :disabled
        :class="
          cn(
            'absolute inset-0 truncate border-0 bg-transparent p-1 text-sm focus:outline-0'
          )
        "
        inputmode="decimal"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
        @blur="handleBlur"
        @keyup.enter="handleBlur"
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
      class="aspect-8/7 h-full rounded-l-none hover:bg-base-foreground/20 disabled:opacity-30"
      variant="muted-textonly"
      :disabled="!canIncrement"
      tabindex="-1"
      @click="modelValue = clamp(modelValue + step)"
    >
      <i class="pi pi-plus" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { onClickOutside, usePointerSwipe, whenever } from '@vueuse/core'
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { cn } from '@/utils/tailwindUtil'

const {
  min = -Number.MAX_VALUE,
  max = Number.MAX_VALUE,
  step = 1,
  disabled = false,
  hideButtons = false,
  displayValue,
  parseValue
} = defineProps<{
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  hideButtons?: boolean
  displayValue?: string
  parseValue?: (raw: string) => number | undefined
  inputAttrs?: Record<string, unknown>
}>()

const { t } = useI18n()
const modelValue = defineModel<number>({ default: 0 })

const container = useTemplateRef<HTMLDivElement>('container')
const inputField = useTemplateRef<HTMLInputElement>('inputField')
const swipeElement = useTemplateRef('swipeElement')
const textEdit = ref(false)

onClickOutside(container, () => {
  if (textEdit.value) textEdit.value = false
})

function clamp(value: number): number {
  return Math.min(max, Math.max(min, value))
}

const canDecrement = computed(() => modelValue.value > min && !disabled)
const canIncrement = computed(() => modelValue.value < max && !disabled)

function handleBlur(e: Event) {
  const target = e.target as HTMLInputElement
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
function handlePointerUp() {
  if (isSwiping.value) return

  textEdit.value = true
  inputField.value?.focus()
  inputField.value?.select()
}

const { distanceX, isSwiping } = usePointerSwipe(swipeElement, {
  onSwipeEnd: () => (dragDelta = 0)
})

whenever(distanceX, () => {
  if (disabled) return
  const delta = ((distanceX.value - dragDelta) / 10) | 0
  dragDelta += delta * 10
  modelValue.value = clamp(modelValue.value - delta * step)
})

function updateValueBy(delta: number) {
  modelValue.value = Math.min(max, Math.max(min, modelValue.value + delta))
}
</script>

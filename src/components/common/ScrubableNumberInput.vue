<template>
  <div
    ref="container"
    :class="
      cn(
        'flex overflow-hidden rounded-md bg-input text-xs text-foreground',
        useWidgetHeight(),
        edgeButtons && 'static overflow-visible'
      )
    "
  >
    <slot name="background" />
    <Button
      v-if="!hideButtons"
      :aria-label="t('g.decrement')"
      data-testid="decrement"
      :class="
        cn(
          'aspect-square h-full rounded-none p-0 hover:bg-muted disabled:opacity-30',
          edgeButtons && 'absolute inset-y-0 left-0 w-6'
        )
      "
      variant="muted-textonly"
      size="unset"
      :disabled="!canDecrement"
      tabindex="-1"
      @click="modelValue = clamp(modelValue - step)"
    >
      <i class="icon-[lucide--minus]" />
    </Button>
    <div class="relative my-0.25 min-w-[4ch] flex-1 py-1.5">
      <span
        v-if="edgeButtons"
        aria-hidden="true"
        class="invisible block truncate px-2"
      >
        {{ draft ?? displayValue ?? modelValue }}
      </span>
      <input
        ref="inputField"
        v-bind="inputAttrs"
        :value="draft ?? displayValue ?? modelValue"
        :disabled
        :class="
          cn(
            'peer absolute inset-0 truncate border-0 bg-transparent p-1 text-xs focus:outline-0',
            edgeButtons && 'pr-2 text-right'
          )
        "
        inputmode="decimal"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
        @input="handleInput"
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
            'absolute inset-0 z-10 cursor-ew-resize touch-pan-y peer-focus:hidden',
            textEdit && 'pointer-events-none hidden'
          )
        "
        @pointerup="!scrubElement && handlePointerUp()"
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
      @click="modelValue = clamp(modelValue + step)"
    >
      <i class="icon-[lucide--plus]" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import {
  onClickOutside,
  useEventListener,
  usePointerSwipe,
  whenever
} from '@vueuse/core'
import { computed, ref, useTemplateRef } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { useWidgetHeight } from '@/types/widgetTypes'
import { cn } from '@comfyorg/tailwind-utils'

const {
  min = -Number.MAX_VALUE,
  max = Number.MAX_VALUE,
  step = 1,
  disabled = false,
  hideButtons = false,
  buttonsDisabled = false,
  edgeButtons = false,
  displayValue,
  parseValue,
  labelElement,
  scrubElement
} = defineProps<{
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  hideButtons?: boolean
  buttonsDisabled?: boolean
  edgeButtons?: boolean
  displayValue?: string
  parseValue?: (raw: string) => number | undefined
  inputAttrs?: Record<string, unknown>
  labelElement?: HTMLLabelElement | null
  scrubElement?: HTMLElement | null
}>()

const { t } = useI18n()
const modelValue = defineModel<number>({ default: 0 })
const draft = ref<string>()

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

const canDecrement = computed(
  () => modelValue.value > min && !disabled && !buttonsDisabled
)
const canIncrement = computed(
  () => modelValue.value < max && !disabled && !buttonsDisabled
)

function handleInput(event: Event) {
  if (event.target instanceof HTMLInputElement) draft.value = event.target.value
}

function handleBlur(e: Event) {
  const target = e.target
  if (!(target instanceof HTMLInputElement)) return
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
  draft.value = undefined
  textEdit.value = false
}

function handlePointerUp() {
  if (disabled || isSwiping.value) return

  textEdit.value = true
  inputField.value?.focus()
  inputField.value?.select()
}

function useScrubTarget(
  target: MaybeRefOrGetter<HTMLElement | null | undefined>
) {
  let dragDelta = 0
  let dragged = false
  let editingControl = false
  const swipe = usePointerSwipe(target, {
    onSwipeStart: (event) => {
      dragDelta = 0
      dragged = false
      editingControl = isEditingControl(event.target)
    },
    onSwipeEnd: () => (dragDelta = 0)
  })

  whenever(swipe.distanceX, () => {
    if (disabled || editingControl) return
    const delta = ((swipe.distanceX.value - dragDelta) / 10) | 0
    dragDelta += delta * 10
    dragged ||= delta !== 0
    modelValue.value = clamp(modelValue.value - delta * step)
  })

  useEventListener(target, 'click', (event) => {
    if (dragged) event.preventDefault()
    else if (scrubElement && !isEditingControl(event.target)) handlePointerUp()
  })
  return swipe
}

function isEditingControl(target: EventTarget | null) {
  return target instanceof HTMLElement && !!target.closest('button, input')
}

const { isSwiping } = useScrubTarget(() => scrubElement ?? swipeElement.value)
useScrubTarget(() => (scrubElement ? undefined : labelElement))

function updateValueBy(delta: number) {
  modelValue.value = Math.min(max, Math.max(min, modelValue.value + delta))
  draft.value = undefined
}
</script>

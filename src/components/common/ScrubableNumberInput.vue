<template>
  <Tooltip :disabled="canStep">
    <TooltipTrigger as-child>
      <div
        ref="scrubElement"
        v-bind="$attrs"
        :class="
          cn(
            'relative isolate flex min-w-0 items-center overflow-visible rounded-(--node-widget-radius) border-(length:--node-widget-border-width) border-node-border bg-input text-xs text-foreground focus-within:ring focus-within:ring-ring',
            useWidgetHeight(),
            className
          )
        "
      >
        <slot name="background" />
        <Button
          v-if="!hideButtons"
          :aria-label="t('g.decrement')"
          data-testid="decrement"
          class="h-full w-6 shrink-0 rounded-(--node-widget-radius)"
          variant="muted-textonly"
          size="icon-sm"
          :disabled="!canDecrement"
          tabindex="-1"
          @click="updateValueBy(-step)"
        >
          <i
            class="icon-[lucide--minus] triangle-icons:icon-[comfy--play] triangle-icons:size-2.5 triangle-icons:rotate-180"
          />
        </Button>
        <slot name="label" />
        <slot name="between" />
        <div
          class="relative my-0.25 ml-auto min-h-0 min-w-[4ch] self-stretch py-1.5"
        >
          <span aria-hidden="true" class="invisible block truncate px-2">
            {{ draft ?? displayValue ?? modelValue }}
          </span>
          <input
            ref="inputField"
            v-bind="inputAttrs"
            :value="draft ?? displayValue ?? modelValue"
            :disabled
            class="peer absolute inset-0 truncate border-0 bg-transparent p-1 pr-2 text-right text-xs focus:outline-0"
            inputmode="decimal"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            @input="handleInput"
            @focus="valueBeforeEditing = modelValue"
            @blur="commitDraft"
            @keyup.enter="commitDraft"
            @keydown.esc.prevent.stop="cancelTextEdit"
            @keydown.up.prevent="stepFromInput(step)"
            @keydown.down.prevent="stepFromInput(-step)"
            @keydown.page-up.prevent="stepFromInput(10 * step)"
            @keydown.page-down.prevent="stepFromInput(-10 * step)"
          />
          <div
            class="absolute inset-0 z-10 cursor-ew-resize touch-pan-y peer-focus:hidden"
          />
        </div>
        <slot />
        <Button
          v-if="!hideButtons"
          :aria-label="t('g.increment')"
          data-testid="increment"
          class="h-full w-6 shrink-0 rounded-(--node-widget-radius)"
          variant="muted-textonly"
          size="icon-sm"
          :disabled="!canIncrement"
          tabindex="-1"
          @click="updateValueBy(step)"
        >
          <i
            class="icon-[lucide--plus] triangle-icons:icon-[comfy--play] triangle-icons:size-2.5"
          />
        </Button>
      </div>
    </TooltipTrigger>
    <TooltipContent v-if="!canStep">{{
      t('widgets.precisionLimit')
    }}</TooltipContent>
  </Tooltip>
</template>

<script setup lang="ts">
import { useFocus } from '@vueuse/core'
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import type { HTMLAttributes } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'
import { useNumberScrub } from '@/composables/useNumberScrub'
import { useWidgetHeight } from '@/types/widgetTypes'
import { cn } from '@comfyorg/tailwind-utils'

const {
  class: className,
  min = -Number.MAX_VALUE,
  max = Number.MAX_VALUE,
  step = 1,
  disabled = false,
  hideButtons = false,
  displayValue,
  parseValue
} = defineProps<{
  class?: HTMLAttributes['class']
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  hideButtons?: boolean
  displayValue?: string
  parseValue?: (raw: string) => number | undefined
  inputAttrs?: Record<string, unknown>
}>()

defineOptions({ inheritAttrs: false })

const { t } = useI18n()
const modelValue = defineModel<number>({ default: 0 })
const draft = ref<string>()
let valueBeforeEditing = modelValue.value

const scrubElement = useTemplateRef<HTMLDivElement>('scrubElement')
const inputField = useTemplateRef<HTMLInputElement>('inputField')
const { focused } = useFocus(inputField)

function clamp(value: number): number {
  return Math.min(max, Math.max(min, value))
}

const stepMin = computed(() => Math.max(min, -Number.MAX_SAFE_INTEGER))
const stepMax = computed(() => Math.min(max, Number.MAX_SAFE_INTEGER))
const canDecrement = computed(
  () => modelValue.value > stepMin.value && !disabled && canStep.value
)
const canIncrement = computed(
  () => modelValue.value < stepMax.value && !disabled && canStep.value
)
const canStep = computed(
  () =>
    Number.isFinite(modelValue.value) &&
    Math.abs(modelValue.value) <= Number.MAX_SAFE_INTEGER
)

function handleInput(event: Event) {
  if (event.target instanceof HTMLInputElement) draft.value = event.target.value
}

function commitDraft(): number {
  if (draft.value === undefined) return modelValue.value
  const raw = draft.value.trim()
  const parsed = parseValue
    ? parseValue(raw)
    : raw === ''
      ? undefined
      : Number(raw)
  draft.value = undefined
  if (parsed != null && !isNaN(parsed)) {
    const value = clamp(parsed)
    modelValue.value = value
    return value
  }
  return modelValue.value
}

function cancelTextEdit() {
  draft.value = undefined
  modelValue.value = valueBeforeEditing
  inputField.value?.blur()
}

function startTextEdit() {
  inputField.value?.focus()
  inputField.value?.select()
}

useNumberScrub(scrubElement, {
  value: modelValue,
  min: stepMin,
  max: stepMax,
  step: () => step,
  disabled: () => disabled || focused.value,
  onScrub: updateIncrementalValue,
  onClick: startTextEdit
})

async function stepFromInput(delta: number) {
  commitDraft()
  await nextTick()
  updateValueBy(delta)
}

function updateValueBy(delta: number) {
  updateIncrementalValue(modelValue.value + delta)
}

function updateIncrementalValue(value: number) {
  if (disabled || !canStep.value) return
  modelValue.value = Math.min(stepMax.value, Math.max(stepMin.value, value))
  draft.value = undefined
}
</script>

<template>
  <label
    :for="inputId"
    :class="
      cn(
        'text-secondary-foreground focus-within:ring-secondary-foreground flex h-10 cursor-text items-center rounded-lg bg-secondary-background focus-within:ring-1 hover:bg-secondary-background-hover',
        disabled && 'pointer-events-none opacity-50'
      )
    "
  >
    <button
      type="button"
      class="focus-visible:ring-secondary-foreground flex h-full w-6 shrink-0 cursor-pointer items-center justify-center rounded-l-lg border-none bg-transparent text-muted-foreground transition-colors hover:text-base-foreground focus-visible:ring-1 focus-visible:outline-none focus-visible:ring-inset disabled:opacity-30"
      :disabled="disabled || modelValue <= min"
      :aria-label="$t('g.decrement')"
      @click="handleStep(-1)"
    >
      <i class="icon-[lucide--minus] size-4" />
    </button>
    <div
      class="flex flex-1 items-center justify-center gap-0.5 overflow-hidden"
    >
      <slot name="prefix" />
      <input
        :id="inputId"
        ref="inputRef"
        v-model="inputValue"
        type="text"
        role="spinbutton"
        inputmode="decimal"
        :aria-label="ariaLabel"
        :aria-valuenow="modelValue"
        :aria-valuemin="Number.isFinite(min) ? min : undefined"
        :aria-valuemax="Number.isFinite(max) ? max : undefined"
        :style="{ width: `${inputWidth}ch` }"
        class="min-w-0 rounded-sm border-none bg-transparent text-center text-lg font-medium text-base-foreground focus-visible:outline-none"
        :disabled="disabled"
        @input="handleInputChange"
        @blur="handleInputBlur"
        @focus="handleInputFocus"
        @keydown.up.prevent="handleStep(1)"
        @keydown.down.prevent="handleStep(-1)"
      />
      <span v-if="suffix">{{ suffix }}</span>
      <slot name="suffix" />
    </div>
    <button
      type="button"
      class="focus-visible:ring-secondary-foreground flex h-full w-6 shrink-0 cursor-pointer items-center justify-center rounded-r-lg border-none bg-transparent text-muted-foreground transition-colors hover:text-base-foreground focus-visible:ring-1 focus-visible:outline-none focus-visible:ring-inset disabled:opacity-30"
      :disabled="disabled || modelValue >= max"
      :aria-label="$t('g.increment')"
      @click="handleStep(1)"
    >
      <i class="icon-[lucide--plus] size-4" />
    </button>
  </label>
</template>

<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const {
  min = 0,
  max = Infinity,
  step = 1,
  formatOptions = { useGrouping: true },
  suffix,
  ariaLabel,
  clampOnInput = true,
  disabled = false
} = defineProps<{
  min?: number
  max?: number
  step?: number | ((value: number) => number)
  formatOptions?: Intl.NumberFormatOptions
  suffix?: string
  ariaLabel?: string
  clampOnInput?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  'max-reached': []
}>()

const modelValue = defineModel<number>({ required: true })

const inputId = useId()
const inputRef = ref<HTMLInputElement | null>(null)
const inputValue = ref(formatNumber(modelValue.value))
const isDirty = ref(false)

const inputWidth = computed(() =>
  Math.min(Math.max(inputValue.value.length, 1) + 0.5, 9)
)

watch(modelValue, (newValue) => {
  if (document.activeElement !== inputRef.value) {
    inputValue.value = formatNumber(newValue)
  }
})

function formatNumber(num: number): string {
  return num.toLocaleString('en-US', formatOptions)
}

function parseFormattedNumber(str: string): number | undefined {
  const cleaned = str.replace(/,/g, '').replace(/[^0-9.-]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : undefined
}

function clamp(value: number, minVal: number, maxVal: number): number {
  return Math.min(Math.max(value, minVal), maxVal)
}

function formatWithCursor(
  value: string,
  cursorPos: number,
  num: number
): { formatted: string; newCursor: number } {
  const formatted = formatNumber(num)

  const digitsBeforeCursor = value
    .slice(0, cursorPos)
    .replace(/[^0-9]/g, '').length

  let digitCount = 0
  let newCursor = 0
  for (let i = 0; i < formatted.length; i++) {
    if (/[0-9]/.test(formatted[i])) {
      digitCount++
    }
    if (digitCount >= digitsBeforeCursor) {
      newCursor = i + 1
      break
    }
  }

  if (digitCount < digitsBeforeCursor) {
    newCursor = formatted.length
  }

  return { formatted, newCursor }
}

function getStepAmount(): number {
  return typeof step === 'function' ? step(modelValue.value) : step
}

function handleInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  const raw = input.value
  const cursorPos = input.selectionStart ?? raw.length
  const num = parseFormattedNumber(raw)
  isDirty.value = true

  if (num === undefined) {
    inputValue.value = raw
    return
  }

  const clamped = clampOnInput ? Math.min(num, max) : num
  const wasClamped = num > max

  if (wasClamped) {
    emit('max-reached')
  }

  modelValue.value = clamped

  if (!wasClamped && (raw.startsWith('-') || raw.includes('.'))) {
    inputValue.value = raw
    return
  }

  const { formatted, newCursor } = formatWithCursor(
    wasClamped ? formatNumber(clamped) : raw,
    wasClamped ? formatNumber(clamped).length : cursorPos,
    clamped
  )
  inputValue.value = formatted

  requestAnimationFrame(() => {
    inputRef.value?.setSelectionRange(newCursor, newCursor)
  })
}

function handleInputBlur() {
  const parsed = isDirty.value
    ? parseFormattedNumber(inputValue.value)
    : modelValue.value
  isDirty.value = false
  if (parsed === undefined) {
    inputValue.value = formatNumber(modelValue.value)
    return
  }
  const clamped = clamp(parsed, min, max)
  modelValue.value = clamped
  inputValue.value = formatNumber(clamped)
}

function handleInputFocus(e: FocusEvent) {
  isDirty.value = false
  const input = e.target as HTMLInputElement
  const len = input.value.length
  input.setSelectionRange(len, len)
}

function handleStep(direction: 1 | -1) {
  const stepAmount = getStepAmount()
  const newValue = clamp(modelValue.value + stepAmount * direction, min, max)
  modelValue.value = newValue
  inputValue.value = formatNumber(newValue)
  isDirty.value = false
}
</script>

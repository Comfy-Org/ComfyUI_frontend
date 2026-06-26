<template>
  <div
    ref="container"
    class="relative flex h-7 rounded-lg bg-component-node-widget-background text-xs text-component-node-foreground"
  >
    <slot name="background" />
    <Button
      v-if="!hideButtons"
      :aria-label="t('g.decrement')"
      data-testid="decrement"
      :class="
        cn(
          'aspect-8/7 h-full rounded-r-none hover:bg-base-foreground/20 disabled:opacity-30',
          dragging && 'opacity-0!'
        )
      "
      variant="muted-textonly"
      :disabled="!canDecrement"
      tabindex="-1"
      @click="scrub.setValue(clamp(modelValue - step))"
    >
      <i class="pi pi-minus" />
    </Button>
    <div class="relative my-px min-w-[4ch] flex-1 py-1.5">
      <input
        ref="inputField"
        v-bind="inputAttrs"
        :value="displayValue ?? modelValue"
        :disabled
        class="absolute inset-0 truncate border-0 bg-transparent p-1 text-sm focus:outline-0"
        inputmode="decimal"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
        @blur="handleBlur"
        @keyup.enter="handleBlur"
        @keydown.up.prevent="scrub.setValue(clamp(modelValue + step))"
        @keydown.down.prevent="scrub.setValue(clamp(modelValue - step))"
        @keydown.page-up.prevent="scrub.setValue(clamp(modelValue + 10 * step))"
        @keydown.page-down.prevent="
          scrub.setValue(clamp(modelValue - 10 * step))
        "
      />
      <div
        ref="swipeElement"
        :class="
          cn(
            'absolute inset-0 z-10 touch-pan-y',
            dragging ? 'cursor-grabbing' : 'cursor-ew-resize',
            textEdit && 'pointer-events-none hidden'
          )
        "
      />
    </div>
    <slot />
    <Button
      v-if="!hideButtons"
      :aria-label="t('g.increment')"
      data-testid="increment"
      :class="
        cn(
          'aspect-8/7 h-full rounded-l-none hover:bg-base-foreground/20 disabled:opacity-30',
          dragging && 'opacity-0!'
        )
      "
      variant="muted-textonly"
      :disabled="!canIncrement"
      tabindex="-1"
      @click="scrub.setValue(clamp(modelValue + step))"
    >
      <i class="pi pi-plus" />
    </Button>
    <BallRuler
      v-if="dragging"
      :state="scrub.state"
      :width="containerWidth"
      :min
      :max
      :has-bar="barVisible"
    />
    <div
      v-if="dragging"
      class="pointer-events-none absolute inset-0 text-component-node-foreground"
      aria-hidden="true"
    >
      <i
        class="absolute top-0 left-1/2 icon-[lucide--chevron-up] size-3 -translate-x-1/2 opacity-25"
      />
      <i
        class="absolute bottom-0 left-1/2 icon-[lucide--chevron-down] size-3 -translate-x-1/2 opacity-25"
      />
      <i
        class="absolute top-1/2 left-0 icon-[lucide--chevron-left] size-3 -translate-y-1/2 opacity-25"
      />
      <i
        class="absolute top-1/2 right-0 icon-[lucide--chevron-right] size-3 -translate-y-1/2 opacity-25"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onClickOutside, useElementSize } from '@vueuse/core'
import { clamp as _clamp } from 'es-toolkit'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { cn } from '@comfyorg/tailwind-utils'

import BallRuler from './scrubableNumberInput/BallRuler.vue'
import { useDragGesture } from './scrubableNumberInput/useDragGesture'
import { useScrubValue } from './scrubableNumberInput/useScrubValue'

// ---- Tunable sensitivity envelope -------------------------------------------
// They translate the Y-axis sensitivity range into
// concrete drag-distance promises so the bounds feel meaningful:
//   - DRAG_PX_FOR_FULL_RANGE: at *max* sensitivity, dragging this many screen
//     pixels traverses the entire [min, max] range. Smaller = faster, easier
//     to overshoot. Larger = more conservative, harder to overshoot.
//   - DRAG_PX_PER_STEP_AT_FLOOR: at *min* sensitivity, dragging this many
//     screen pixels advances by exactly one `step`. Larger = finer control
//     when dialing slow. Smaller = floor isn't as fine.
const DRAG_PX_FOR_FULL_RANGE = 250
const DRAG_PX_PER_STEP_AT_FLOOR = 25

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
const swipeElement = useTemplateRef<HTMLDivElement>('swipeElement')
const textEdit = ref(false)

// useElementSize is backed by ResizeObserver.contentRect, which reports in
// logical CSS pixels and ignores ancestor transforms (canvas zoom). That's
// exactly the unit the SVG and the bar fill's `width: %` both render in, so
// no zoom compensation is needed anywhere.
const { width: containerWidth } = useElementSize(container)

const hasFiniteRange = computed(
  () => Number.isFinite(min) && Number.isFinite(max) && max > min
)
const barVisible = computed(
  () => hasFiniteRange.value && containerWidth.value > 0
)

function clamp(value: number): number {
  return _clamp(value, min, max)
}
function quantize(value: number): number {
  return step > 0 ? Math.round(value / step) * step : value
}
function validate(value: number): number {
  return clamp(quantize(value))
}

const stepSize = computed(() => (step > 0 ? step : 1))

const scrub = useScrubValue({
  initial: modelValue.value,
  // Step-based sensitivity: at speedMult=1, one step per screen pixel of
  // drag. Intentionally independent of canvas zoom and input-field width —
  // pointer-lock hides the cursor, so there's no "drag full bar = full range"
  // affordance to preserve.
  baseSpeed: stepSize,
  // Floor: at minimum sensitivity, advancing one step takes
  // DRAG_PX_PER_STEP_AT_FLOOR pixels. Derived: step * speedMult = step / px
  // ⇒ speedMult = 1 / px.
  minSpeed: 1 / DRAG_PX_PER_STEP_AT_FLOOR,
  // Ceiling: at maximum sensitivity, traversing the entire range takes
  // DRAG_PX_FOR_FULL_RANGE pixels. Derived: step * speedMult * px = range
  // ⇒ speedMult = range / (step * px). Falls back to a generous constant
  // when the range is unbounded (no calibration target).
  maxSpeed: computed(() =>
    hasFiniteRange.value
      ? (max - min) / (stepSize.value * DRAG_PX_FOR_FULL_RANGE)
      : 1000
  ),
  validate: (v) => (hasFiniteRange.value ? validate(v) : v),
  onChange: (v) => {
    modelValue.value = v
  }
})

watch(modelValue, (v) => {
  if (v !== scrub.state.value) scrub.setValue(v)
})

const { dragging } = useDragGesture(swipeElement, {
  disabled: computed(() => disabled || textEdit.value),
  lockPointer: true,
  // A plain click should focus the input — not hide the cursor. So pointer
  // lock and onDragStart only fire once the user has *committed* to a scrub:
  // either by crossing the movement threshold, or by holding still past the
  // long-press delay (matches Tweeq's default).
  dragDelaySeconds: 0.5,
  // Drag always modifies from the *current* value — no jump-to-click. The
  // gesture deltas via interpretGesture are inherently relative.
  onDragStart: () => scrub.reset(),
  onDrag: (dx, dy) => scrub.apply(dx, dy),
  onDragEnd: () => {
    if (step > 0) scrub.setValue(validate(scrub.state.value))
  },
  onClick: () => {
    textEdit.value = true
    inputField.value?.focus()
    inputField.value?.select()
  }
})

onClickOutside(container, () => {
  if (textEdit.value) textEdit.value = false
})

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
    scrub.setValue(clamp(parsed))
  } else {
    target.value = displayValue ?? String(modelValue.value)
  }
  textEdit.value = false
}
</script>

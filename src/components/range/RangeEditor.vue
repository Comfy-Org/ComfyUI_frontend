<template>
  <div>
    <div
      ref="trackRef"
      class="relative select-none"
      @pointerdown.stop="onTrackPointerDown"
      @contextmenu.prevent.stop
    >
      <svg
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        :class="
          cn(
            'block w-full rounded-sm bg-node-component-surface',
            display === 'histogram' ? 'aspect-3/2' : 'h-8'
          )
        "
      >
        <defs v-if="display === 'gradient'">
          <linearGradient :id="gradientId" x1="0" y1="0" x2="1" y2="0">
            <stop
              v-for="(stop, i) in computedStops"
              :key="i"
              :offset="stop.offset"
              :stop-color="`rgb(${stop.color[0]},${stop.color[1]},${stop.color[2]})`"
            />
          </linearGradient>
        </defs>

        <rect
          v-if="display === 'gradient'"
          data-testid="gradient-bg"
          x="0"
          y="0"
          width="1"
          height="1"
          :fill="`url(#${gradientId})`"
        />

        <path
          v-if="display === 'histogram' && histogramPath"
          data-testid="histogram-path"
          :d="histogramPath"
          fill="currentColor"
          fill-opacity="0.3"
        />

        <rect
          v-if="display === 'plain'"
          data-testid="range-highlight"
          :x="minNorm"
          y="0"
          :width="Math.max(0, maxNorm - minNorm)"
          height="1"
          fill="white"
          fill-opacity="0.15"
        />
        <template v-if="display === 'histogram'">
          <rect
            v-if="minNorm > 0"
            data-testid="range-dim-left"
            x="0"
            y="0"
            :width="minNorm"
            height="1"
            fill="black"
            fill-opacity="0.5"
          />
          <rect
            v-if="maxNorm < 1"
            data-testid="range-dim-right"
            :x="maxNorm"
            y="0"
            :width="1 - maxNorm"
            height="1"
            fill="black"
            fill-opacity="0.5"
          />
        </template>
      </svg>

      <template v-if="!disabled">
        <div
          data-testid="handle-min"
          class="absolute -translate-x-1/2 cursor-grab"
          :style="{ left: `${minNorm * 100}%`, bottom: '-10px' }"
          @pointerdown.stop="startDrag('min', $event)"
        >
          <svg width="12" height="10" viewBox="0 0 12 10">
            <polygon
              points="6,0 0,10 12,10"
              fill="#333"
              stroke="#aaa"
              stroke-width="0.5"
            />
          </svg>
        </div>

        <div
          v-if="showMidpoint && modelValue.midpoint !== undefined"
          data-testid="handle-midpoint"
          class="absolute -translate-x-1/2 cursor-grab"
          :style="{ left: `${midpointPercent}%`, bottom: '-10px' }"
          @pointerdown.stop="startDrag('midpoint', $event)"
        >
          <svg width="12" height="10" viewBox="0 0 12 10">
            <polygon
              points="6,0 0,10 12,10"
              fill="#888"
              stroke="#ccc"
              stroke-width="0.5"
            />
          </svg>
        </div>

        <div
          data-testid="handle-max"
          class="absolute -translate-x-1/2 cursor-grab"
          :style="{ left: `${maxNorm * 100}%`, bottom: '-10px' }"
          @pointerdown.stop="startDrag('max', $event)"
        >
          <svg width="12" height="10" viewBox="0 0 12 10">
            <polygon
              points="6,0 0,10 12,10"
              fill="white"
              stroke="#555"
              stroke-width="0.5"
            />
          </svg>
        </div>
      </template>
    </div>

    <div
      v-if="!disabled"
      class="mt-3 flex items-center justify-between"
      @pointerdown.stop
    >
      <ScrubableNumberInput
        v-model="minValue"
        :display-value="formatValue(minValue)"
        :min="valueMin"
        :max="valueMax"
        :step="step"
        hide-buttons
        class="w-16"
      />
      <ScrubableNumberInput
        v-if="showMidpoint && modelValue.midpoint !== undefined"
        v-model="midpointValue"
        :display-value="midpointValue.toFixed(2)"
        :min="midpointScale === 'gamma' ? 0.01 : 0"
        :max="midpointScale === 'gamma' ? 9.99 : 1"
        :step="0.01"
        hide-buttons
        class="w-16"
      />
      <ScrubableNumberInput
        v-model="maxValue"
        :display-value="formatValue(maxValue)"
        :min="valueMin"
        :max="valueMax"
        :step="step"
        hide-buttons
        class="w-16"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, toRef, useId, useTemplateRef } from 'vue'

import ScrubableNumberInput from '@/components/common/ScrubableNumberInput.vue'
import { cn } from '@/utils/tailwindUtil'
import { histogramToPath } from '@/utils/histogramUtil'
import { useRangeEditor } from '@/composables/useRangeEditor'
import type { ColorStop } from '@/lib/litegraph/src/interfaces'
import type { RangeValue } from '@/lib/litegraph/src/types/widgets'

import {
  clamp,
  gammaToPosition,
  normalize,
  positionToGamma
} from './rangeUtils'

const {
  display = 'plain',
  gradientStops,
  showMidpoint = false,
  midpointScale = 'linear',
  histogram,
  disabled = false,
  valueMin = 0,
  valueMax = 1
} = defineProps<{
  display?: 'plain' | 'gradient' | 'histogram'
  gradientStops?: ColorStop[]
  showMidpoint?: boolean
  midpointScale?: 'linear' | 'gamma'
  histogram?: Uint32Array | null
  disabled?: boolean
  valueMin?: number
  valueMax?: number
}>()

const modelValue = defineModel<RangeValue>({ required: true })

const trackRef = useTemplateRef<HTMLDivElement>('trackRef')
const gradientId = useId()

const { handleTrackPointerDown, startDrag } = useRangeEditor({
  trackRef,
  modelValue,
  valueMin: toRef(() => valueMin),
  valueMax: toRef(() => valueMax)
})

function onTrackPointerDown(e: PointerEvent) {
  if (!disabled) handleTrackPointerDown(e)
}

const isIntegerRange = computed(() => valueMax - valueMin >= 2)
const step = computed(() => (isIntegerRange.value ? 1 : 0.01))

function formatValue(v: number): string {
  return isIntegerRange.value ? Math.round(v).toString() : v.toFixed(2)
}

const minNorm = computed(() =>
  normalize(modelValue.value.min, valueMin, valueMax)
)
const maxNorm = computed(() =>
  normalize(modelValue.value.max, valueMin, valueMax)
)

const computedStops = computed(
  () =>
    gradientStops ?? [
      { offset: 0, color: [0, 0, 0] as const },
      { offset: 1, color: [255, 255, 255] as const }
    ]
)

const midpointPercent = computed(() => {
  const { min, max, midpoint } = modelValue.value
  if (midpoint === undefined) return 0
  const midAbs = min + midpoint * (max - min)
  return normalize(midAbs, valueMin, valueMax) * 100
})

const minValue = computed({
  get: () => modelValue.value.min,
  set: (min) => {
    modelValue.value = {
      ...modelValue.value,
      min: Math.min(clamp(min, valueMin, valueMax), modelValue.value.max)
    }
  }
})

const maxValue = computed({
  get: () => modelValue.value.max,
  set: (max) => {
    modelValue.value = {
      ...modelValue.value,
      max: Math.max(clamp(max, valueMin, valueMax), modelValue.value.min)
    }
  }
})

const midpointValue = computed({
  get: () => {
    const pos = modelValue.value.midpoint ?? 0.5
    return midpointScale === 'gamma' ? positionToGamma(pos) : pos
  },
  set: (val) => {
    const position =
      midpointScale === 'gamma'
        ? clamp(gammaToPosition(val), 0, 1)
        : clamp(val, 0, 1)
    modelValue.value = { ...modelValue.value, midpoint: position }
  }
})

const histogramPath = computed(() =>
  histogram ? histogramToPath(histogram) : ''
)
</script>

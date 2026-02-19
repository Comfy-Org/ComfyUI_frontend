<template>
  <svg
    ref="svgRef"
    viewBox="0 0 1 1"
    preserveAspectRatio="xMidYMid meet"
    class="aspect-square w-full cursor-crosshair rounded-[5px] bg-node-component-surface"
    @pointerdown="handleSvgPointerDown"
    @contextmenu.prevent.stop
  >
    <line
      v-for="v in [0.25, 0.5, 0.75]"
      :key="'h' + v"
      :x1="0"
      :y1="v"
      :x2="1"
      :y2="v"
      stroke="currentColor"
      stroke-opacity="0.1"
      stroke-width="0.003"
    />
    <line
      v-for="v in [0.25, 0.5, 0.75]"
      :key="'v' + v"
      :x1="v"
      :y1="0"
      :x2="v"
      :y2="1"
      stroke="currentColor"
      stroke-opacity="0.1"
      stroke-width="0.003"
    />

    <line
      x1="0"
      y1="1"
      x2="1"
      y2="0"
      stroke="currentColor"
      stroke-opacity="0.15"
      stroke-width="0.003"
    />

    <path
      v-if="histogramPath"
      :d="histogramPath"
      :fill="curveColor"
      fill-opacity="0.15"
      stroke="none"
    />

    <path
      :d="curvePath"
      fill="none"
      :stroke="curveColor"
      stroke-width="0.008"
      stroke-linecap="round"
    />

    <circle
      v-for="(point, i) in modelValue"
      :key="i"
      :cx="point[0]"
      :cy="1 - point[1]"
      r="0.02"
      :fill="curveColor"
      stroke="white"
      stroke-width="0.004"
      class="cursor-grab"
      @pointerdown.stop="startDrag(i, $event)"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import { useCurveEditor } from '@/composables/useCurveEditor'
import type { CurvePoint } from '@/lib/litegraph/src/types/widgets'

const { curveColor = 'white', histogram } = defineProps<{
  curveColor?: string
  histogram?: Uint32Array | null
}>()

const modelValue = defineModel<CurvePoint[]>({
  required: true
})

const svgRef = useTemplateRef<SVGSVGElement>('svgRef')

const { curvePath, handleSvgPointerDown, startDrag } = useCurveEditor({
  svgRef,
  modelValue
})

const histogramPath = computed(() => {
  if (!histogram?.length) return ''

  const sorted = Array.from(histogram).sort((a, b) => a - b)
  const max = sorted[Math.floor(255 * 0.995)]
  if (max === 0) return ''

  const step = 1 / 255
  let d = 'M0,1'
  for (let i = 0; i < 256; i++) {
    const x = i * step
    const y = 1 - Math.min(1, histogram[i] / max)
    d += ` L${x.toFixed(4)},${y.toFixed(4)}`
  }
  d += ' L1,1 Z'
  return d
})
</script>

<template>
  <div :class="cn('rounded-lg bg-secondary-background p-6', className)">
    <canvas ref="canvasRef" :aria-label role="img" />
  </div>
</template>

<script setup lang="ts">
import type { ChartData, ChartOptions, ChartType } from 'chart.js'
import { ref, toRef } from 'vue'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { useChart } from './useChart'

const {
  type,
  data,
  options,
  ariaLabel,
  class: className
} = defineProps<{
  type: ChartType
  data: ChartData
  options?: ChartOptions
  ariaLabel?: string
  class?: HTMLAttributes['class']
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

useChart(
  canvasRef,
  toRef(() => type),
  toRef(() => data),
  toRef(() => options)
)
</script>

<template>
  <div :class="cn('rounded-lg bg-secondary-background p-6', className)">
    <div class="relative">
      <canvas ref="canvasRef" :aria-label="label" role="img" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChartData } from 'chart.js'
import { toRef, useTemplateRef } from 'vue'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { useChart } from './useChart'
import type { SupportedChartType } from './useChart'

const {
  type,
  data,
  label,
  class: className
} = defineProps<{
  type: SupportedChartType
  data: ChartData
  label: string
  class?: HTMLAttributes['class']
}>()

const canvasRef = useTemplateRef<HTMLCanvasElement>('canvasRef')

useChart(
  canvasRef,
  toRef(() => type),
  toRef(() => data)
)
</script>

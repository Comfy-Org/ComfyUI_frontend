<template>
  <div
    :class="
      cn('rounded-lg bg-component-node-widget-background p-6', props.class)
    "
  >
    <canvas ref="canvasRef" :aria-label="ariaLabel" role="img" />
  </div>
</template>

<script setup lang="ts">
import type { ChartData, ChartOptions } from 'chart.js'
import { computed, ref, toRef } from 'vue'

import { cn } from '@/utils/tailwindUtil'

import { useChart } from './useChart'

const props = defineProps<{
  data: ChartData<'bar'>
  options?: ChartOptions<'bar'>
  ariaLabel?: string
  class?: string
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

useChart(
  canvasRef,
  ref('bar'),
  toRef(() => props.data),
  computed(() => props.options as ChartOptions | undefined)
)
</script>

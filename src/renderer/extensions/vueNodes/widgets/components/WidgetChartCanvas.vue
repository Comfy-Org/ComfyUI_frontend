<template>
  <canvas ref="canvasRef" :aria-label="label" role="img" />
</template>

<script setup lang="ts">
import type { ChartData, ChartOptions, ChartType } from 'chart.js'
import { computed, ref, toRef } from 'vue'

import { useChart } from '@/components/ui/chart/useChart'

const { type, data, options, label } = defineProps<{
  type: ChartType
  data: ChartData
  options?: ChartOptions
  label: string
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

useChart(
  canvasRef,
  computed(() => type),
  toRef(() => data),
  toRef(() => options)
)
</script>

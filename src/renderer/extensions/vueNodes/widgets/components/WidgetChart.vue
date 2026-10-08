<template>
  <Chart
    class="max-h-192"
    :type="chartType"
    :data="chartData"
    :label="`${widget.name || $t('g.chart')} - ${chartType} ${$t('g.chartLowercase')}`"
  />
</template>

<script setup lang="ts">
import type { ChartData } from 'chart.js'
import { computed } from 'vue'

import Chart from '@/components/ui/chart/Chart.vue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import type { ChartWidgetOptions } from './WidgetChart.types'

const value = defineModel<Partial<ChartData> | null>({ required: true })

const { widget } = defineProps<{
  widget: SimplifiedWidget<Partial<ChartData> | null, ChartWidgetOptions>
}>()

const chartType = computed(() => widget.options?.type ?? 'line')

const chartData = computed<ChartData>(() => ({
  ...value.value,
  labels: value.value?.labels ?? [],
  datasets: value.value?.datasets ?? []
}))
</script>

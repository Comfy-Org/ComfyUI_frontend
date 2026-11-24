<template>
  <Chart
    class="max-h-192"
    :type="chartType"
    :data="chartData"
    :label="`${widgetName(widgetId) || $t('g.chart')} - ${chartType} ${$t('g.chartLowercase')}`"
  />
</template>

<script setup lang="ts">
import type { ChartData } from 'chart.js'
import { computed } from 'vue'

import Chart from '@comfyorg/design-system/chart/Chart'
import {
  widgetName,
  widgetOptions
} from '@/renderer/extensions/vueNodes/widgets/widgetEntity'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'

import type { ChartWidgetOptions } from './WidgetChart.types'

const value = defineModel<Partial<ChartData> | null>({ required: true })

const { widgetId } = defineProps<{
  widgetId: WidgetId
}>()

const options = computed<ChartWidgetOptions>(() => widgetOptions(widgetId))

const chartType = computed(() => options.value.type ?? 'line')

const chartData = computed<ChartData>(() => ({
  ...value.value,
  labels: value.value?.labels ?? [],
  datasets: value.value?.datasets ?? []
}))
</script>

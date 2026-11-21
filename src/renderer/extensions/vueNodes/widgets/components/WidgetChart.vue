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

import Chart from '@comfyorg/design-system/chart/Chart'
import { useWidgetView } from '@/renderer/extensions/vueNodes/widgets/useWidgetView'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'

import type { ChartWidgetOptions } from './WidgetChart.types'

const value = defineModel<Partial<ChartData> | null>({ required: true })

const { widgetId } = defineProps<{
  widgetId: WidgetId
}>()

const widget = useWidgetView(() => widgetId)
const options = computed<ChartWidgetOptions>(() => widget.value.options)

const chartType = computed(() => options.value.type ?? 'line')

const chartData = computed<ChartData>(() => ({
  ...value.value,
  labels: value.value?.labels ?? [],
  datasets: value.value?.datasets ?? []
}))
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="max-h-192 rounded-sm border p-4">
      <Chart
        :type="chartType"
        :data="chartData"
        :options="chartOptions"
        :aria-label="`${widget.name || $t('g.chart')} - ${chartType} ${$t('g.chartLowercase')}`"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChartData } from 'chart.js'
import { useCssVar } from '@vueuse/core'
import Chart from 'primevue/chart'
import { computed } from 'vue'

import type { IWidgetOptions } from '@/lib/litegraph/src/types/widgets'
import type { ChartInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

type ChartWidgetOptions = NonNullable<ChartInputSpec['options']> &
  IWidgetOptions

const value = defineModel<ChartData>({ required: true })

const props = defineProps<{
  widget: SimplifiedWidget<ChartData, ChartWidgetOptions>
}>()

const chartType = computed(() => props.widget.options?.type ?? 'line')

const chartData = computed(() => value.value || { labels: [], datasets: [] })

const baseForeground = useCssVar('--color-base-foreground')
const mutedForeground = useCssVar('--color-muted-foreground')

const chartOptions = computed(() => {
  const legendColor = baseForeground.value || '#FFF'
  const axisColor = mutedForeground.value || '#9FA2BD'

  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: legendColor,
          usePointStyle: true,
          pointStyle: 'circle'
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: axisColor
        },
        grid: {
          display: true,
          color: axisColor,
          drawTicks: false,
          drawOnChartArea: true,
          drawBorder: false
        },
        border: {
          display: true,
          color: axisColor
        }
      },
      y: {
        ticks: {
          color: axisColor
        },
        grid: {
          display: false,
          drawTicks: false,
          drawOnChartArea: false,
          drawBorder: false
        },
        border: {
          display: true,
          color: axisColor
        }
      }
    }
  }
})
</script>

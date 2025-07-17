<template>
  <div class="flex flex-col gap-1">
    <div
      class="p-4 border border-gray-300 dark-theme:border-gray-600 rounded max-h-[48rem]"
    >
      <Chart :type="chartType" :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChartData } from 'chart.js'
import Chart from 'primevue/chart'
import { computed } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

interface ChartWidgetData extends ChartData {
  type?: 'bar' | 'line'
}

const value = defineModel<ChartWidgetData>({ required: true })

defineProps<{
  widget: SimplifiedWidget<ChartWidgetData>
  readonly?: boolean
}>()

const chartType = computed(() => value.value?.type || 'bar')

const chartData = computed(() => ({
  labels: value.value?.labels || [],
  datasets: value.value?.datasets || []
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: '#FFF',
        usePointStyle: true,
        pointStyle: 'circle'
      }
    }
  },
  scales: {
    x: {
      ticks: {
        color: '#9FA2BD'
      },
      grid: {
        display: true,
        color: '#9FA2BD',
        drawTicks: false,
        drawOnChartArea: true,
        drawBorder: false
      },
      border: {
        display: true,
        color: '#9FA2BD'
      }
    },
    y: {
      ticks: {
        color: '#9FA2BD'
      },
      grid: {
        display: false,
        drawTicks: false,
        drawOnChartArea: false,
        drawBorder: false
      },
      border: {
        display: true,
        color: '#9FA2BD'
      }
    }
  }
}))
</script>

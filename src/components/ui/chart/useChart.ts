import type { ChartData, ChartOptions } from 'chart.js'
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Colors,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip
} from 'chart.js'
import { onBeforeUnmount, onMounted, shallowRef, toRaw, watch } from 'vue'

import type { Ref } from 'vue'

export type SupportedChartType = 'bar' | 'line'

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  Colors,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip
)

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
}

function getDefaultOptions(type: SupportedChartType): ChartOptions {
  const foreground = getCssVar('--color-base-foreground') || '#ffffff'
  const muted = getCssVar('--color-muted-foreground') || '#8a8a8a'

  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        align: 'start',
        labels: {
          color: foreground,
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 8,
          boxHeight: 8,
          padding: 16,
          font: { family: 'Inter', size: 11 },
          generateLabels(chart) {
            const datasets = chart.data.datasets
            return datasets.map((dataset, i) => {
              const color =
                (dataset as { borderColor?: string }).borderColor ??
                (dataset as { backgroundColor?: string }).backgroundColor ??
                '#888'
              return {
                text: dataset.label ?? '',
                fillStyle: color,
                strokeStyle: color,
                lineWidth: 0,
                pointStyle: 'circle' as const,
                hidden: !chart.isDatasetVisible(i),
                datasetIndex: i
              }
            })
          }
        }
      },
      tooltip: {
        enabled: true
      }
    },
    elements: {
      point: {
        radius: 0,
        hoverRadius: 4
      }
    },
    scales: {
      x: {
        ticks: {
          color: muted,
          font: { family: 'Inter', size: 11 },
          padding: 8
        },
        grid: {
          display: true,
          color: muted + '33',
          drawTicks: false
        },
        border: { display: true, color: muted }
      },
      y: {
        ticks: {
          color: muted,
          font: { family: 'Inter', size: 11 },
          padding: 4
        },
        grid: {
          display: false,
          drawTicks: false
        },
        border: { display: true, color: muted }
      }
    },
    ...(type === 'bar' && {
      datasets: {
        bar: {
          borderRadius: { topLeft: 4, topRight: 4 },
          borderSkipped: false,
          barPercentage: 0.6,
          categoryPercentage: 0.8
        }
      }
    })
  }
}

export function useChart(
  canvasRef: Readonly<Ref<HTMLCanvasElement | null>>,
  type: Readonly<Ref<SupportedChartType>>,
  data: Readonly<Ref<ChartData>>
) {
  const chartInstance = shallowRef<Chart | null>(null)

  function createChart() {
    if (!canvasRef.value) return

    chartInstance.value?.destroy()
    chartInstance.value = new Chart(canvasRef.value, {
      type: type.value,
      data: toRaw(data.value),
      options: getDefaultOptions(type.value)
    })
  }

  onMounted(createChart)

  watch(type, createChart)

  watch(
    data,
    () => {
      if (!chartInstance.value) return
      chartInstance.value.data = toRaw(data.value)
      chartInstance.value.update()
    },
    { deep: true }
  )

  onBeforeUnmount(() => {
    chartInstance.value?.destroy()
    chartInstance.value = null
  })
}

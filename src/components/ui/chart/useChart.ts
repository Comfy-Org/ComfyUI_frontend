import type { ChartData, ChartOptions, ChartType } from 'chart.js'
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip
} from 'chart.js'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { Ref } from 'vue'

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
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

function getDefaultOptions(type: ChartType): ChartOptions {
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
                fillStyle: color as string,
                strokeStyle: color as string,
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
  canvasRef: Ref<HTMLCanvasElement | null>,
  type: Ref<ChartType>,
  data: Ref<ChartData>,
  options?: Ref<ChartOptions | undefined>
) {
  const chartInstance = ref<Chart | null>(null)

  function createChart() {
    if (!canvasRef.value) return

    chartInstance.value?.destroy()

    const defaults = getDefaultOptions(type.value)
    const merged = options?.value
      ? deepMerge(defaults, options.value)
      : defaults

    chartInstance.value = new Chart(canvasRef.value, {
      type: type.value,
      data: data.value,
      options: merged
    })
  }

  onMounted(createChart)

  watch([type, data, options ?? ref(undefined)], () => {
    if (chartInstance.value) {
      chartInstance.value.data = data.value
      chartInstance.value.options = options?.value
        ? deepMerge(getDefaultOptions(type.value), options.value)
        : getDefaultOptions(type.value)
      chartInstance.value.update()
    }
  })

  onBeforeUnmount(() => {
    chartInstance.value?.destroy()
    chartInstance.value = null
  })

  return { chartInstance }
}

function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Record<string, unknown>
): T {
  const result = { ...target } as Record<string, unknown>
  for (const key of Object.keys(source)) {
    const srcVal = source[key]
    const tgtVal = result[key]
    if (
      srcVal &&
      typeof srcVal === 'object' &&
      !Array.isArray(srcVal) &&
      tgtVal &&
      typeof tgtVal === 'object' &&
      !Array.isArray(tgtVal)
    ) {
      result[key] = deepMerge(
        tgtVal as Record<string, unknown>,
        srcVal as Record<string, unknown>
      )
    } else {
      result[key] = srcVal
    }
  }
  return result as T
}

<template>
  <div
    class="rounded-lg bg-secondary-background p-4"
    data-testid="download-history-chart"
  >
    <div class="mb-3 flex items-center justify-between">
      <h3 class="m-0 text-sm font-semibold">
        {{ t('developerProfile.downloadHistory') }}
      </h3>
      <div
        class="flex gap-1 rounded-md bg-modal-panel-background p-0.5"
        data-testid="range-buttons"
      >
        <button
          v-for="range in RANGES"
          :key="range"
          :class="
            cn(
              'cursor-pointer rounded border-none px-2 py-1 text-xs transition-colors',
              selectedRange === range
                ? 'bg-secondary-background font-semibold text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )
          "
          :data-testid="`range-btn-${range}`"
          @click="selectedRange = range"
        >
          {{ t(`developerProfile.range.${range}`) }}
        </button>
      </div>
    </div>
    <div class="h-62.5">
      <canvas ref="canvasRef" />
    </div>
  </div>
</template>

/** * Download history chart for the developer profile dashboard. * * Renders
daily download counts using Chart.js, with a toggle group in the * upper-right
corner that switches between four time ranges: * * - **Week** (7 bars) and
**Month** (31 bars) render as bar charts. * - **Year** (weekly buckets) and
**All Time** (monthly buckets) render as * filled area charts, with entries
aggregated into summed buckets to keep * the point count manageable. * * @prop
entries - Chronologically-ordered daily download history produced by * {@link
fetchDownloadHistory}. */
<script setup lang="ts">
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from 'chart.js'
import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  DownloadHistoryEntry,
  DownloadHistoryRange
} from '@/types/templateMarketplace'
import { cn } from '@/utils/tailwindUtil'

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
)

const RANGES: DownloadHistoryRange[] = ['week', 'month', 'year', 'allTime']

const BAR_COLOR = '#185A8B'

const { entries } = defineProps<{
  entries: DownloadHistoryEntry[]
}>()

const { t } = useI18n()

const selectedRange = ref<DownloadHistoryRange>('week')
const canvasRef = ref<HTMLCanvasElement | null>(null)
const chartInstance = shallowRef<Chart | null>(null)

/**
 * Aggregates entries into buckets by summing downloads and using the last
 * date in each bucket for the label.
 */
function aggregate(
  source: DownloadHistoryEntry[],
  bucketSize: number
): DownloadHistoryEntry[] {
  const result: DownloadHistoryEntry[] = []
  for (let i = 0; i < source.length; i += bucketSize) {
    const bucket = source.slice(i, i + bucketSize)
    const downloads = bucket.reduce((sum, e) => sum + e.downloads, 0)
    result.push({ date: bucket[bucket.length - 1].date, downloads })
  }
  return result
}

/**
 * Returns the tail slice of entries matching the selected range, downsampled
 * for larger views, along with formatted date labels.
 */
function sliceEntries(range: DownloadHistoryRange): {
  labels: string[]
  data: number[]
} {
  const count =
    range === 'week' ? 7 : range === 'month' ? 31 : range === 'year' ? 365 : 0

  const sliced = count > 0 ? entries.slice(-count) : entries
  const sampled =
    range === 'year'
      ? aggregate(sliced, 7)
      : range === 'allTime'
        ? aggregate(sliced, 30)
        : sliced

  const labels = sampled.map((e) => {
    const d = e.date
    if (range === 'week')
      return d.toLocaleDateString(undefined, { weekday: 'short' })
    if (range === 'month') return String(d.getDate())
    if (range === 'year')
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
  })

  return { labels, data: sampled.map((e) => e.downloads) }
}

/**
 * Builds or replaces the Chart.js instance on the canvas whenever range
 * or data changes.
 */
function renderChart() {
  const canvas = canvasRef.value
  if (!canvas) return

  chartInstance.value?.destroy()

  const range = selectedRange.value
  const isBar = range === 'week' || range === 'month'
  const { labels, data } = sliceEntries(range)

  chartInstance.value = new Chart(canvas, {
    type: isBar ? 'bar' : 'line',
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: isBar ? BAR_COLOR : `${BAR_COLOR}33`,
          borderColor: BAR_COLOR,
          borderWidth: isBar ? 0 : 2,
          borderRadius: isBar ? { topLeft: 4, topRight: 4 } : undefined,
          fill: !isBar,
          tension: 0.3,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      transitions: { active: { animation: { duration: 0 } } },
      plugins: { legend: { display: false }, tooltip: { mode: 'index' } },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#9FA2BD',
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: isBar ? undefined : 12
          }
        },
        y: {
          beginAtZero: true,
          grid: { color: '#9FA2BD22' },
          ticks: { color: '#9FA2BD' }
        }
      }
    }
  })
}

watch([selectedRange, () => entries], renderChart, { flush: 'post' })

watch(canvasRef, (el) => {
  if (el) renderChart()
})

onBeforeUnmount(() => {
  chartInstance.value?.destroy()
})
</script>

<template>
  <CollapsibleRoot v-model:open="isOpen" class="mx-1 mb-4">
    <CollapsibleTrigger
      class="flex w-full cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent px-2 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary-background"
    >
      <i
        :class="
          cn(
            'size-4 transition-transform',
            isOpen
              ? 'icon-[lucide--chevron-down]'
              : 'icon-[lucide--chevron-right]'
          )
        "
      />
      {{ t('templateWorkflows.myTemplates.dashboard') }}
    </CollapsibleTrigger>

    <CollapsibleContent class="mt-2 flex flex-col gap-4">
      <!-- Summary stat cards -->
      <div class="grid grid-cols-4 gap-3 px-2">
        <div
          v-for="card in statCards"
          :key="card.label"
          class="flex flex-col gap-1 rounded-lg bg-secondary-background px-4 py-3"
        >
          <span class="text-xs text-muted">{{ card.label }}</span>
          <span class="text-lg font-semibold">{{ card.value }}</span>
        </div>
      </div>

      <!-- Bar chart -->
      <div class="max-h-64 px-2">
        <h4 class="mb-2 text-sm font-medium">
          {{ t('templateWorkflows.myTemplates.performance') }}
        </h4>
        <Chart type="bar" :data="chartData" :options="chartOptions" />
      </div>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>

<script setup lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger
} from 'reka-ui'
import Chart from 'primevue/chart'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@/utils/tailwindUtil'

import type { MarketplaceTemplate } from '../types/marketplace'

const { templates } = defineProps<{
  templates: MarketplaceTemplate[]
}>()

const { t } = useI18n()

const isOpen = ref(false)

const totalDownloads = computed(() =>
  templates.reduce((sum, tmpl) => sum + tmpl.stats.downloads, 0)
)

const totalFavorites = computed(() =>
  templates.reduce((sum, tmpl) => sum + tmpl.stats.favorites, 0)
)

const averageRating = computed(() => {
  if (templates.length === 0) return 0
  const sum = templates.reduce((acc, tmpl) => acc + tmpl.stats.rating, 0)
  return (sum / templates.length).toFixed(1)
})

const statCards = computed(() => [
  {
    label: t('templateWorkflows.myTemplates.totalDownloads'),
    value: totalDownloads.value.toLocaleString()
  },
  {
    label: t('templateWorkflows.myTemplates.totalFavorites'),
    value: totalFavorites.value.toLocaleString()
  },
  {
    label: t('templateWorkflows.myTemplates.averageRating'),
    value: averageRating.value
  },
  {
    label: t('templateWorkflows.myTemplates.templateCount'),
    value: templates.length
  }
])

const sortedTemplates = computed(() =>
  [...templates].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
)

const chartData = computed(() => ({
  labels: sortedTemplates.value.map((tmpl) => tmpl.name),
  datasets: [
    {
      label: t('templateWorkflows.myTemplates.downloads'),
      data: sortedTemplates.value.map((tmpl) => tmpl.stats.downloads),
      backgroundColor: 'rgba(59, 130, 246, 0.7)'
    },
    {
      label: t('templateWorkflows.myTemplates.favorites'),
      data: sortedTemplates.value.map((tmpl) => tmpl.stats.favorites),
      backgroundColor: 'rgba(168, 85, 247, 0.7)'
    }
  ]
}))

const chartOptions = computed(() => ({
  indexAxis: 'y' as const,
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: getCssVar('--color-foreground', '#e2e8f0'),
        usePointStyle: true,
        pointStyle: 'circle'
      }
    }
  },
  scales: {
    x: {
      ticks: { color: getCssVar('--color-muted', '#9fa2bd') },
      grid: { color: 'rgba(255,255,255,0.06)' }
    },
    y: {
      ticks: { color: getCssVar('--color-muted', '#9fa2bd') },
      grid: { display: false }
    }
  }
}))

function getCssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  )
}
</script>

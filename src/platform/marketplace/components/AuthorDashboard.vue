<template>
  <div class="flex flex-col gap-6 p-6">
    <h2 class="text-lg font-semibold">
      {{ $t('marketplace.authorDashboard') }}
    </h2>

    <!-- Stats Summary -->
    <div v-if="stats" class="grid grid-cols-4 gap-4">
      <div class="border-border rounded-lg border p-4 text-center">
        <div class="text-2xl font-bold">{{ stats.totalDownloads }}</div>
        <div class="text-sm text-muted">
          {{ $t('marketplace.stats.downloads') }}
        </div>
      </div>
      <div class="border-border rounded-lg border p-4 text-center">
        <div class="text-2xl font-bold">{{ stats.totalFavorites }}</div>
        <div class="text-sm text-muted">
          {{ $t('marketplace.stats.favorites') }}
        </div>
      </div>
      <div class="border-border rounded-lg border p-4 text-center">
        <div class="text-2xl font-bold">
          {{ stats.averageRating.toFixed(1) }}
        </div>
        <div class="text-sm text-muted">
          {{ $t('marketplace.stats.rating') }}
        </div>
      </div>
      <div class="border-border rounded-lg border p-4 text-center">
        <div class="text-2xl font-bold">
          {{ stats.trend > 0 ? '+' : '' }}{{ stats.trend }}%
        </div>
        <div class="text-sm text-muted">
          {{ $t('marketplace.stats.trend') }}
        </div>
      </div>
    </div>

    <!-- Period Selector -->
    <div class="flex gap-2">
      <button
        v-for="period in periods"
        :key="period.value"
        :data-testid="`period-${period.value}`"
        :class="
          cn(
            'rounded-md px-3 py-1.5 text-sm',
            selectedPeriod === period.value
              ? 'text-highlight-foreground bg-highlight'
              : 'bg-base-background text-muted hover:bg-base-background/80'
          )
        "
        @click="handlePeriodChange(period.value)"
      >
        {{ period.label }}
      </button>
    </div>

    <!-- Templates by Status -->
    <div class="flex flex-col gap-4">
      <div v-for="statusGroup in statusGroups" :key="statusGroup.status">
        <template v-if="statusGroup.templates.length > 0">
          <h3 class="mb-2 text-sm font-semibold">
            {{ $t(`marketplace.status.${statusGroup.status}`) }}
            <span class="ml-1 text-muted">
              ({{ statusGroup.templates.length }})
            </span>
          </h3>
          <div class="flex flex-col gap-2">
            <div
              v-for="template in statusGroup.templates"
              :key="template.id"
              class="border-border flex items-center justify-between rounded-lg border p-3"
            >
              <div>
                <div class="font-medium">{{ template.title }}</div>
                <div class="text-sm text-muted">
                  {{ template.shortDescription }}
                </div>
              </div>
              <div class="text-sm text-muted">
                {{ template.stats.downloads }}
                {{ $t('marketplace.stats.downloads').toLowerCase() }}
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import { TEMPLATE_STATUSES } from '@/platform/marketplace/apiTypes'
import { useAuthorDashboard } from '@/platform/marketplace/composables/useAuthorDashboard'
import { cn } from '@/utils/tailwindUtil'

const { t } = useI18n()

const { stats, selectedPeriod, templatesByStatus, loadTemplates, loadStats } =
  useAuthorDashboard()

const periods = computed(() => [
  { value: 'day' as const, label: t('marketplace.period.day') },
  { value: 'week' as const, label: t('marketplace.period.week') },
  { value: 'month' as const, label: t('marketplace.period.month') }
])

const statusGroups = computed(() =>
  TEMPLATE_STATUSES.map((status) => ({
    status,
    templates: templatesByStatus.value[status]
  }))
)

function handlePeriodChange(period: 'day' | 'week' | 'month') {
  void loadStats(period)
}

onMounted(() => {
  void loadTemplates()
  void loadStats('week')
})
</script>

<template>
  <BaseModalLayout class="size-full max-h-full max-w-full min-w-0">
    <template #header>
      <h2>{{ $t('marketplace.authorDashboard') }}</h2>
    </template>

    <template #content>
      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <i class="icon-[lucide--loader-2] animate-spin text-muted" />
      </div>

      <div
        v-else-if="error"
        class="flex flex-col items-center gap-2 py-12 text-center"
      >
        <i class="text-danger icon-[lucide--alert-circle] size-6" />
        <p class="text-sm text-muted">{{ error }}</p>
      </div>

      <div v-else class="flex flex-col gap-6">
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

        <div class="flex items-center gap-2">
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
  </BaseModalLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, provide } from 'vue'
import { useI18n } from 'vue-i18n'

import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import { TEMPLATE_STATUSES } from '@/platform/marketplace/apiTypes'
import { useAuthorDashboard } from '@/platform/marketplace/composables/useAuthorDashboard'
import { OnCloseKey } from '@/types/widgetTypes'
import { cn } from '@/utils/tailwindUtil'

const props = defineProps<{
  onClose?: () => void
}>()

provide(OnCloseKey, props.onClose ?? (() => {}))

const { t } = useI18n()

const {
  stats,
  selectedPeriod,
  isLoading,
  error,
  templatesByStatus,
  loadTemplates,
  loadStats
} = useAuthorDashboard()

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

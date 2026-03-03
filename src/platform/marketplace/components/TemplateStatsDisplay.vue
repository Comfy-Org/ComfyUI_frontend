<template>
  <div class="flex flex-col gap-3 px-4 py-2">
    <div v-if="stats.downloads > 0" class="flex items-center justify-between">
      <span class="text-sm select-none">
        {{ t('templateWorkflows.myTemplates.downloads') }}
      </span>
      <span class="flex items-center gap-1 text-sm text-muted-foreground">
        <i class="icon-[lucide--download] size-3.5" />
        {{ stats.downloads.toLocaleString() }}
      </span>
    </div>
    <div v-if="stats.favorites > 0" class="flex items-center justify-between">
      <span class="text-sm select-none">
        {{ t('templateWorkflows.myTemplates.favorites') }}
      </span>
      <span class="flex items-center gap-1 text-sm text-muted-foreground">
        <i class="icon-[lucide--heart] size-3.5" />
        {{ stats.favorites.toLocaleString() }}
      </span>
    </div>
    <div v-if="stats.rating > 0" class="flex items-center justify-between">
      <span class="text-sm select-none">
        {{ t('templateWorkflows.myTemplates.rating') }}
      </span>
      <span class="flex items-center gap-0.5">
        <i
          v-for="n in 5"
          :key="n"
          :class="
            cn(
              'size-3.5',
              n <= Math.round(stats.rating)
                ? 'icon-[lucide--star] text-yellow-500'
                : 'icon-[lucide--star] text-muted-foreground/30'
            )
          "
        />
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { cn } from '@/utils/tailwindUtil'

import type { TemplateStats } from '../types/marketplace'

const { t } = useI18n()

defineProps<{
  stats: TemplateStats
}>()
</script>

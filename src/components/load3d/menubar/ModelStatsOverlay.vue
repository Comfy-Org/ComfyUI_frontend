<template>
  <dl
    class="pointer-events-none absolute top-2 right-2 z-10 m-0 grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 rounded-md bg-backdrop/50 px-2 py-1 text-xs text-base-foreground tabular-nums"
    data-testid="load3d-model-stats"
  >
    <template v-for="row in rows" :key="row.key">
      <dt class="opacity-70">{{ row.label }}</dt>
      <dd class="m-0 text-right">{{ row.value }}</dd>
    </template>
  </dl>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ModelStats } from '@/extensions/core/load3d/modelStats'

const { stats } = defineProps<{ stats: ModelStats }>()

const { t, locale } = useI18n()

const rows = computed(() => {
  const formatter = new Intl.NumberFormat(locale.value)
  return [
    {
      key: 'vertices',
      label: t('load3d.stats.vertices'),
      count: stats.vertices
    },
    { key: 'edges', label: t('load3d.stats.edges'), count: stats.edges },
    {
      key: 'triangles',
      label: t('load3d.stats.triangles'),
      count: stats.triangles
    }
  ].map(({ count, ...row }) => ({ ...row, value: formatter.format(count) }))
})
</script>

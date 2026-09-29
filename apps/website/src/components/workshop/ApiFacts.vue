<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  where,
  rows,
  locale = 'en'
} = defineProps<{
  where: string
  rows: readonly { label: string; value: string; mono?: boolean }[]
  locale?: Locale
}>()
</script>

<template>
  <div
    class="flex flex-col gap-4 rounded-2xl border border-transparency-white-t20 p-6"
    data-testid="api-facts"
  >
    <span
      class="text-xs font-bold tracking-widest text-primary-warm-gray uppercase"
    >
      {{ t('workshop.api.needs', locale) }}
    </span>
    <p class="text-lg font-semibold text-primary-warm-white">{{ where }}</p>
    <div class="h-px bg-transparency-white-t8"></div>
    <dl
      class="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-3 text-sm/relaxed"
    >
      <template v-for="row in rows" :key="row.label">
        <dt class="text-primary-warm-gray">{{ row.label }}</dt>
        <dd
          :class="
            cn(
              'm-0 min-w-0 wrap-break-word text-primary-warm-white',
              row.mono && 'font-mono text-xs'
            )
          "
        >
          {{ row.value }}
        </dd>
      </template>
    </dl>
  </div>
</template>

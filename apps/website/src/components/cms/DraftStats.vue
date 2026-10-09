<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  waiting,
  included,
  held,
  scheduled,
  locale = 'en'
} = defineProps<{
  waiting: number
  included: number
  held: number
  scheduled: number
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const stats = computed(() => [
  { key: 'waiting', value: waiting, warn: false },
  { key: 'included', value: included, warn: false },
  { key: 'held', value: held, warn: held > 0 },
  { key: 'scheduled', value: scheduled, warn: false }
])
</script>

<template>
  <dl
    class="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-admin-line bg-admin-line md:grid-cols-4"
  >
    <div
      v-for="stat in stats"
      :key="stat.key"
      class="grid gap-1.5 bg-admin-card px-4 py-3"
    >
      <dt class="text-xs text-admin-muted">
        {{ t(`cmsAdmin.draft.${stat.key}`) }}
      </dt>
      <dd
        :class="
          cn(
            'text-xl leading-none tabular-nums',
            stat.warn && 'text-admin-warning'
          )
        "
      >
        {{ stat.value }}
      </dd>
    </div>
  </dl>
</template>

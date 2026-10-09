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
    class="grid grid-cols-2 divide-transparency-white-t8 overflow-hidden rounded-2xl border border-transparency-white-t8 md:grid-cols-4 md:divide-x"
  >
    <div v-for="stat in stats" :key="stat.key" class="grid gap-0.5 px-5 py-3">
      <dt class="text-xs text-primary-comfy-canvas">
        {{ t(`cmsAdmin.draft.${stat.key}`) }}
      </dt>
      <dd
        :class="
          cn(
            'text-2xl font-semibold tabular-nums',
            stat.warn && 'text-primary-comfy-orange'
          )
        "
      >
        {{ stat.value }}
      </dd>
    </div>
  </dl>
</template>

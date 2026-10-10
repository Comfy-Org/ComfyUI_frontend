<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

/** One line on what still needs the reviewer, instead of a wall of counts. */
const {
  undecided,
  flagged,
  scheduled,
  publishing,
  locale = 'en'
} = defineProps<{
  undecided: number
  flagged: number
  scheduled: number
  publishing: number
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const facts = computed(() =>
  [
    { key: 'undecided', count: undecided, warn: true },
    { key: 'flagged', count: flagged, warn: true },
    { key: 'scheduled', count: scheduled, warn: false },
    { key: 'publishing', count: publishing, warn: false }
  ].filter((fact) => fact.count > 0)
)
</script>

<template>
  <ul
    v-if="facts.length"
    class="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-admin-line bg-admin-card px-4 py-3 text-sm"
  >
    <li
      v-for="fact in facts"
      :key="fact.key"
      class="inline-flex items-center gap-2"
    >
      <span
        :class="
          cn(
            'size-1.5 rounded-full',
            fact.warn ? 'bg-admin-warning' : 'bg-admin-subtle'
          )
        "
        aria-hidden="true"
      />
      {{
        t(
          `cmsAdmin.draft.summary.${fact.key}`,
          { count: fact.count },
          fact.count
        )
      }}
    </li>
  </ul>
</template>

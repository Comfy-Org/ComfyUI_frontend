<script setup lang="ts">
import type { Locale, TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { ExploreCount } from '@/lib/workshop/explore-search'

const {
  title,
  description,
  counts = [],
  locale = 'en'
} = defineProps<{
  title: string
  description?: string
  counts?: readonly ExploreCount[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const COUNT_KEY = {
  models: 'hubPages.explore.models',
  workflows: 'hubPages.explore.workflows',
  apps: 'hubPages.explore.apps'
} as const satisfies Record<ExploreCount['kind'], TranslationKey>
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2
        id="explore-results"
        class="text-xl font-medium text-primary-warm-white"
      >
        {{ title }}
      </h2>
      <ul
        v-if="counts.length"
        :aria-label="t('hubPages.explore.kinds')"
        class="flex flex-wrap items-baseline text-sm text-primary-warm-gray"
        data-testid="explore-counts"
      >
        <li
          v-for="(entry, index) in counts"
          :key="entry.kind"
          class="flex items-baseline"
        >
          <span v-if="index > 0" aria-hidden="true" class="px-1.5">·</span>
          <a
            :href="entry.href"
            class="rounded-sm transition-colors outline-none hover:text-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
            :data-kind="entry.kind"
          >
            {{
              t(
                COUNT_KEY[entry.kind],
                { count: entry.count },
                { plural: entry.count }
              )
            }}
          </a>
        </li>
      </ul>
    </div>
    <p v-if="description" class="text-sm text-content-secondary">
      {{ description }}
    </p>
  </div>
</template>

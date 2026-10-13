<script setup lang="ts">
import { computed } from 'vue'

import type { WorkshopModel } from '@/config/models-catalogue'
import type { Locale, TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { UseCaseTile } from '@/lib/workshop/explore-use-cases'
import { useCaseTiles } from '@/lib/workshop/explore-use-cases'
import { useCaseLabelKey } from '@/lib/workshop/use-case-label'

const {
  models,
  workflows,
  locale = 'en'
} = defineProps<{
  models: readonly WorkshopModel[]
  workflows: readonly WorkshopModel[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const COUNT_KEY = {
  models: 'hubPages.explore.models',
  workflows: 'hubPages.explore.workflows'
} as const satisfies Record<UseCaseTile['catalogue'], TranslationKey>

const tiles = computed(() => useCaseTiles({ models, workflows }, locale))
</script>

<template>
  <section
    v-if="tiles.length"
    aria-labelledby="explore-use-cases"
    data-testid="explore-use-cases"
  >
    <h2
      id="explore-use-cases"
      class="mb-5 text-xl font-medium text-primary-warm-white"
    >
      {{ t('workshop.explore.useCasesTitle') }}
    </h2>
    <ul class="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
      <li v-for="tile in tiles" :key="tile.useCase">
        <a
          :href="tile.href"
          class="group flex h-full flex-col gap-3 overflow-hidden rounded-3xl bg-hub-surface p-2 pb-4 transition-colors duration-200 outline-none hover:bg-hub-surface-hover focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
          :data-use-case="tile.useCase"
          data-testid="explore-use-case"
        >
          <span
            class="relative block aspect-4/3 overflow-hidden rounded-2xl bg-hub-surface-hover"
          >
            <img
              v-if="tile.still"
              :src="tile.still"
              alt=""
              class="size-full object-cover transition-transform duration-300 select-none group-hover:scale-105"
              loading="lazy"
              decoding="async"
              draggable="false"
            />
          </span>
          <span class="flex min-w-0 flex-col gap-1 px-3">
            <span class="truncate text-sm font-medium text-content-bright">
              {{ t(useCaseLabelKey[tile.useCase]) }}
            </span>
            <span class="text-xs text-primary-warm-gray tabular-nums">
              {{
                t(
                  COUNT_KEY[tile.catalogue],
                  { count: tile.count },
                  { plural: tile.count }
                )
              }}
            </span>
          </span>
        </a>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { WorkflowWorkshopModel } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { categoryTiles } from '@/lib/workshop/explore-category-tiles'
import { workflowCategoryIcon } from '@/lib/workshop/workflow-category-icons'

const { workflows, locale = 'en' } = defineProps<{
  workflows: readonly WorkflowWorkshopModel[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const tiles = computed(() => categoryTiles(workflows, locale))
</script>

<template>
  <section
    v-if="tiles.length"
    aria-labelledby="explore-categories"
    data-testid="explore-categories"
  >
    <h2
      id="explore-categories"
      class="mb-5 text-xl font-medium text-primary-warm-white"
    >
      {{ t('workshop.explore.useCasesTitle') }}
    </h2>
    <ul class="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
      <li v-for="tile in tiles" :key="tile.id">
        <a
          :href="tile.href"
          class="group flex h-full flex-col gap-3 overflow-hidden rounded-3xl bg-hub-surface p-2 pb-4 transition-colors duration-200 outline-none hover:bg-hub-surface-hover focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
          :data-category="tile.id"
          data-testid="explore-category"
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
          <span class="flex min-w-0 items-start gap-2 px-3">
            <component
              :is="workflowCategoryIcon(tile.id)"
              class="mt-0.5 size-4 shrink-0 text-primary-warm-gray"
              aria-hidden="true"
            />
            <span class="flex min-w-0 flex-col gap-1">
              <span class="truncate text-sm font-medium text-content-bright">
                {{ tile.label }}
              </span>
              <span class="text-xs text-primary-warm-gray tabular-nums">
                {{
                  t(
                    'hubPages.explore.workflows',
                    { count: tile.count },
                    { plural: tile.count }
                  )
                }}
              </span>
            </span>
          </span>
        </a>
      </li>
    </ul>
  </section>
</template>

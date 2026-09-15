<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { WorkshopModel } from '../../config/models-catalogue'
import {
  filterWorkshopModels,
  sortWorkshopModels
} from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  models,
  query,
  variant = 'dropdown',
  locale = 'en'
} = defineProps<{
  models: readonly WorkshopModel[]
  query: string
  /** On a phone the same panel fills the screen instead of hanging off a
   * field. */
  variant?: 'dropdown' | 'sheet'
  locale?: Locale
}>()

const emit = defineEmits<{
  pick: [model: WorkshopModel]
}>()

const SUGGESTIONS = 4

const matching = computed(() => filterWorkshopModels(models, { query }))

const suggestions = computed(() =>
  query.trim()
    ? sortWorkshopModels(matching.value, 'name').slice(0, SUGGESTIONS)
    : []
)
</script>

<template>
  <div
    :class="
      cn(
        'flex flex-col gap-5 bg-page p-4',
        variant === 'sheet'
          ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain'
          : 'absolute inset-x-0 top-full z-30 mt-2 max-h-[70dvh] overflow-y-auto overscroll-contain rounded-2xl border border-transparency-white-t20 shadow-lg'
      )
    "
    data-testid="workshop-search-panel"
  >
    <section v-if="suggestions.length" class="flex flex-col gap-2">
      <p
        class="text-[11px] font-bold tracking-wider text-primary-warm-gray uppercase"
      >
        {{ t('workshop.search.models', locale) }}
        <span class="tabular-nums opacity-60">({{ matching.length }})</span>
      </p>
      <button
        v-for="model in suggestions"
        :key="model.slug"
        type="button"
        class="flex cursor-pointer items-center gap-3 rounded-xl p-2 text-left outline-none hover:bg-transparency-white-t4 focus-visible:bg-transparency-white-t4"
        data-testid="workshop-search-model"
        @mousedown.prevent
        @click="emit('pick', model)"
      >
        <img
          v-if="model.thumbnailUrl"
          :src="model.thumbnailUrl"
          alt=""
          class="size-10 shrink-0 rounded-lg object-cover"
          loading="lazy"
          decoding="async"
        />
        <span
          v-else
          class="grid size-10 shrink-0 place-items-center rounded-lg bg-transparency-white-t8 text-sm font-bold text-primary-warm-white"
          aria-hidden="true"
        >
          {{ model.name[0] }}
        </span>
        <span class="flex min-w-0 flex-col">
          <span class="truncate text-sm text-primary-warm-white">
            {{ model.name }}
          </span>
          <span class="truncate text-xs text-primary-warm-gray">
            {{ model.provider ?? t('workshop.card.partnerNode', locale) }}
          </span>
        </span>
      </button>
    </section>

    <p v-else-if="query.trim()" class="p-2 text-sm text-primary-warm-gray">
      {{ t('workshop.hub.facets.noResults', locale) }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { computed } from 'vue'

import type { UseCase, WorkshopModel } from '../../config/workshop'
import { USE_CASES, filterWorkshopModels } from '../../config/workshop'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import WorkshopModelCard from './WorkshopModelCard.vue'

const ROW_LIMIT = 8

const {
  models,
  labelKey,
  locale = 'en',
  showStatuses = false
} = defineProps<{
  models: readonly WorkshopModel[]
  labelKey: Record<UseCase | 'all', TranslationKey>
  locale?: Locale
  showStatuses?: boolean
}>()

const emit = defineEmits<{ open: [UseCase] }>()

const sections = computed(() =>
  USE_CASES.map((useCase) => {
    const matches = filterWorkshopModels(models, { useCase })
    return {
      useCase,
      total: matches.length,
      shown: matches.slice(0, ROW_LIMIT)
    }
  }).filter((section) => section.total > 0)
)
</script>

<template>
  <div class="flex flex-col gap-12" data-testid="workshop-sections">
    <section
      v-for="section in sections"
      :key="section.useCase"
      :aria-labelledby="`section-${section.useCase}`"
      :data-testid="`section-${section.useCase}`"
    >
      <div class="mb-5 flex items-center justify-between gap-4">
        <h2
          :id="`section-${section.useCase}`"
          class="text-primary-warm-white flex items-baseline gap-2 text-xl font-medium"
        >
          {{ t(labelKey[section.useCase], locale) }}
          <span class="text-primary-warm-gray text-sm tabular-nums">
            {{ section.total }}
          </span>
        </h2>
        <button
          type="button"
          class="text-primary-warm-gray hover:text-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-3"
          :data-testid="`section-${section.useCase}-see-all`"
          @click="emit('open', section.useCase)"
        >
          {{ t('workshop.sections.seeAll', locale) }}
          <ChevronRight class="size-4" aria-hidden="true" />
        </button>
      </div>

      <ul
        class="scrollbar-thin -mx-1 flex snap-x gap-5 overflow-x-auto px-1 pb-2"
      >
        <li
          v-for="model in section.shown"
          :key="model.slug"
          class="w-72 shrink-0 snap-start"
        >
          <WorkshopModelCard :model :locale :show-status="showStatuses" />
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { computed } from 'vue'

import type { WorkshopModel } from '@/config/models-catalogue'
import { sortWorkshopModels } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { groupModels } from '@/config/model-family'
import { CARD_GRID } from '@/lib/workshop/card-layout'
import { canCompare, MAX_COMPARED } from '@/lib/workshop/explorer/compare'
import { getRoutes } from '@/config/routes'
import { rememberListOnClick } from '@/lib/workshop/shelf-memory'
import CompareToggle from '@/components/workshop/explorer/compare/CompareToggle.vue'
import WorkshopModelCard from './WorkshopModelCard.vue'

const TRENDING_LIMIT = 8

const {
  models,
  compared = [],
  locale = 'en'
} = defineProps<{
  models: readonly WorkshopModel[]
  compared?: readonly string[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ browse: []; compare: [slug: string] }>()

const trending = computed(() =>
  groupModels(sortWorkshopModels(models, 'popular')).slice(0, TRENDING_LIMIT)
)

function rememberModel(model: WorkshopModel, event: MouseEvent) {
  if (model.href)
    rememberListOnClick({ href: getRoutes(locale).workshop }, model.href, event)
}
</script>

<template>
  <section
    v-if="trending.length"
    aria-labelledby="section-trending"
    class="flex flex-col gap-5"
    data-testid="section-trending"
  >
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2
          id="section-trending"
          class="text-xl font-medium text-primary-warm-white"
        >
          {{ t('workshop.sections.trending') }}
        </h2>
        <p class="text-sm text-primary-warm-gray">
          {{ t('workshop.modelsHub.trendingSubtitle') }}
        </p>
      </div>
      <button
        type="button"
        class="group inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg text-sm font-medium text-primary-comfy-yellow transition-opacity outline-none hover:opacity-80 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
        data-testid="section-trending-see-all"
        @click="emit('browse')"
      >
        {{ t('workshop.modelsHub.viewAll') }}
        <ChevronRight
          class="size-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </button>
    </div>

    <ul :class="CARD_GRID">
      <li
        v-for="family in trending"
        :key="family.key"
        class="group/compare relative"
      >
        <WorkshopModelCard
          :model="family.latest"
          :locale
          @click="rememberModel(family.latest, $event)"
        />
        <CompareToggle
          v-if="canCompare(family.latest)"
          :model-value="compared.includes(family.latest.slug)"
          :name="family.latest.name"
          :revealed="compared.length > 0"
          :disabled="
            compared.length >= MAX_COMPARED &&
            !compared.includes(family.latest.slug)
          "
          :locale
          class="absolute top-4 right-4 z-20"
          @update:model-value="emit('compare', family.latest.slug)"
        />
      </li>
    </ul>
  </section>
</template>

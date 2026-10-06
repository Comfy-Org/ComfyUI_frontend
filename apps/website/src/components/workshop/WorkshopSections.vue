<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { computed } from 'vue'

import type { WorkshopModel } from '@/config/models-catalogue'
import { sortWorkshopModels } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { groupModels } from '@/config/model-family'
import { SHELF_CARD } from '@/lib/workshop/card-layout'
import { rememberShelfOnClick } from '@/lib/workshop/shelf-memory'
import CardRow from './CardRow.vue'
import WorkshopModelCard from './WorkshopModelCard.vue'

const ROW_LIMIT = 8

const { models, locale = 'en' } = defineProps<{
  models: readonly WorkshopModel[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ browse: [] }>()

const trending = computed(() =>
  groupModels(sortWorkshopModels(models, 'popular'))
)

function rememberModel(model: WorkshopModel, event: MouseEvent) {
  if (model.href) rememberShelfOnClick('all', model.href, event)
}
</script>

<template>
  <div class="flex flex-col gap-12" data-testid="workshop-sections">
    <section
      v-if="trending.length"
      aria-labelledby="section-trending"
      data-testid="section-trending"
    >
      <CardRow :locale>
        <template #heading>
          <h2
            id="section-trending"
            class="text-xl font-medium text-primary-warm-white"
          >
            {{ t('workshop.sections.trending') }}
          </h2>
        </template>

        <template #actions>
          <button
            v-if="trending.length > ROW_LIMIT"
            type="button"
            class="group inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg text-sm font-medium text-primary-warm-gray transition-colors outline-none hover:text-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
            data-testid="section-trending-see-all"
            @click="emit('browse')"
          >
            <span class="tabular-nums">
              {{ t('workshop.sections.seeAll', { n: trending.length }) }}
            </span>
            <ChevronRight
              class="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </button>
        </template>

        <li
          v-for="family in trending.slice(0, ROW_LIMIT)"
          :key="family.key"
          :class="SHELF_CARD"
        >
          <WorkshopModelCard
            :model="family.latest"
            :locale
            @click="rememberModel(family.latest, $event)"
          />
        </li>
      </CardRow>
    </section>
  </div>
</template>

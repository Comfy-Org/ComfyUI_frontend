<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'

import type { WorkshopModel } from '../../config/models-catalogue'
import { getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import WorkshopModelCard from './WorkshopModelCard.vue'

const {
  related,
  heading,
  headingShort,
  locale = 'en'
} = defineProps<{
  related: readonly WorkshopModel[]
  heading: string
  headingShort: string
  locale?: Locale
}>()

const routes = getRoutes(locale)
</script>

<template>
  <section
    class="mt-24 border-t border-transparency-white-t8 pt-12"
    data-testid="related-models"
  >
    <div class="mb-6 flex items-baseline justify-between gap-4">
      <h2 class="text-2xl font-bold text-primary-comfy-canvas">
        <span class="sm:hidden">{{ headingShort }}</span>
        <span class="max-sm:hidden">{{ heading }}</span>
      </h2>
      <a
        :href="routes.workshop"
        class="inline-flex items-center gap-2 text-sm font-bold tracking-wider text-primary-comfy-yellow uppercase hover:underline"
      >
        <span class="sm:hidden">{{
          t('workshop.model.browseAllShort', locale)
        }}</span>
        <span class="max-sm:hidden">{{
          t('workshop.model.browseAll', locale)
        }}</span>
        <ArrowRight class="size-4 shrink-0" aria-hidden="true" />
      </a>
    </div>
    <ul
      class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      <li v-for="other in related" :key="other.slug">
        <WorkshopModelCard :model="other" :locale />
      </li>
    </ul>
  </section>
</template>

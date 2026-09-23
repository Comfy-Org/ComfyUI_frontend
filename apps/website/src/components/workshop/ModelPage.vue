<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import { computed } from 'vue'

import { catalogSearch, useCaseFor } from '../../config/models-catalogue'
import { getRoutes } from '../../config/routes'
import type { ModelsPageData } from '../../config/models-page-data'
import { t } from '../../i18n/translations'
import { useWorkshopEnabled } from '../../scripts/posthog'
import CatalogueBackLink from './CatalogueBackLink.vue'
import ModelPrice from './ModelPrice.vue'
import ModelDetail from './ModelDetail.vue'
import ModelStatus from './ModelStatus.vue'
import ModelSupport from './ModelSupport.vue'
import SplitReveal from './SplitReveal.vue'
import TagOverflow from './TagOverflow.vue'
import WorkshopModelCard from './WorkshopModelCard.vue'

const { page } = defineProps<{ page: ModelsPageData }>()
const routes = getRoutes()
const enabled = useWorkshopEnabled()
const modelUseCase = computed(() => useCaseFor(page.model))
const pillClass =
  'inline-flex h-7 items-center rounded-full border border-transparency-white-t20 px-3 text-xs leading-none text-primary-comfy-canvas transition-colors hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow'
const restTags = computed(() =>
  page.restTags.map((tag) => ({
    label: tag.label,
    href: `${routes.workshop}${tag.search}`
  }))
)
</script>

<template>
  <div class="mx-auto max-w-10xl px-6 py-10 lg:px-8 lg:py-14">
    <div class="mb-8 sm:px-8 lg:px-10">
      <CatalogueBackLink />
    </div>
    <header class="mb-12 sm:mx-8 lg:mx-10" data-testid="model-hero">
      <div
        class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
      >
        <div class="flex max-w-2xl flex-col gap-4">
          <div class="flex flex-wrap items-center gap-3">
            <p
              class="text-sm leading-none font-medium tracking-widest text-primary-comfy-yellow uppercase"
            >
              {{ page.model.provider ?? t('workshop.card.partnerNode') }}
            </p>
            <ModelSupport
              v-if="page.model.incompleteReason"
              :reason="page.model.incompleteReason"
            />
            <a
              v-if="modelUseCase && page.useCaseLabel"
              :href="`${routes.workshop}${catalogSearch({ useCase: modelUseCase })}`"
              :class="pillClass"
            >
              {{ page.useCaseLabel }}
            </a>
          </div>

          <h1 class="text-3xl font-bold text-primary-comfy-canvas lg:text-4xl">
            <SplitReveal :text="page.model.name" />
          </h1>
          <p
            v-if="page.model.summary"
            class="text-sm/relaxed text-primary-warm-gray"
          >
            {{ page.model.summary }}
          </p>
        </div>

        <div class="flex flex-col gap-4 lg:items-end">
          <ModelPrice :estimate="page.priceEstimate" />
          <ul
            v-if="page.shownTags.length > 0"
            class="scrollbar-hide flex items-center gap-2 max-sm:overflow-x-auto sm:flex-wrap lg:justify-end"
            data-testid="model-tags"
          >
            <li v-for="tag in page.shownTags" :key="tag.search">
              <a
                :href="`${routes.workshop}${tag.search}`"
                class="inline-flex h-7 shrink-0 items-center rounded-full bg-transparency-white-t8 px-3 text-xs/none whitespace-nowrap text-primary-comfy-canvas transition-colors hover:bg-transparency-white-t20 hover:text-primary-comfy-yellow"
              >
                {{ tag.label }}
              </a>
            </li>
            <li v-if="page.restTagCount > 0">
              <TagOverflow v-if="enabled" :tags="restTags" />
            </li>
          </ul>
        </div>
      </div>

      <ModelStatus
        variant="banner"
        :status="page.model.status"
        :successor="page.successor"
      />
    </header>

    <div class="sm:px-8 lg:px-10">
      <ModelDetail :model="page.model" />

      <section
        class="mt-24 border-t border-transparency-white-t8 pt-12"
        data-testid="related-models"
      >
        <div class="mb-6 flex items-baseline justify-between gap-4">
          <h2 class="text-2xl font-bold text-primary-comfy-canvas">
            <span class="sm:hidden">{{ page.relatedHeadingShort }}</span>
            <span class="max-sm:hidden">{{ page.relatedHeading }}</span>
          </h2>
          <a
            :href="routes.workshop"
            class="inline-flex items-center gap-2 text-sm font-bold tracking-wider text-primary-comfy-yellow uppercase hover:underline"
          >
            <span class="sm:hidden">{{
              t('workshop.model.browseAllShort')
            }}</span>
            <span class="max-sm:hidden">{{
              t('workshop.model.browseAll')
            }}</span>
            <ArrowRight class="size-4 shrink-0" aria-hidden="true" />
          </a>
        </div>
        <ul
          class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          <li v-for="other in page.related" :key="other.slug">
            <WorkshopModelCard :model="other" />
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

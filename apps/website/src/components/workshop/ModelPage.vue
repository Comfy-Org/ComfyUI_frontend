<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'

import { catalogSearch } from '../../config/models-catalogue'
import { getRoutes } from '../../config/routes'
import { t } from '../../i18n/translations'
import { prepareModelPage } from '../../routes/models/model-page'
import ModelDetail from './ModelDetail.vue'
import ModelStatus from './ModelStatus.vue'
import ModelSupport from './ModelSupport.vue'
import SplitReveal from './SplitReveal.vue'
import WorkshopModelCard from './WorkshopModelCard.vue'

const { slug } = defineProps<{ slug: string }>()
const result = await prepareModelPage(slug)
if (result.kind === 'redirect')
  throw new Error(`Expected a canonical Models slug: ${slug}`)
const page = result
const routes = getRoutes()
const pillClass =
  'inline-flex h-7 items-center rounded-full border border-transparency-white-t20 px-3 text-xs leading-none text-primary-comfy-canvas transition-colors hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow'
</script>

<template>
  <div class="max-w-10xl mx-auto px-6 py-10 lg:px-8 lg:py-14">
    <nav
      aria-label="Breadcrumb"
      class="mb-8 text-xs text-primary-warm-gray sm:px-8 lg:px-10"
    >
      <ol class="flex flex-wrap items-center gap-2">
        <li>
          <a :href="routes.home" class="hover:text-primary-warm-white">
            {{ t('breadcrumb.home') }}
          </a>
        </li>
        <li aria-hidden="true">›</li>
        <li>
          <a
            :href="`${routes.workshop}?tab=models`"
            class="hover:text-primary-warm-white"
          >
            {{ t('workshop.title') }}
          </a>
        </li>
        <li aria-hidden="true">›</li>
        <li class="text-primary-warm-white" aria-current="page">
          {{ page.model.name }}
        </li>
      </ol>
    </nav>
    <header class="mb-12 sm:mx-8 lg:mx-10" data-testid="model-hero">
      <div
        class="flex flex-col gap-6 pr-8 lg:flex-row lg:items-end lg:justify-between lg:pr-10"
      >
        <div class="flex max-w-2xl flex-col gap-4">
          <div class="flex flex-wrap items-center gap-3">
            <p
              class="text-primary-comfy-yellow text-sm leading-none font-medium tracking-widest uppercase"
            >
              {{ page.model.provider ?? t('workshop.card.partnerNode') }}
            </p>
            <ModelSupport
              v-if="page.model.incompleteReason"
              :reason="page.model.incompleteReason"
            />
            <a
              v-if="page.model.modality"
              :href="`${routes.workshop}${catalogSearch({ modalities: [page.model.modality] })}`"
              :class="pillClass"
            >
              {{ page.modalityLabel[page.model.modality] }}
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
          <ul
            class="flex scrollbar-hide items-center gap-2 max-sm:overflow-x-auto sm:flex-wrap lg:justify-end"
            data-testid="model-tags"
          >
            <li v-for="tag in page.tags" :key="tag.search">
              <a
                :href="`${routes.workshop}${tag.search}`"
                class="hover:text-primary-comfy-yellow inline-flex h-7 shrink-0 items-center rounded-full bg-transparency-white-t8 px-3 text-xs/none whitespace-nowrap text-primary-comfy-canvas transition-colors hover:bg-transparency-white-t20"
              >
                {{ tag.label }}
              </a>
            </li>
          </ul>
          <p
            class="flex items-baseline gap-2 text-sm text-primary-comfy-canvas/60"
            data-testid="model-price"
          >
            {{
              page.priceEstimate
                ? t('workshop.model.estimatedPrice').replace(
                    '{price}',
                    page.priceEstimate
                  )
                : t('workshop.model.variablePrice')
            }}
          </p>
          <p v-if="page.priceEstimate" class="text-xs text-primary-warm-gray">
            {{ t('workshop.model.nodePriceDefaults') }}
          </p>
        </div>
      </div>

      <ModelStatus
        variant="banner"
        :status="page.model.status"
        :successor="
          page.successor
            ? { name: page.successor.name, href: page.successor.href }
            : undefined
        "
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
            class="text-primary-comfy-yellow inline-flex items-center gap-2 text-sm font-bold tracking-wider uppercase hover:underline"
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

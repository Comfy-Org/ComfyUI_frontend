<script setup lang="ts">
import { ChevronLeft } from '@lucide/vue'
import { computed } from 'vue'

import BrandButton from '@/components/common/BrandButton.vue'
import SectionHeader from '@/components/common/SectionHeader.vue'
import type { WorkshopModel } from '@/config/models-catalogue'
import { apiKeysLink, getRoutes } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { ACCESS_PARAM, runsHere } from '@/lib/workshop/explorer/model-access'
import { OPEN_WEIGHT_MODELS } from '@/lib/workshop/explorer/open-weight-models'
import { latestLaunch, modelsHubCounts } from '@/lib/workshop/models-hub'
import ModelExploreCard from './ModelExploreCard.vue'

const { models, locale = 'en' } = defineProps<{
  models: readonly WorkshopModel[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const routes = getRoutes(locale)
const runHref = `${routes.workshop}?${ACCESS_PARAM}=run`
const canRun = computed(() => models.some(runsHere))
const counts = computed(() => modelsHubCounts(models, OPEN_WEIGHT_MODELS))
const featured = computed(() => latestLaunch(models))
</script>

<template>
  <section
    class="mb-12 grid items-center gap-10 pt-8 max-sm:mb-8 max-sm:pt-5 lg:pt-12 xl:grid-cols-[minmax(0,1.025fr)_minmax(0,1fr)] xl:gap-16"
    data-testid="models-hub-hero"
  >
    <div class="flex min-w-0 flex-col items-start gap-6">
      <p
        class="-mb-2 flex items-center gap-1.5 text-sm font-medium tracking-widest text-primary-comfy-yellow uppercase"
      >
        <a
          :href="routes.hubExplore"
          class="group inline-flex items-center gap-1 rounded-lg outline-none hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
          data-testid="hub-back"
        >
          <ChevronLeft
            class="size-4 transition-transform group-hover:-translate-x-0.5"
            aria-hidden="true"
          />
          {{ t('workshop.catalogue.eyebrow') }}
        </a>
        <span aria-hidden="true">·</span>
        <span>{{ t('workshop.hero.eyebrow') }}</span>
      </p>
      <SectionHeader heading-tag="h1" heading-size="hero" align="start">
        <span class="block">{{
          `${t('workshop.modelsHub.titleFirstLine')} `
        }}</span>
        <span class="block">{{ t('workshop.modelsHub.titleSecondLine') }}</span>
      </SectionHeader>
      <p
        class="max-w-xl text-base/relaxed font-light text-primary-comfy-canvas lg:text-lg"
      >
        {{ t('workshop.modelsHub.subtitle') }}
      </p>
      <div
        class="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap"
      >
        <BrandButton
          v-if="canRun"
          :href="runHref"
          variant="solid"
          size="nav"
          class="justify-center uppercase"
          data-testid="models-hub-run"
        >
          {{ t('workshop.modelsHub.runModel') }}
        </BrandButton>
        <BrandButton
          :href="apiKeysLink({ onboarding: 'router' })"
          :variant="canRun ? 'outline' : 'solid'"
          size="nav"
          class="justify-center"
          data-testid="models-hub-api-key"
        >
          {{ t('workshop.modelsHub.getApiKey') }}
        </BrandButton>
      </div>
      <p
        class="text-sm text-primary-warm-gray tabular-nums"
        data-testid="models-hub-counts"
      >
        {{ t('workshop.modelsHub.counts', { ...counts }) }}
      </p>
    </div>

    <div v-if="featured" class="min-w-0" data-testid="models-hub-latest">
      <ModelExploreCard
        :model="featured"
        :badge="t('workshop.modelsHub.latestLaunch')"
        :locale
      />
    </div>
  </section>
</template>

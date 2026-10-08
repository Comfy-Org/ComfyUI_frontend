<script setup lang="ts">
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
import HubBreadcrumb from '@/components/workshop/HubBreadcrumb.vue'
import LatestLaunchCard from './LatestLaunchCard.vue'

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
      <HubBreadcrumb
        :crumbs="[
          {
            label: t('workshop.catalogue.eyebrow'),
            href: routes.hubExplore,
            testId: 'hub-back'
          },
          { label: t('workshop.hero.eyebrow') }
        ]"
        :locale
      />
      <SectionHeader heading-tag="h1" heading-size="hero" align="start">
        {{ t('workshop.hero.eyebrow') }}
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
          class="justify-center uppercase"
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
      <LatestLaunchCard :model="featured" :locale />
    </div>
  </section>
</template>

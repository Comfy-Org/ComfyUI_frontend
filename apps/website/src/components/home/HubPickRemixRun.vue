<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'

import Button from '@/components/ui/button/Button.vue'
import { getRoutes } from '@/config/routes'
import type { HubBannerTile } from '@/data/hubBanner'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import HubLaneLink from './HubLaneLink.vue'
import HubMarqueeRow from './HubMarqueeRow.vue'
import { useHubLanes } from './useHubLanes'

const { locale = 'en', rows } = defineProps<{
  locale?: Locale
  rows: readonly (readonly HubBannerTile[])[]
}>()
const { t } = translationsFor(locale)
const routes = getRoutes(locale)
const lanes = useHubLanes(locale)
</script>

<template>
  <section
    class="overflow-hidden py-16 lg:py-24"
    aria-labelledby="home-hub-heading"
    data-testid="home-hub-banner"
    data-design="pick-remix-run"
  >
    <div class="flex flex-col items-center px-4 text-center">
      <h2 id="home-hub-heading" class="sr-only">
        {{ t('homeHub.pickRemixRunHeading') }}
      </h2>
      <nav :aria-label="t('homeHub.sections')">
        <ul class="flex justify-center gap-2 sm:gap-3">
          <li v-for="lane in lanes" :key="lane.id">
            <HubLaneLink :lane :locale />
          </li>
        </ul>
      </nav>
      <p
        class="mt-8 max-w-md text-base/snug font-light text-primary-comfy-canvas/80 lg:text-lg/snug"
      >
        {{ t('homeHub.pickRemixRunSubtitle') }}
      </p>
      <Button
        :href="routes.hubExplore"
        size="lg"
        :append-icon="ChevronRight"
        class="mt-8"
      >
        {{ t('homeHub.explore') }}
      </Button>
    </div>

    <div
      class="group mt-12 flex flex-col gap-4 lg:mt-16"
      role="region"
      :aria-label="t('homeHub.showcase')"
    >
      <HubMarqueeRow
        v-for="(tiles, index) in rows"
        :key="index"
        :tiles
        :reverse="index % 2 === 1"
        :locale
      />
    </div>
  </section>
</template>

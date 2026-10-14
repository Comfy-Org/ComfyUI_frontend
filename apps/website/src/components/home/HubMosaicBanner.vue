<script setup lang="ts">
import { ArrowUpRight, ChevronRight } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import { getRoutes } from '@/config/routes'
import type { HubBannerTile } from '@/data/hubBanner'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { useHubLanes } from './useHubLanes'

const { locale = 'en', tiles } = defineProps<{
  locale?: Locale
  tiles: readonly HubBannerTile[]
}>()
const { t } = translationsFor(locale)
const routes = getRoutes(locale)
const lanes = useHubLanes(locale)
const openLanes = computed(() => lanes.value.filter((lane) => lane.open))

const COLUMNS = 3
const COLUMN_OFFSETS = ['-mt-16', 'mt-6', '-mt-6']
const columns = computed(() =>
  COLUMN_OFFSETS.map((offset, column) => ({
    offset,
    tiles: tiles.filter((_, index) => index % COLUMNS === column)
  }))
)
</script>

<template>
  <section
    class="px-4 py-16 lg:px-20 lg:py-24"
    aria-labelledby="home-hub-heading"
    data-testid="home-hub-banner"
    data-design="mosaic"
  >
    <div
      class="relative mx-auto flex max-w-7xl flex-col overflow-hidden rounded-4xl border border-transparency-white-t8 bg-transparency-white-t4 lg:min-h-144 lg:flex-row lg:rounded-5xl"
    >
      <div
        class="relative h-64 shrink-0 overflow-hidden mask-[linear-gradient(to_bottom,black_55%,transparent)] sm:h-80 lg:absolute lg:inset-y-0 lg:right-0 lg:h-auto lg:w-3/5 lg:mask-[linear-gradient(to_right,transparent,black_35%)]"
        aria-hidden="true"
      >
        <div
          class="absolute -inset-x-6 -top-10 grid -rotate-6 grid-cols-3 gap-3 lg:-inset-x-10 lg:-top-24 lg:gap-4"
        >
          <div
            v-for="column in columns"
            :key="column.offset"
            :class="cn('flex flex-col gap-3 lg:gap-4', column.offset)"
          >
            <img
              v-for="tile in column.tiles"
              :key="tile.href"
              :src="tile.imageUrl"
              alt=""
              class="aspect-4/3 w-full rounded-2xl object-cover select-none even:aspect-square lg:rounded-3xl"
              loading="lazy"
              decoding="async"
              draggable="false"
              data-testid="home-hub-mosaic-image"
            />
          </div>
        </div>
      </div>

      <div
        class="relative flex flex-col items-start px-6 pt-2 pb-10 lg:w-1/2 lg:justify-center lg:px-16 lg:py-20"
      >
        <p
          class="text-sm font-bold tracking-widest text-primary-comfy-yellow uppercase"
        >
          {{ t('homeHub.eyebrow') }}
        </p>
        <h2
          id="home-hub-heading"
          class="mt-4 max-w-sm text-4xl/none font-light whitespace-pre-line text-primary-warm-white lg:max-w-md lg:text-6xl/none"
        >
          {{ t('homeHub.heading') }}
        </h2>
        <p
          class="mt-5 max-w-md text-base/snug font-light text-primary-comfy-canvas/80 lg:text-lg/6"
        >
          {{ t('homeHub.subtitle') }}
        </p>
        <Button
          :href="routes.hubExplore"
          size="lg"
          :append-icon="ChevronRight"
          class="mt-8"
        >
          {{ t('homeHub.explore') }}
        </Button>
        <nav :aria-label="t('homeHub.sections')" class="mt-6">
          <ul class="flex flex-wrap gap-2.5">
            <li v-for="lane in openLanes" :key="lane.id">
              <a
                :href="lane.href"
                class="flex h-9 items-center gap-1.5 rounded-full border border-transparency-white-t20 px-4 text-sm text-primary-warm-white outline-none hover:border-primary-warm-white/60 hover:bg-transparency-white-t8 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 motion-safe:transition-colors"
              >
                {{ t(lane.label) }}
                <ArrowUpRight class="size-3.5" aria-hidden="true" />
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ArrowRight, ChevronRight } from '@lucide/vue'
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { getRoutes } from '@/config/routes'
import type { HubBannerContent } from '@/data/hubBanner'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { useHubLanes } from './useHubLanes'

const { locale = 'en', content } = defineProps<{
  locale?: Locale
  content: HubBannerContent
}>()
const { t } = translationsFor(locale)
const routes = getRoutes(locale)
const lanes = useHubLanes(locale)

const entries = computed(() =>
  lanes.value
    .filter((lane) => lane.open)
    .map((lane) => ({
      ...lane,
      imageUrl: content[lane.id][0]?.imageUrl
    }))
)
</script>

<template>
  <section
    class="px-4 py-16 lg:px-20 lg:py-24"
    aria-labelledby="home-hub-heading"
    data-testid="home-hub-banner"
    data-design="entries"
  >
    <div class="mx-auto flex max-w-7xl flex-col gap-10 lg:gap-14">
      <div
        class="flex flex-col items-start gap-6 lg:flex-row lg:items-end lg:justify-between"
      >
        <div class="flex flex-col gap-4">
          <p
            class="text-sm font-bold tracking-widest text-primary-comfy-yellow uppercase"
          >
            {{ t('homeHub.eyebrow') }}
          </p>
          <h2
            id="home-hub-heading"
            class="text-4xl/tight font-light text-primary-warm-white lg:text-6xl/tight"
          >
            {{ t('homeHub.heading') }}
          </h2>
          <p
            class="max-w-2xl text-base/snug font-light text-primary-comfy-canvas/80 lg:text-lg/6"
          >
            {{ t('homeHub.subtitle') }}
          </p>
        </div>
        <Button
          :href="routes.hubExplore"
          size="lg"
          :append-icon="ChevronRight"
          class="shrink-0"
        >
          {{ t('homeHub.explore') }}
        </Button>
      </div>

      <nav :aria-label="t('homeHub.sections')">
        <ul
          class="grid gap-8 md:auto-cols-fr md:grid-flow-col md:grid-rows-[auto_auto_1fr_auto] md:gap-x-6 md:gap-y-0"
        >
          <li
            v-for="entry in entries"
            :key="entry.id"
            class="md:row-span-4 md:grid md:grid-rows-subgrid"
            :data-testid="`home-hub-entry-${entry.id}`"
          >
            <a
              :href="entry.href"
              class="group flex flex-col gap-3 rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 md:row-span-4 md:grid md:grid-rows-subgrid md:gap-0"
            >
              <span
                class="mb-3 block aspect-16/10 overflow-hidden rounded-2xl bg-transparency-white-t4 md:mb-5"
              >
                <img
                  v-if="entry.imageUrl"
                  :src="entry.imageUrl"
                  alt=""
                  class="size-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-105"
                  loading="lazy"
                  decoding="async"
                  data-testid="home-hub-entry-image"
                />
              </span>
              <span
                class="text-2xl font-light text-primary-warm-white lg:text-3xl"
              >
                {{ t(`homeHub.entries.${entry.id}.title`) }}
              </span>
              <span
                class="text-base/snug font-light text-primary-comfy-canvas/80 md:mt-2"
              >
                {{ t(`homeHub.entries.${entry.id}.line`) }}
              </span>
              <span
                class="inline-flex items-center gap-1.5 text-sm font-bold tracking-wider text-primary-comfy-yellow uppercase md:mt-4"
              >
                {{ t(`homeHub.entries.${entry.id}.seeAll`) }}
                <ArrowRight
                  class="size-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </span>
            </a>
          </li>
        </ul>
      </nav>
    </div>
  </section>
</template>

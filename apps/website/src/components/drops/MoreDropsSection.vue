<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { DropItem } from './dropItems'
import type { Locale } from '../../i18n/translations'

import { getRoutes } from '../../config/routes'
import { t } from '../../i18n/translations'
import BrandButton from '../common/BrandButton.vue'
import { dropItems, resolveDropHref } from './dropItems'
import { captureDropClick } from './useDropClickCapture'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)

function hrefFor(item: DropItem): string {
  return resolveDropHref(item, routes)
}

function handleClick(item: DropItem) {
  captureDropClick('more_drops', {
    drop_id: item.id,
    href: hrefFor(item),
    external: item.external
  })
}
</script>

<template>
  <section
    id="more-drops"
    class="border-t border-primary-comfy-canvas/10 px-6 py-20 md:px-20 md:py-28"
    data-testid="drops-more-drops"
  >
    <div class="mx-auto max-w-6xl text-center">
      <p
        class="text-sm tracking-widest text-primary-comfy-canvas/60 uppercase md:text-base"
      >
        {{ t('drops-landing.moreDrops.eyebrow', locale) }}
      </p>
      <h2
        class="text-primary-comfy-yellow mt-2 text-4xl font-bold tracking-tight uppercase md:text-6xl"
      >
        {{ t('drops-landing.moreDrops.headingAccent', locale) }}
      </h2>
    </div>

    <ul class="mx-auto mt-16 flex max-w-6xl flex-col gap-8 md:gap-12">
      <li
        v-for="(item, index) in dropItems"
        :key="item.id"
        class="bg-transparency-white-t4 grid grid-cols-1 gap-8 overflow-hidden rounded-4xl border border-primary-comfy-canvas/10 md:gap-12 lg:grid-cols-5"
        :data-testid="`drops-item-${item.id}`"
      >
        <div
          :class="
            cn(
              'flex aspect-video items-center justify-center overflow-hidden bg-primary-comfy-ink/40 p-8 lg:col-span-2 lg:aspect-auto',
              index % 2 === 1 && 'lg:order-2'
            )
          "
        >
          <img
            :src="item.imageUrl"
            :alt="t(item.titleKey, locale)"
            class="max-h-72 max-w-full object-contain"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div
          class="flex flex-col justify-center gap-5 p-8 md:p-10 lg:col-span-3"
        >
          <h3 class="text-3xl font-light text-primary-comfy-canvas md:text-4xl">
            {{ t(item.titleKey, locale) }}
          </h3>
          <p class="text-primary-comfy-yellow text-lg font-light md:text-xl">
            {{ t(item.taglineKey, locale) }}
          </p>
          <p class="text-base text-primary-comfy-canvas/70">
            {{ t(item.bodyKey, locale) }}
          </p>
          <div class="mt-2">
            <BrandButton
              :href="hrefFor(item)"
              :target="item.external ? '_blank' : undefined"
              :rel="item.external ? 'noopener noreferrer' : undefined"
              size="md"
              :data-testid="`drops-item-${item.id}-cta`"
              class="px-6 py-3 text-sm"
              @click="handleClick(item)"
            >
              {{ t(item.ctaKey, locale) }}
            </BrandButton>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>

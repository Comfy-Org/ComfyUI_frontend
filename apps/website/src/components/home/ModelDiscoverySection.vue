<script setup lang="ts">
import { ref } from 'vue'

import { getRoutes } from '../../config/routes'
import { discoveryProviders } from '../../data/modelDiscovery'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import BrandButton from '../common/BrandButton.vue'
import StaticFrame from '../workshop/StaticFrame.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const routes = getRoutes(locale)

// Thumbnails are fetched the first time a card is hovered or focused, so the
// looping row does not pull every preview on page load.
const revealed = ref<Set<string>>(new Set())
function reveal(name: string) {
  revealed.value = new Set(revealed.value).add(name)
}

const cardHref = (name: string) =>
  `${routes.workshop}?provider=${encodeURIComponent(name)}`

const cardClass =
  'group/card bg-transparency-white-t4 relative flex h-44 w-48 shrink-0 flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl border border-transparency-white-t8 px-5 text-center text-primary-warm-white transition-colors hover:border-transparency-white-t20 focus-visible:border-primary-comfy-yellow focus-visible:outline-none'
</script>

<template>
  <section
    class="max-w-9xl mx-auto overflow-hidden py-16 lg:py-24"
    data-testid="model-discovery"
  >
    <div class="mx-auto flex max-w-3xl flex-col items-center px-6 text-center">
      <p
        class="text-primary-comfy-yellow text-sm font-bold tracking-widest uppercase"
      >
        {{ t('modelDiscovery.label', locale) }}
      </p>
      <h2
        class="text-3.5xl/tight mt-6 font-light whitespace-pre-line text-primary-comfy-canvas lg:text-5xl"
      >
        {{ t('modelDiscovery.heading', locale) }}
      </h2>
      <p
        class="mt-6 max-w-xl text-sm font-light text-primary-comfy-canvas/80 lg:text-base/snug"
      >
        {{ t('modelDiscovery.subtitle', locale) }}
      </p>
    </div>

    <div
      class="mt-12 px-6 lg:mt-16 lg:px-12"
      :aria-label="t('modelDiscovery.rowLabel', locale)"
      role="region"
    >
      <div class="overflow-hidden">
        <div class="group flex w-max gap-3">
          <div
            v-for="copy in 2"
            :key="copy"
            class="animate-marquee flex shrink-0 gap-3 group-focus-within:[animation-play-state:paused] group-hover:[animation-play-state:paused]"
            style="--marquee-gap: 0.75rem"
            :aria-hidden="copy === 2 ? 'true' : undefined"
          >
            <a
              v-for="provider in discoveryProviders"
              :key="provider.name"
              :href="cardHref(provider.name)"
              :class="cardClass"
              :tabindex="copy === 2 ? -1 : undefined"
              data-testid="discovery-provider"
              @pointerenter="reveal(provider.name)"
              @focus="reveal(provider.name)"
            >
              <template
                v-if="revealed.has(provider.name) && provider.thumbnailUrl"
              >
                <StaticFrame
                  :src="provider.thumbnailUrl"
                  class="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-300 group-hover/card:opacity-50 group-focus-visible/card:opacity-50"
                />
                <span
                  class="absolute inset-0 bg-black/60 opacity-0 transition-opacity duration-300 group-hover/card:opacity-100 group-focus-visible/card:opacity-100"
                  aria-hidden="true"
                />
              </template>
              <span
                class="relative size-9 bg-current mask-contain mask-center mask-no-repeat"
                :style="{ maskImage: `url(${provider.logo})` }"
                aria-hidden="true"
              />
              <span class="relative flex flex-col gap-0.5">
                <span class="text-base/tight font-medium">
                  {{ provider.name }}
                </span>
              </span>
            </a>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-12 flex justify-center px-6 lg:mt-16">
      <BrandButton :href="routes.workshop" variant="outline" size="xs">
        {{ t('modelDiscovery.browse', locale) }}
      </BrandButton>
    </div>
  </section>
</template>

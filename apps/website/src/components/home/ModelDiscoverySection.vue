<script setup lang="ts">
import { ref } from 'vue'

import { catalogSearch } from '../../config/models-catalogue'
import { getRoutes } from '../../config/routes'
import type { DiscoveryProvider } from '../../data/modelDiscovery'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import Button from '../ui/button/Button.vue'
import StaticFrame from '../workshop/StaticFrame.vue'
import WorkshopGate from '../workshop/WorkshopGate.vue'

const { locale = 'en', providers } = defineProps<{
  locale?: Locale
  providers: readonly DiscoveryProvider[]
}>()
const routes = getRoutes(locale)

// Thumbnails are fetched the first time a card is hovered or focused, so the
// looping row does not pull every preview on page load.
const revealed = ref<Set<string>>(new Set())
function reveal(name: string) {
  revealed.value = new Set(revealed.value).add(name)
}

const cardHref = (name: string) =>
  `${routes.workshop}${catalogSearch({ query: name })}`

const cardClass =
  'group/card bg-transparency-white-t4 relative flex h-44 w-48 shrink-0 flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl border border-transparency-white-t8 px-5 text-center text-primary-warm-white transition-colors hover:border-transparency-white-t20 focus-visible:border-primary-comfy-yellow focus-visible:outline-none'
</script>

<template>
  <WorkshopGate>
    <section
      class="overflow-hidden py-16 lg:py-24"
      data-testid="model-discovery"
    >
      <div
        class="mx-auto flex max-w-3xl flex-col items-center px-6 text-center"
      >
        <p
          class="text-sm font-bold tracking-widest text-primary-comfy-yellow uppercase"
        >
          {{ t('modelDiscovery.label', locale) }}
        </p>
        <h2
          class="mt-6 text-3.5xl/tight font-light whitespace-pre-line text-primary-comfy-canvas lg:text-5xl"
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
        class="mt-12 lg:mt-16"
        :aria-label="t('modelDiscovery.rowLabel', locale)"
        role="region"
      >
        <div
          class="overflow-hidden mask-[linear-gradient(to_right,transparent,black_2rem,black_calc(100%-2rem),transparent)]"
        >
          <div class="group flex w-max gap-3">
            <div
              v-for="copy in 2"
              :key="copy"
              class="flex shrink-0 animate-marquee gap-3 group-focus-within:paused group-hover:paused"
              style="--marquee-gap: 0.75rem"
              :aria-hidden="copy === 2 ? 'true' : undefined"
            >
              <a
                v-for="provider in providers"
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
        <Button as="a" :href="routes.workshop" variant="outline">
          {{ t('modelDiscovery.browse', locale) }}
        </Button>
      </div>
    </section>
  </WorkshopGate>
</template>

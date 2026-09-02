<script setup lang="ts">
import { getRoutes } from '../../config/routes'
import { discoveryModels } from '../../data/modelDiscovery'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import BrandButton from '../common/BrandButton.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const routes = getRoutes(locale)

const cardClass =
  'flex h-44 w-52 shrink-0 flex-col items-center justify-center gap-3 rounded-3xl bg-primary-warm-white px-5 text-center text-primary-comfy-ink transition-colors hover:bg-primary-comfy-yellow focus-visible:bg-primary-comfy-yellow focus-visible:outline-none'
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
      class="group mt-12 flex w-max gap-3 lg:mt-16"
      :aria-label="t('modelDiscovery.rowLabel', locale)"
      role="region"
    >
      <div
        v-for="copy in 2"
        :key="copy"
        class="animate-marquee flex shrink-0 gap-3 group-focus-within:[animation-play-state:paused] group-hover:[animation-play-state:paused]"
        style="--marquee-gap: 0.75rem"
        :aria-hidden="copy === 2 ? 'true' : undefined"
      >
        <a
          v-for="{ model, logo } in discoveryModels"
          :key="model.slug"
          :href="model.href"
          :class="cardClass"
          :tabindex="copy === 2 ? -1 : undefined"
        >
          <img
            v-if="logo"
            :src="logo"
            alt=""
            class="size-9 object-contain"
            loading="lazy"
          />
          <span
            v-else
            class="grid size-9 place-items-center rounded-xl bg-primary-comfy-ink/8 text-base font-bold"
            aria-hidden="true"
          >
            {{ model.name[0] }}
          </span>
          <span class="flex flex-col gap-0.5">
            <span class="text-base/tight font-medium">{{ model.name }}</span>
            <span class="text-xs text-primary-comfy-ink/60">
              {{ model.provider ?? t('workshop.card.partnerNode', locale) }}
            </span>
          </span>
        </a>
      </div>
    </div>

    <div class="mt-12 flex justify-center px-6 lg:mt-16">
      <BrandButton :href="routes.workshop" variant="outline" size="xs">
        {{ t('modelDiscovery.browse', locale) }}
      </BrandButton>
    </div>
  </section>
</template>

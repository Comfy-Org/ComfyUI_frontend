<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'

import type { Locale } from '../../i18n/translations'

import NodeTag from '../../components/common/NodeTag.vue'
import IconButton from '../../components/ui/icon-button/IconButton.vue'
import { seedanceModels } from '../../data/seedance'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-4 py-16 lg:px-20 lg:py-24">
    <div class="mx-auto flex max-w-3xl flex-col items-center text-center">
      <p
        class="text-primary-comfy-yellow text-sm font-bold tracking-widest uppercase"
      >
        {{ t('seedance.models.eyebrow', locale) }}
      </p>
      <h2
        class="mt-6 text-3xl font-light tracking-tight text-primary-comfy-canvas lg:text-5xl/tight"
      >
        {{ t('seedance.models.heading', locale) }}
      </h2>
      <p class="mt-6 max-w-md text-sm font-light text-primary-comfy-canvas/70">
        {{ t('seedance.models.subtitle', locale) }}
      </p>
    </div>

    <div
      class="mx-auto mt-16 grid max-w-7xl grid-cols-1 gap-x-6 gap-y-10 md:grid-cols-2"
    >
      <article v-for="model in seedanceModels" :key="model.id">
        <div
          class="group rounded-4.5xl relative block aspect-19/10 overflow-hidden bg-black/40"
        >
          <video
            v-if="model.imageSrc.endsWith('.webm')"
            :src="model.imageSrc"
            :aria-label="model.name"
            class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            autoplay
            loop
            muted
            playsinline
          />
          <img
            v-else
            :src="model.imageSrc"
            :alt="model.name"
            class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />

          <div
            class="absolute inset-0 bg-linear-to-b from-black/25 to-transparent"
          />

          <div
            class="absolute inset-x-8 top-8 flex items-start justify-between"
          >
            <h3
              class="text-primary-warm-white text-3xl/tight font-medium drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
            >
              {{ model.name }}
            </h3>
            <div
              class="group-hover:bg-primary-comfy-yellow flex size-10 items-center justify-center rounded-2xl bg-white/20 text-white backdrop-blur-sm transition-colors group-hover:text-primary-comfy-ink"
            >
              <span
                class="inline-block size-6 bg-current"
                :style="{
                  maskImage: `url(${model.logoSrc})`,
                  maskSize: 'contain',
                  maskRepeat: 'no-repeat',
                  maskPosition: 'center'
                }"
              />
            </div>
          </div>
        </div>

        <div class="mt-5 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <NodeTag
              :class="
                model.tier === 'free'
                  ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
                  : 'bg-primary-comfy-plum text-primary-warm-white'
              "
            >
              {{
                model.tier === 'free'
                  ? t('seedance.models.tagFree', locale)
                  : t('seedance.models.tagPremium', locale)
              }}
            </NodeTag>
            <span class="text-primary-warm-gray text-xs">
              {{ model.note[locale] }}
            </span>
          </div>

          <IconButton
            as="a"
            :href="model.href"
            target="_blank"
            rel="noopener"
            :aria-label="model.name"
            size="sm"
            class="bg-primary-warm-gray hover:bg-primary-comfy-yellow rounded-xl text-primary-comfy-ink hover:text-primary-comfy-ink"
          >
            <ChevronRight class="size-5" :stroke-width="2" />
          </IconButton>
        </div>

        <p class="mt-3 text-sm font-light text-primary-comfy-canvas">
          {{ model.description[locale] }}
        </p>
      </article>
    </div>
  </section>
</template>

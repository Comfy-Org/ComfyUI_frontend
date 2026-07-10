<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { externalLinks } from '../../config/routes'
import BrandButton from '../../components/common/BrandButton.vue'
import MediaCarousel from '../../components/common/MediaCarousel.vue'
import { seedanceExamples } from '../../data/seedance'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-12 lg:px-20 lg:py-16">
    <h2
      class="text-center text-3xl font-light tracking-tight text-primary-comfy-canvas lg:text-5xl/tight"
    >
      {{ t('seedance.showcase.heading', locale) }}
    </h2>

    <MediaCarousel
      class="mt-12"
      :prev-label="t('seedance.showcase.prev', locale)"
      :next-label="t('seedance.showcase.next', locale)"
    >
      <div
        v-for="example in seedanceExamples"
        :key="example.id"
        class="w-full shrink-0 snap-start"
      >
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">
          <div
            class="rounded-5xl border-primary-comfy-yellow relative flex w-full flex-col gap-10 self-start border-2 bg-primary-comfy-canvas/8 p-8 lg:w-[520px] lg:shrink-0"
          >
            <div class="flex flex-col gap-4">
              <p class="text-xl font-medium text-primary-comfy-canvas">
                {{ t('seedance.showcase.promptLabel', locale) }}
              </p>
              <p
                class="text-xs/relaxed font-semibold text-primary-comfy-canvas/90"
              >
                {{ example.prompt[locale] }}
              </p>
            </div>
            <BrandButton
              :href="externalLinks.workflows"
              target="_blank"
              variant="solid"
              size="sm"
              class="self-start"
            >
              {{ t('seedance.showcase.cta', locale) }}
            </BrandButton>

            <img
              src="/icons/node-link.svg"
              alt=""
              aria-hidden="true"
              class="absolute top-1/2 left-full z-10 hidden h-8 w-5 -translate-y-1/2 lg:block"
            />
          </div>

          <div
            class="rounded-5xl border-primary-warm-gray flex flex-1 items-center justify-center self-stretch border-2 bg-primary-comfy-ink p-2"
          >
            <video
              v-if="example.imageSrc.endsWith('.webm')"
              :src="example.imageSrc"
              :aria-label="example.imageAlt[locale]"
              class="aspect-video w-full rounded-4xl object-cover"
              autoplay
              loop
              muted
              playsinline
            />
            <img
              v-else
              :src="example.imageSrc"
              :alt="example.imageAlt[locale]"
              class="aspect-video w-full rounded-4xl object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      </div>
    </MediaCarousel>
  </section>
</template>

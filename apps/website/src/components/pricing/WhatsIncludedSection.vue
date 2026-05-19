<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

interface IncludedFeature {
  titleKey: TranslationKey
  descriptionKey: TranslationKey
  isComingSoon?: boolean
}

const features: IncludedFeature[] = [
  {
    titleKey: 'pricing.included.feature1.title',
    descriptionKey: 'pricing.included.feature1.description'
  },
  {
    titleKey: 'pricing.included.feature2.title',
    descriptionKey: 'pricing.included.feature2.description'
  },
  {
    titleKey: 'pricing.included.feature3.title',
    descriptionKey: 'pricing.included.feature3.description'
  },
  {
    titleKey: 'pricing.included.feature4.title',
    descriptionKey: 'pricing.included.feature4.description'
  },
  {
    titleKey: 'pricing.included.feature5.title',
    descriptionKey: 'pricing.included.feature5.description'
  },
  {
    titleKey: 'pricing.included.feature6.title',
    descriptionKey: 'pricing.included.feature6.description'
  },
  {
    titleKey: 'pricing.included.feature7.title',
    descriptionKey: 'pricing.included.feature7.description'
  },
  {
    titleKey: 'pricing.included.feature8.title',
    descriptionKey: 'pricing.included.feature8.description'
  },
  {
    titleKey: 'pricing.included.feature9.title',
    descriptionKey: 'pricing.included.feature9.description'
  },
  {
    titleKey: 'pricing.included.feature10.title',
    descriptionKey: 'pricing.included.feature10.description'
  },
  {
    titleKey: 'pricing.included.feature11.title',
    descriptionKey: 'pricing.included.feature11.description',
    isComingSoon: true
  }
]
</script>

<template>
  <section class="px-4 py-16 lg:px-20 lg:py-24">
    <div class="mx-auto w-full lg:grid lg:grid-cols-[280px_1fr] lg:gap-x-16">
      <!-- Heading -->
      <div
        class="bg-primary-comfy-ink sticky top-20 mb-10 py-2 lg:top-28 lg:mb-0 lg:self-start"
      >
        <h2
          class="text-primary-comfy-canvas text-3xl/tight font-light whitespace-pre-line"
        >
          {{ t('pricing.included.heading', locale) }}
        </h2>
      </div>

      <!-- Features list -->
      <div>
        <div
          v-for="(feature, index) in features"
          :key="feature.titleKey"
          :class="
            index < features.length - 1
              ? 'border-primary-comfy-canvas/15 border-b border-solid'
              : ''
          "
          class="py-8 first:pt-0 lg:grid lg:grid-cols-[200px_1fr] lg:gap-x-10"
        >
          <!-- Title -->
          <div class="flex items-start gap-3">
            <img
              v-if="feature.isComingSoon"
              src="/icons/clock.svg"
              alt=""
              class="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <img
              v-else
              src="/icons/check.svg"
              alt=""
              class="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <p class="text-primary-comfy-canvas text-sm font-medium">
              {{ t(feature.titleKey, locale) }}
            </p>
          </div>

          <!-- Description -->
          <p
            class="text-primary-comfy-canvas/55 mt-3 text-sm/relaxed lg:mt-0"
            v-html="t(feature.descriptionKey, locale)"
          />
        </div>
      </div>
    </div>
  </section>
</template>

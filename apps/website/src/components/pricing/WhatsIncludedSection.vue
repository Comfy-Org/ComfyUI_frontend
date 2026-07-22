<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'
import { Clock } from '@lucide/vue'

import { t } from '../../i18n/translations'
import CheckIcon from '../icons/CheckIcon.vue'

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
    descriptionKey: 'pricing.included.feature11.description'
  }
]
</script>

<template>
  <section class="max-w-9xl mx-auto px-4 py-16 lg:px-20 lg:py-24">
    <div class="mx-auto w-full lg:grid lg:grid-cols-[280px_1fr] lg:gap-x-16">
      <!-- Heading -->
      <div
        class="sticky top-20 mb-10 bg-primary-comfy-ink py-2 lg:top-28 lg:mb-0 lg:self-start"
      >
        <h2
          class="text-3xl/tight font-light whitespace-pre-line text-primary-comfy-canvas"
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
              ? 'border-b border-solid border-primary-comfy-canvas/15'
              : ''
          "
          class="py-8 first:pt-0 lg:grid lg:grid-cols-[200px_1fr] lg:gap-x-10"
        >
          <!-- Title -->
          <div class="flex items-start gap-3">
            <Clock
              v-if="feature.isComingSoon"
              class="mt-0.5 size-4 shrink-0 text-primary-comfy-canvas/55"
              aria-hidden="true"
            />
            <CheckIcon
              v-else
              class="text-primary-comfy-yellow mt-0.5 size-4 shrink-0"
            />
            <p class="text-sm font-medium text-primary-comfy-canvas">
              {{ t(feature.titleKey, locale) }}
              <span
                v-if="feature.isComingSoon"
                class="block text-primary-comfy-canvas/55"
              >
                {{ t('pricing.included.comingSoon', locale) }}
              </span>
            </p>
          </div>

          <!-- Description -->
          <p
            class="mt-3 text-sm/relaxed text-primary-comfy-canvas/55 lg:mt-0"
            v-html="t(feature.descriptionKey, locale)"
          />
        </div>
      </div>
    </div>
  </section>
</template>

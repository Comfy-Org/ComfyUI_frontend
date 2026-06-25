<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import BrandButton from './BrandButton.vue'

const {
  locale = 'en',
  headingKey,
  primaryLabelKey,
  primaryHref,
  secondaryLabelKey,
  secondaryHref
} = defineProps<{
  locale?: Locale
  headingKey: TranslationKey
  primaryLabelKey: TranslationKey
  primaryHref?: string
  secondaryLabelKey?: TranslationKey
  secondaryHref?: string
}>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-20 lg:py-32">
    <div class="flex flex-col items-center text-center">
      <h2
        class="max-w-5xl text-3xl font-light tracking-tight text-primary-comfy-canvas lg:text-5xl"
      >
        {{ t(headingKey, locale) }}
      </h2>
      <div class="mt-10 flex flex-wrap items-center justify-center gap-3">
        <BrandButton
          :href="primaryHref"
          variant="solid"
          size="xs"
          class="uppercase"
        >
          {{ t(primaryLabelKey, locale) }}
        </BrandButton>
        <BrandButton
          v-if="secondaryLabelKey"
          :href="secondaryHref"
          variant="outline"
          size="xs"
          class="uppercase"
        >
          {{ t(secondaryLabelKey, locale) }}
        </BrandButton>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Locale, TranslationKey } from '../../../i18n/translations'

import { t } from '../../../i18n/translations'

export interface Reason {
  titleKey: TranslationKey
  descriptionKey: TranslationKey
}

const {
  locale = 'en',
  headingKey,
  headingHighlightKey,
  headingSuffixKey,
  subtitleKey,
  highlightClass = 'text-white',
  reasons
} = defineProps<{
  locale?: Locale
  headingKey: TranslationKey
  headingHighlightKey?: TranslationKey
  headingSuffixKey?: TranslationKey
  subtitleKey?: TranslationKey
  highlightClass?: string
  reasons: Reason[]
}>()
</script>

<template>
  <section
    class="flex flex-col gap-4 px-4 py-24 lg:flex-row lg:gap-16 lg:px-20 lg:py-40"
  >
    <!-- Left heading -->
    <div
      class="bg-primary-comfy-ink sticky top-20 z-10 w-full shrink-0 self-start py-4 lg:top-28 lg:w-115 lg:py-0"
    >
      <h2
        class="text-primary-comfy-canvas text-4xl/16 font-light whitespace-pre-line lg:text-5xl/16"
      >
        {{ t(headingKey, locale)
        }}<span v-if="headingHighlightKey" :class="highlightClass">{{
          t(headingHighlightKey, locale)
        }}</span
        ><template v-if="headingSuffixKey">{{
          t(headingSuffixKey, locale)
        }}</template>
      </h2>
      <p v-if="subtitleKey" class="text-primary-comfy-canvas/70 mt-6 text-sm">
        {{ t(subtitleKey, locale) }}
      </p>
    </div>

    <!-- Right reasons list -->
    <div class="flex-1">
      <div
        v-for="reason in reasons"
        :key="reason.titleKey"
        class="border-primary-comfy-canvas/20 flex flex-col gap-4 border-b py-10 first:pt-0 lg:flex-row lg:gap-12"
      >
        <div class="shrink-0 lg:w-52">
          <h3
            class="text-primary-comfy-canvas text-2xl font-light whitespace-pre-line"
          >
            {{ t(reason.titleKey, locale) }}
          </h3>
          <slot name="reason-extra" :reason="reason" />
        </div>
        <p class="text-primary-comfy-canvas/70 flex-1 text-sm">
          {{ t(reason.descriptionKey, locale) }}
        </p>
      </div>
    </div>
  </section>
</template>

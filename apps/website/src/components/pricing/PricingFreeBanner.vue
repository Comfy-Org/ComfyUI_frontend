<script setup lang="ts">
import type { AnchorHTMLAttributes } from 'vue'

import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import BrandButton from '../common/BrandButton.vue'

const { locale = 'en' } = defineProps<{
  titleKey: TranslationKey
  subtitleKey: TranslationKey
  cta: {
    labelKey: TranslationKey
    href: string
    target?: AnchorHTMLAttributes['target']
  }
  locale?: Locale
}>()
</script>

<template>
  <div
    class="bg-primary-comfy-ink-light mb-4 flex flex-col gap-4 rounded-3xl px-8 py-6 sm:flex-row sm:items-center sm:justify-between"
  >
    <div>
      <p class="text-lg font-bold text-primary-comfy-canvas">
        {{ t(titleKey, locale) }}
      </p>
      <p class="mt-1 text-sm text-primary-comfy-canvas">
        {{ t(subtitleKey, locale) }}
      </p>
    </div>
    <BrandButton
      :href="cta.href"
      :target="cta.target"
      variant="outline"
      size="xs"
      class="shrink-0 self-start sm:self-auto"
    >
      {{ t(cta.labelKey, locale) }}
    </BrandButton>
  </div>
</template>

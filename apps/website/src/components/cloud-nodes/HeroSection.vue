<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { translationsFor } from '../../i18n/translations'
import SectionLabel from '../common/SectionLabel.vue'

const { locale = 'en' } = defineProps<{
  locale?: Locale
}>()
const { t } = translationsFor(locale)
</script>

<template>
  <section class="px-6 pt-24 pb-14 md:px-20 md:pt-32 md:pb-20">
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-7">
      <SectionLabel>
        {{ t('cloudNodes.hero.label') }}
      </SectionLabel>

      <h1
        class="max-w-4xl text-4xl/tight text-primary-comfy-canvas md:text-6xl"
      >
        {{ t('cloudNodes.hero.heading') }}
      </h1>

      <p class="max-w-3xl text-base/relaxed text-primary-warm-gray md:text-lg">
        {{ t('cloudNodes.hero.body') }}
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import SectionLabel from '../common/SectionLabel.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="px-6 pt-20 pb-16 md:pt-28 md:pb-24">
    <div class="mx-auto max-w-4xl text-center">
      <SectionLabel>
        {{ t('affiliate.hero.label', locale) }}
      </SectionLabel>
      <h1
        class="text-primary-comfy-canvas mt-4 text-4xl font-light whitespace-pre-line md:text-6xl"
      >
        {{ t('affiliate.hero.heading', locale) }}
      </h1>
      <p
        class="text-primary-comfy-canvas mx-auto mt-6 max-w-2xl text-base/relaxed"
      >
        {{ t('affiliate.hero.body', locale) }}
      </p>
    </div>
  </section>
</template>

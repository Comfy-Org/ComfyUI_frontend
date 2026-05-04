<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import SectionLabel from '../common/SectionLabel.vue'

const { locale = 'en' } = defineProps<{
  locale?: Locale
}>()
</script>

<template>
  <section class="px-6 pt-24 pb-14 md:px-20 md:pt-32 md:pb-20">
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-7">
      <SectionLabel>
        {{ t('cloudNodes.hero.label', locale) }}
      </SectionLabel>

      <h1
        class="text-primary-comfy-canvas max-w-4xl text-4xl/tight md:text-6xl"
      >
        {{ t('cloudNodes.hero.heading', locale) }}
      </h1>

      <p
        class="text-primary-warm-gray max-w-3xl text-base/relaxed md:text-lg"
      >
        {{ t('cloudNodes.hero.body', locale) }}
      </p>
    </div>
  </section>
</template>

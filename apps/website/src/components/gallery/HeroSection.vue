<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import SectionLabel from '../common/SectionLabel.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section
    class="max-w-9xl mx-auto flex flex-col items-center px-6 pt-36 pb-16 text-center"
  >
    <SectionLabel>
      {{ t('gallery.label', locale) }}
    </SectionLabel>
    <h1
      class="mt-4 max-w-3xl text-3xl font-light tracking-tight text-primary-comfy-canvas lg:text-5xl"
    >
      {{ t('gallery.heroTitle.before', locale) }}
      <span class="text-primary-comfy-yellow">ComfyUI</span>
    </h1>
    <p class="mt-4 max-w-lg text-sm text-primary-comfy-canvas lg:text-base">
      {{ t('gallery.heroSubtitle', locale) }}
    </p>
  </section>
</template>

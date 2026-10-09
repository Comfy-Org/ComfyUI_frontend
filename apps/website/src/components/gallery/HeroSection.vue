<script setup lang="ts">
import type { Locale } from '@/i18n/translations'

import { translationsFor } from '@/i18n/translations'
import SectionLabel from '@/components/common/SectionLabel.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)
</script>

<template>
  <section
    class="mx-auto flex max-w-9xl flex-col items-center px-6 pt-36 pb-16 text-center"
  >
    <SectionLabel>
      {{ t('gallery.label') }}
    </SectionLabel>
    <h1
      class="mt-4 max-w-3xl text-3xl font-light tracking-tight text-primary-comfy-canvas lg:text-5xl"
    >
      {{ t('gallery.heroTitleBefore')
      }}<span class="text-primary-comfy-yellow">ComfyUI</span
      >{{ t('gallery.heroTitleAfter') }}
    </h1>
    <p class="mt-4 max-w-lg text-sm text-primary-comfy-canvas lg:text-base">
      {{ t('gallery.heroSubtitle') }}
    </p>
  </section>
</template>

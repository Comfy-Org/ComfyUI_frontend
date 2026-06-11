<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section
    class="max-w-9xl mx-auto flex flex-col items-center px-6 pt-24 pb-12 text-center"
  >
    <h1
      class="text-primary-comfy-canvas max-w-4xl text-3xl leading-[110%] font-light tracking-tight lg:text-5xl"
    >
      {{ t('learning.heroTitle.before', locale) }}
      <span class="text-primary-comfy-yellow">ComfyUI</span
      >{{ t('learning.heroTitle.after', locale) }}
      <br />
      {{ t('learning.heroTitle.line2', locale) }}
    </h1>
  </section>
</template>

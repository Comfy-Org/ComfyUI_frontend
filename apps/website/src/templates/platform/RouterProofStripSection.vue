<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section
    class="max-w-9xl mx-auto flex flex-col items-center gap-4 px-6 py-8 text-center lg:py-10"
    :aria-label="t('platform.router.proofStrip.ariaLabel', locale)"
  >
    <p
      class="text-lg font-medium tracking-wide text-primary-comfy-canvas/70 lg:text-xl"
    >
      {{ t('platform.router.proofStrip.logos', locale) }}
    </p>
    <p class="max-w-2xl text-xs text-primary-comfy-canvas/60">
      {{ t('platform.router.proofStrip.line', locale) }}
    </p>
  </section>
</template>

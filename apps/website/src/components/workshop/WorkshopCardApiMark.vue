<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <span
    class="pointer-events-none absolute top-4 right-4 z-10 inline-flex h-6 items-center rounded-lg bg-black/45 px-2 text-2xs/4 font-semibold text-primary-comfy-orange backdrop-blur-md"
    data-testid="model-card-comfy-api"
  >
    {{ t('workshop.card.comfyApi', locale) }}
  </span>
</template>

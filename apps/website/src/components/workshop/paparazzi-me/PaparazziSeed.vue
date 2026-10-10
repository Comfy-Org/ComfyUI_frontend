<script setup lang="ts">
import type { PaparazziMe } from '@/composables/usePaparazziMe'
import type { Locale } from '@/i18n/translations'
import { pc } from '@/lib/workshop/paparazzi-me/copy'
import EditorSeedField from '@/components/workshop/app-editor/EditorSeedField.vue'

const { paparazzi, locale = 'en' } = defineProps<{
  paparazzi: PaparazziMe
  locale?: Locale
}>()

const { setup } = paparazzi
</script>

<template>
  <EditorSeedField
    :model-value="setup.seed"
    :label="pc('paparazzi.seed', locale)"
    :shuffle-label="pc('paparazzi.seed.shuffle', locale)"
    @update:model-value="(seed) => paparazzi.change({ seed }, 'seed')"
  />
</template>

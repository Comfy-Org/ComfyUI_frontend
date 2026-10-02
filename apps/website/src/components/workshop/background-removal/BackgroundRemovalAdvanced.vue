<script setup lang="ts">
import type { BackgroundRemoval } from '../../../composables/useBackgroundRemoval'
import type { Locale } from '../../../i18n/translations'
import { brc } from '../../../lib/workshop/background-removal/copy'
import EditorSeedField from '../app-editor/EditorSeedField.vue'
import EditorSlider from '../app-editor/EditorSlider.vue'

const { cutout, locale = 'en' } = defineProps<{
  cutout: BackgroundRemoval
  locale?: Locale
}>()

const { setup } = cutout
</script>

<template>
  <EditorSlider
    :model-value="setup.edgeSoftness"
    :label="brc('cutout.edge', locale)"
    unit="%"
    @update:model-value="
      (edgeSoftness) => cutout.update({ edgeSoftness }, 'edge')
    "
  />
  <EditorSeedField
    :model-value="setup.seed"
    :label="brc('cutout.seed', locale)"
    :shuffle-label="brc('cutout.seed.shuffle', locale)"
    @update:model-value="(seed) => cutout.update({ seed }, 'seed')"
  />
</template>

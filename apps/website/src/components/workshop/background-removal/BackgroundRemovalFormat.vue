<script setup lang="ts">
import type { BackgroundRemoval } from '../../../composables/useBackgroundRemoval'
import type { Locale } from '../../../i18n/translations'
import { CUTOUT_FORMATS } from '../../../lib/workshop/background-removal/contract'
import { brc } from '../../../lib/workshop/background-removal/copy'
import EditorSegmented from '../app-editor/EditorSegmented.vue'

const { cutout, locale = 'en' } = defineProps<{
  cutout: BackgroundRemoval
  locale?: Locale
}>()

const { setup } = cutout
const options = CUTOUT_FORMATS.map((id) => ({
  id,
  label: brc(`cutout.format.${id}`, locale)
}))
</script>

<template>
  <EditorSegmented
    :model-value="setup.format"
    :label="brc('cutout.format', locale)"
    :options
    fill
    @update:model-value="(format) => cutout.update({ format })"
  />
</template>

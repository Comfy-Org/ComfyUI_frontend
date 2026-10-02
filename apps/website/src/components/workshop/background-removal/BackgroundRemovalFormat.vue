<script setup lang="ts">
import { FileImage } from '@lucide/vue'

import type { BackgroundRemoval } from '../../../composables/useBackgroundRemoval'
import type { Locale } from '../../../i18n/translations'
import { CUTOUT_FORMATS } from '../../../lib/workshop/background-removal/contract'
import { brc } from '../../../lib/workshop/background-removal/copy'
import EditorOutput from '../app-editor/EditorOutput.vue'

const {
  cutout,
  locale = 'en',
  composer = false
} = defineProps<{
  cutout: BackgroundRemoval
  locale?: Locale
  composer?: boolean
}>()

const { setup, phase } = cutout
const options = CUTOUT_FORMATS.map((id) => ({
  id,
  label: brc(`cutout.format.${id}`, locale),
  detail: brc(`cutout.format.${id}.detail`, locale)
}))
</script>

<template>
  <EditorOutput
    :model-value="setup.format"
    :heading="brc('cutout.format', locale)"
    :options
    :icon="FileImage"
    :label="brc('cutout.format', locale)"
    :composer
    :disabled="composer && phase.kind === 'running'"
    @update:model-value="(format) => cutout.update({ format })"
  />
</template>

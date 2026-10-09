<script setup lang="ts">
import { computed } from 'vue'

import type { PaparazziMe } from '@/composables/usePaparazziMe'
import type { Locale } from '@/i18n/translations'
import { pc } from '@/lib/workshop/paparazzi-me/copy'
import type { Resolution } from '@/lib/workshop/paparazzi-me/setup'
import { RESOLUTIONS, outputSize } from '@/lib/workshop/paparazzi-me/setup'
import EditorOutput from '@/components/workshop/app-editor/EditorOutput.vue'

const {
  paparazzi,
  locale = 'en',
  composer = false
} = defineProps<{
  paparazzi: PaparazziMe
  locale?: Locale
  composer?: boolean
}>()

const { setup, phase } = paparazzi
const options = RESOLUTIONS.map((id) => ({
  id,
  label: id,
  detail: pc('paparazzi.resolution.size', locale, outputSize(id))
}))
const resolution = computed({
  get: () => setup.value.resolution,
  set: (next: Resolution) => paparazzi.change({ resolution: next })
})
</script>

<template>
  <EditorOutput
    v-model="resolution"
    :heading="pc('paparazzi.resolution', locale)"
    :options
    :label="pc('paparazzi.resolution', locale)"
    :composer
    :disabled="composer && phase.kind === 'running'"
  />
</template>

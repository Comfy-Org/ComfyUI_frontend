<script setup lang="ts">
import { computed } from 'vue'

import type { PaparazziMe } from '../../../composables/usePaparazziMe'
import type { Locale } from '../../../i18n/translations'
import { pc } from '../../../lib/workshop/paparazzi-me/copy'
import type { Resolution } from '../../../lib/workshop/paparazzi-me/setup'
import {
  RESOLUTIONS,
  outputSize
} from '../../../lib/workshop/paparazzi-me/setup'
import EditorSegmented from '../app-editor/EditorSegmented.vue'

const { paparazzi, locale = 'en' } = defineProps<{
  paparazzi: PaparazziMe
  locale?: Locale
}>()

const { setup } = paparazzi
const options = RESOLUTIONS.map((id) => ({ id, label: id }))
const resolution = computed({
  get: () => setup.value.resolution,
  set: (next: Resolution) => paparazzi.change({ resolution: next })
})
const size = computed(() => outputSize(setup.value.resolution))
</script>

<template>
  <EditorSegmented
    v-model="resolution"
    :label="pc('paparazzi.resolution', locale)"
    :options
    fill
  />
  <p class="px-1 text-[11px] text-primary-warm-gray tabular-nums">
    {{ pc('paparazzi.resolution.size', locale, size) }}
  </p>
</template>

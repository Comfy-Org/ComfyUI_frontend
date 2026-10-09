<script setup lang="ts">
import { computed } from 'vue'

import type { BackgroundRemoval } from '@/composables/useBackgroundRemoval'
import type { Locale } from '@/i18n/translations'
import type { CutoutMode } from '@/lib/workshop/background-removal/contract'
import { CUTOUT_MODES } from '@/lib/workshop/background-removal/contract'
import { brc } from '@/lib/workshop/background-removal/copy'
import EditorSegmented from '@/components/workshop/app-editor/EditorSegmented.vue'
import BackgroundRemovalAdjust from './BackgroundRemovalAdjust.vue'
import BackgroundRemovalReplace from './BackgroundRemovalReplace.vue'
import BackgroundRemovalSwatches from './BackgroundRemovalSwatches.vue'

const { cutout, locale = 'en' } = defineProps<{
  cutout: BackgroundRemoval
  locale?: Locale
}>()

const { setup } = cutout
const modes = CUTOUT_MODES.map((id) => ({
  id,
  label: brc(`cutout.mode.${id}`, locale)
}))
const mode = computed({
  get: () => setup.value.mode,
  set: (next: CutoutMode) => cutout.update({ mode: next })
})
const CONTENT = {
  remove: BackgroundRemovalSwatches,
  replace: BackgroundRemovalReplace,
  adjust: BackgroundRemovalAdjust
} as const
</script>

<template>
  <EditorSegmented
    v-model="mode"
    :label="brc('cutout.mode', locale)"
    :options="modes"
    fill
  />
  <component :is="CONTENT[mode]" :cutout :locale />
</template>

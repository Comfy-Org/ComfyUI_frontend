<script setup lang="ts">
import { ImageOff } from '@lucide/vue'

import type { PaparazziMe } from '@/composables/usePaparazziMe'
import type { Locale } from '@/i18n/translations'
import { pc } from '@/lib/workshop/paparazzi-me/copy'
import EditorPickerRow from '@/components/workshop/app-editor/EditorPickerRow.vue'
import { sceneName, sceneThumb } from './sections'

const { paparazzi, locale = 'en' } = defineProps<{
  paparazzi: PaparazziMe
  locale?: Locale
}>()

const { pickerOpen } = paparazzi
</script>

<template>
  <EditorPickerRow
    :label="pc('paparazzi.scene', locale)"
    :value="sceneName(paparazzi, locale)"
    :expanded="pickerOpen"
    data-testid="paparazzi-scene-row"
    @toggle="paparazzi.openPicker"
  >
    <img
      v-if="sceneThumb(paparazzi)"
      :src="sceneThumb(paparazzi)"
      alt=""
      class="size-full object-cover"
    />
    <ImageOff v-else class="size-3.5" aria-hidden="true" />
  </EditorPickerRow>
</template>

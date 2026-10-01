<script setup lang="ts">
import { Dices } from '@lucide/vue'

import type { PaparazziMe } from '../../../composables/usePaparazziMe'
import type { Locale } from '../../../i18n/translations'
import { pc } from '../../../lib/workshop/paparazzi-me/copy'
import EditorIconButton from '../app-editor/EditorIconButton.vue'
import EditorNumberField from '../app-editor/EditorNumberField.vue'

const { paparazzi, locale = 'en' } = defineProps<{
  paparazzi: PaparazziMe
  locale?: Locale
}>()

const { setup } = paparazzi
</script>

<template>
  <div class="flex items-center gap-1">
    <EditorNumberField
      :model-value="setup.seed"
      :label="pc('paparazzi.seed', locale)"
      class="min-w-0 flex-1"
      @update:model-value="(seed) => paparazzi.change({ seed }, 'seed')"
    />
    <EditorIconButton
      :icon="Dices"
      :label="pc('paparazzi.tool.shuffle', locale)"
      @click="paparazzi.shuffle"
    />
  </div>
</template>

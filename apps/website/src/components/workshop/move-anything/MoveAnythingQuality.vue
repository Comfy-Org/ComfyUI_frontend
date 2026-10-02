<script setup lang="ts">
import { Gauge } from '@lucide/vue'

import type { Locale } from '../../../i18n/translations'
import { mc } from '../../../lib/workshop/move-anything/copy'
import type { MoveQuality } from '../../../lib/workshop/move-anything/mock-run'
import EditorOutput from '../app-editor/EditorOutput.vue'

const {
  locale = 'en',
  composer = false,
  disabled = false
} = defineProps<{
  locale?: Locale
  composer?: boolean
  disabled?: boolean
}>()
const quality = defineModel<MoveQuality>({ required: true })

const options = [
  {
    id: 'fast',
    label: mc('move.quality.fast', locale),
    detail: mc('move.quality.fastHint', locale)
  },
  {
    id: 'best',
    label: mc('move.quality.best', locale),
    detail: mc('move.quality.bestHint', locale)
  }
] as const
</script>

<template>
  <EditorOutput
    v-model="quality"
    :heading="mc('move.quality', locale)"
    :options
    :icon="Gauge"
    :label="mc('move.quality', locale)"
    :composer
    :disabled
  />
</template>

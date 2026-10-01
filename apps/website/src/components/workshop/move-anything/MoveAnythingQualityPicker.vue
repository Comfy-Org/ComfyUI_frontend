<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import { mc } from '../../../lib/workshop/move-anything/copy'
import type { MoveQuality } from '../../../lib/workshop/move-anything/mock-run'
import EditorSegmented from '../app-editor/EditorSegmented.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const quality = defineModel<MoveQuality>({ required: true })

const options = [
  { id: 'fast', label: mc('move.quality.fastShort', locale) },
  { id: 'best', label: mc('move.quality.bestShort', locale) }
] as const
</script>

<template>
  <EditorSegmented
    v-model="quality"
    :label="mc('move.quality', locale)"
    :options
    fill
  />
</template>

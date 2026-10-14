<script setup lang="ts">
import type { PaparazziMe } from '@/composables/usePaparazziMe'
import type { Locale } from '@/i18n/translations'
import { pc } from '@/lib/workshop/paparazzi-me/copy'
import EditorSourceTile from '@/components/workshop/app-editor/EditorSourceTile.vue'

const { paparazzi, locale = 'en' } = defineProps<{
  paparazzi: PaparazziMe
  locale?: Locale
}>()

const { face } = paparazzi
</script>

<template>
  <EditorSourceTile
    kind="image"
    :src="face?.url"
    :caption="face?.name"
    :add-label="pc('paparazzi.face.upload', locale)"
    :hint="pc('paparazzi.face.tip', locale)"
    :remove-label="pc('paparazzi.face.remove', locale)"
    data-testid="paparazzi-face"
    @file="paparazzi.useFaceFile"
    @remove="paparazzi.removeFace"
  />
</template>

<script setup lang="ts">
import type { PaparazziMe } from '../../../composables/usePaparazziMe'
import type { Locale } from '../../../i18n/translations'
import { pc } from '../../../lib/workshop/paparazzi-me/copy'
import EditorTray from '../app-editor/EditorTray.vue'
import { PAPARAZZI_SECTIONS, sectionMeta } from './sections'

const { paparazzi, locale = 'en' } = defineProps<{
  paparazzi: PaparazziMe
  locale?: Locale
}>()

const { tray } = paparazzi
</script>

<template>
  <template v-for="section in PAPARAZZI_SECTIONS" :key="section.id">
    <EditorTray
      v-if="tray === section.id"
      :title="pc(section.title, locale)"
      :close-label="pc('paparazzi.close', locale)"
      class="max-w-100"
      @close="tray = undefined"
    >
      <template #actions>
        <span class="text-[11px] text-primary-warm-gray tabular-nums">{{
          sectionMeta(section.id, paparazzi, locale)
        }}</span>
      </template>
      <component :is="section.content" :paparazzi :locale />
    </EditorTray>
  </template>
</template>

<script setup lang="ts">
import type { BackgroundRemoval } from '../../../composables/useBackgroundRemoval'
import type { Locale } from '../../../i18n/translations'
import { brc } from '../../../lib/workshop/background-removal/copy'
import EditorTray from '../app-editor/EditorTray.vue'
import { CUTOUT_SECTIONS, sectionMeta } from './sections'

const { cutout, locale = 'en' } = defineProps<{
  cutout: BackgroundRemoval
  locale?: Locale
}>()

const { tray } = cutout
</script>

<template>
  <template v-for="section in CUTOUT_SECTIONS" :key="section.id">
    <EditorTray
      v-if="tray === section.id"
      :title="brc(section.title, locale)"
      :close-label="brc('cutout.close', locale)"
      class="max-w-100"
      @close="tray = undefined"
    >
      <template #actions>
        <span class="text-[11px] text-primary-warm-gray tabular-nums">{{
          sectionMeta(section.id, cutout, locale)
        }}</span>
      </template>
      <component :is="section.content" :cutout :locale />
    </EditorTray>
  </template>
</template>

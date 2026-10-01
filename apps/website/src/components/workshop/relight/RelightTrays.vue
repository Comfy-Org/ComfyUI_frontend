<script setup lang="ts">
import type { Relight } from '../../../composables/useRelight'
import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import EditorTray from '../app-editor/EditorTray.vue'
import { RELIGHT_SECTIONS, RELIGHT_TRAYS, sectionMeta } from './sections'

const { relight, locale = 'en' } = defineProps<{
  relight: Relight
  locale?: Locale
}>()

const { tray } = relight
</script>

<template>
  <template v-for="open in RELIGHT_TRAYS" :key="open.id">
    <EditorTray
      v-if="tray === open.id"
      :title="lc(open.title, locale)"
      :close-label="lc('relight.close', locale)"
      class="max-w-100"
      @close="tray = undefined"
    >
      <template #actions>
        <span class="text-[11px] text-primary-warm-gray tabular-nums">{{
          sectionMeta(open.id, relight, locale)
        }}</span>
      </template>
      <template v-for="section in RELIGHT_SECTIONS" :key="section.id">
        <component
          :is="section.content"
          v-if="section.tray === open.id"
          :relight
          :locale
        />
      </template>
    </EditorTray>
  </template>
</template>

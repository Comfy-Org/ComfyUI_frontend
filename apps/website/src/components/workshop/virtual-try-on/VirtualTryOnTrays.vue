<script setup lang="ts">
import type { VirtualTryOn } from '../../../composables/useVirtualTryOn'
import type { Locale } from '../../../i18n/translations'
import { vc } from '../../../lib/workshop/virtual-try-on/copy'
import EditorTray from '../app-editor/EditorTray.vue'
import { TRY_ON_SECTIONS, sectionMeta } from './sections'

const { tryOn, locale = 'en' } = defineProps<{
  tryOn: VirtualTryOn
  locale?: Locale
}>()

const { tray } = tryOn
</script>

<template>
  <template v-for="section in TRY_ON_SECTIONS" :key="section.id">
    <EditorTray
      v-if="tray === section.id"
      :title="vc(section.title, locale)"
      :close-label="vc('tryOn.close', locale)"
      class="max-w-90"
      @close="tray = undefined"
    >
      <template #actions>
        <span class="text-[11px] text-primary-warm-gray tabular-nums">{{
          sectionMeta(section.id, tryOn, locale)
        }}</span>
      </template>
      <component :is="section.content" :try-on :locale />
    </EditorTray>
  </template>
</template>

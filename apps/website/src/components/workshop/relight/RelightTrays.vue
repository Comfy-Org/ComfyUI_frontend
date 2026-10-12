<script setup lang="ts">
import type { Relight } from '@/composables/useRelight'
import type { Locale } from '@/i18n/translations'
import { lc } from '@/lib/workshop/relight/copy'
import EditorTray from '@/components/workshop/app-editor/EditorTray.vue'
import RelightTools from './RelightTools.vue'
import RelightTrayBody from './RelightTrayBody.vue'
import { RELIGHT_TRAYS, sectionMeta } from './sections'

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
        <RelightTools v-if="open.id === 'lights'" :relight :locale compact />
      </template>
      <RelightTrayBody :tray="open.id" :relight :locale />
    </EditorTray>
  </template>
</template>

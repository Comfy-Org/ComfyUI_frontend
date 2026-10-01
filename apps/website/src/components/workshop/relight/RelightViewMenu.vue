<script setup lang="ts">
import { Crosshair } from '@lucide/vue'

import type { RelightView } from '../../../composables/useRelight'
import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import EditorDivider from '../app-editor/EditorDivider.vue'
import EditorSelect from '../app-editor/EditorSelect.vue'
import EditorTool from '../app-editor/EditorTool.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const view = defineModel<RelightView>('view', { required: true })
const handles = defineModel<boolean>('handles', { required: true })

const options = [
  { id: 'live', label: lc('relight.view.live', locale) },
  { id: 'original', label: lc('relight.view.original', locale) },
  { id: 'lightmap', label: lc('relight.view.lightmap', locale) }
] as const
</script>

<template>
  <div
    class="flex items-center gap-0.5 rounded-full border border-transparency-white-t20 bg-primary-comfy-ink-light p-1 pl-2 shadow-lg shadow-black/30"
  >
    <EditorSelect
      v-model="view"
      :label="lc('relight.view', locale)"
      :options
      bare
      compact
      class="w-34 sm:w-44"
    />
    <EditorDivider />
    <EditorTool
      :icon="Crosshair"
      :label="lc('relight.handles', locale)"
      icon-only
      :pressed="handles"
      @click="handles = !handles"
    />
  </div>
</template>

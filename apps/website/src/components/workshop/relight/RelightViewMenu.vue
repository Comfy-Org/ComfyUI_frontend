<script setup lang="ts">
import { Crosshair } from '@lucide/vue'

import type { Relight } from '../../../composables/useRelight'
import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import EditorCompareMenu from '../app-editor/EditorCompareMenu.vue'
import EditorTool from '../app-editor/EditorTool.vue'

const { relight, locale = 'en' } = defineProps<{
  relight: Relight
  locale?: Locale
}>()

const { view, handles } = relight
const options = [
  { id: 'live', label: lc('relight.view.live', locale) },
  { id: 'original', label: lc('relight.view.original', locale) },
  { id: 'lightmap', label: lc('relight.view.lightmap', locale) }
] as const
</script>

<template>
  <EditorCompareMenu
    v-model="view"
    :label="lc('relight.view.compare', locale)"
    :items="options"
    hold="original"
    shown="live"
    :hint="lc('relight.view.hold', locale)"
  />
  <EditorTool
    :icon="Crosshair"
    :label="lc('relight.handles', locale)"
    icon-only
    :pressed="handles"
    @click="handles = !handles"
  />
</template>

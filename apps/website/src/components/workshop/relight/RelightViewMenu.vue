<script setup lang="ts">
import { Crosshair, Orbit } from '@lucide/vue'

import type { Relight } from '../../../composables/useRelight'
import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import EditorCompareToggle from '../app-editor/EditorCompareToggle.vue'
import EditorTool from '../app-editor/EditorTool.vue'

const { relight, locale = 'en' } = defineProps<{
  relight: Relight
  locale?: Locale
}>()

const { comparing, handles, lightMap } = relight
</script>

<template>
  <EditorCompareToggle
    v-model="comparing"
    :label="lc('relight.view.compare', locale)"
  />
  <EditorTool
    :icon="Crosshair"
    :label="lc('relight.handles', locale)"
    icon-only
    :pressed="handles"
    :disabled="comparing"
    @click="handles = !handles"
  />
  <EditorTool
    :icon="Orbit"
    :label="lc('relight.map', locale)"
    icon-only
    :pressed="lightMap"
    :disabled="comparing"
    @click="lightMap = !lightMap"
  />
</template>

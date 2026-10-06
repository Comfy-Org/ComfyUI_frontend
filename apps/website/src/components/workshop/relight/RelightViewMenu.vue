<script setup lang="ts">
import { Crosshair, Lightbulb, Orbit } from '@lucide/vue'

import type { Relight } from '../../../composables/useRelight'
import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import EditorCompareToggle from '../app-editor/EditorCompareToggle.vue'
import EditorTool from '../app-editor/EditorTool.vue'

const { relight, locale = 'en' } = defineProps<{
  relight: Relight
  locale?: Locale
}>()

const { comparing, handles, lightOnly, lightMap } = relight
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
    :icon="Lightbulb"
    :label="lc('relight.view.lightOnly', locale)"
    icon-only
    :pressed="lightOnly"
    :disabled="comparing"
    @click="lightOnly = !lightOnly"
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

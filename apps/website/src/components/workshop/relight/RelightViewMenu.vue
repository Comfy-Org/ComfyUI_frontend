<script setup lang="ts">
import { Columns2, Crosshair } from '@lucide/vue'

import type { Relight } from '../../../composables/useRelight'
import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import EditorTool from '../app-editor/EditorTool.vue'

const { relight, locale = 'en' } = defineProps<{
  relight: Relight
  locale?: Locale
}>()

const { comparing, handles } = relight
</script>

<template>
  <EditorTool
    :icon="Columns2"
    :label="lc('relight.view.compare', locale)"
    :pressed="comparing"
    @click="comparing = !comparing"
  />
  <EditorTool
    :icon="Crosshair"
    :label="lc('relight.handles', locale)"
    icon-only
    :pressed="handles"
    :disabled="comparing"
    @click="handles = !handles"
  />
</template>

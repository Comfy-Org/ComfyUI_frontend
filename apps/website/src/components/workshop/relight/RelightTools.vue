<script setup lang="ts">
import { Lightbulb, Sun } from '@lucide/vue'

import type { Relight } from '../../../composables/useRelight'
import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import EditorMenuButton from '../app-editor/EditorMenuButton.vue'

const { relight, locale = 'en' } = defineProps<{
  relight: Relight
  locale?: Locale
}>()

const { full, phase } = relight
const kinds = [
  { id: 'point', label: lc('relight.kind.point', locale), icon: Lightbulb },
  {
    id: 'directional',
    label: lc('relight.kind.directional', locale),
    icon: Sun
  }
] as const
</script>

<template>
  <EditorMenuButton
    :label="lc('relight.tool.add', locale)"
    :items="kinds"
    :disabled="full || phase.kind === 'running'"
    up
    @pick="relight.addLight"
  />
</template>

<script setup lang="ts">
import { Lightbulb, Sun } from '@lucide/vue'

import type { Relight } from '@/composables/useRelight'
import type { Locale } from '@/i18n/translations'
import { lc } from '@/lib/workshop/relight/copy'
import EditorMenuButton from '@/components/workshop/app-editor/EditorMenuButton.vue'

const {
  relight,
  compact = false,
  locale = 'en'
} = defineProps<{
  relight: Relight
  /** A bare `+` that opens downward, for a section header. */
  compact?: boolean
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
    :icon-only="compact"
    :up="!compact"
    :end="compact"
    @pick="relight.addLight"
  />
</template>

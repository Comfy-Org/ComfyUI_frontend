<script setup lang="ts">
import type { useMoveAnything } from '@/composables/useMoveAnything'
import type { Locale } from '@/i18n/translations'
import { mc } from '@/lib/workshop/move-anything/copy'
import { MOVE_CREDITS } from '@/lib/workshop/move-anything/mock-run'
import EditorRun from '@/components/workshop/app-editor/EditorRun.vue'

const {
  move,
  block = false,
  locale = 'en'
} = defineProps<{
  move: ReturnType<typeof useMoveAnything>
  block?: boolean
  locale?: Locale
}>()

const { phase, moved, canGenerate } = move
</script>

<template>
  <EditorRun
    :label="
      canGenerate
        ? mc('move.generate', locale, { n: moved.length })
        : mc('move.generate.idle', locale)
    "
    :credits="mc('move.credits', locale, { n: MOVE_CREDITS })"
    :cancel-label="mc('move.cancel', locale)"
    :running="phase.kind === 'moving'"
    :disabled="!canGenerate"
    :block
    data-testid="move-generate"
    @run="move.generate"
    @cancel="move.cancel"
  />
</template>

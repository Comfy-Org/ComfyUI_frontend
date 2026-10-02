<script setup lang="ts">
import type { SpriteSheet } from '../../../composables/useSpriteSheet'
import type { Locale } from '../../../i18n/translations'
import { spc } from '../../../lib/workshop/sprite-sheet/copy'
import { SPRITE_CREDITS } from '../../../lib/workshop/sprite-sheet/mock-run'
import EditorRun from '../app-editor/EditorRun.vue'
import type { RunProgress } from '../app-editor/run-progress'

const {
  sprite,
  block = false,
  locale = 'en'
} = defineProps<{
  sprite: SpriteSheet
  block?: boolean
  locale?: Locale
}>()

const { phase, canRun } = sprite
type SpritePhase = SpriteSheet['phase']['value']

function progress(current: SpritePhase): RunProgress | undefined {
  if (current.kind !== 'running') return undefined
  const { progress } = current
  return progress.stage === 'queued'
    ? { kind: 'queued' }
    : { kind: 'running', percent: Math.round(progress.percent) }
}
</script>

<template>
  <EditorRun
    :label="spc('sprite.run', locale)"
    :credits="spc('sprite.credits', locale, { n: SPRITE_CREDITS })"
    :cancel-label="spc('sprite.cancel', locale)"
    :running="phase.kind === 'running'"
    :progress="progress(phase)"
    :queued-label="spc('sprite.queued', locale)"
    :disabled="!canRun"
    :block
    data-testid="sprite-run"
    @run="sprite.generate"
    @cancel="sprite.cancel"
  />
</template>

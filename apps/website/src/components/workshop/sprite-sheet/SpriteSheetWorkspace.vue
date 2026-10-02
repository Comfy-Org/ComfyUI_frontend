<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import type { SpriteSheet } from '../../../composables/useSpriteSheet'
import type { Locale } from '../../../i18n/translations'
import { elapsedLabel } from '../../../lib/workshop/elapsed'
import { spc } from '../../../lib/workshop/sprite-sheet/copy'
import { SPRITE_GRID } from '../../../lib/workshop/sprite-sheet/options'
import EditorBusy from '../app-editor/EditorBusy.vue'
import EditorHint from '../app-editor/EditorHint.vue'
import SpriteSheetPreview from './SpriteSheetPreview.vue'
import SpriteSheetStage from './SpriteSheetStage.vue'

const { sprite, locale = 'en' } = defineProps<{
  sprite: SpriteSheet
  locale?: Locale
}>()

const { image, phase, canUndo, view } = sprite
const clicked = ref(false)
watch(image, () => (clicked.value = false))
const touched = computed(() => clicked.value || canUndo.value)

const now = useNow({ interval: 1000 })
const busyDetail = computed(() => {
  const current = phase.value
  if (current.kind !== 'running') return ''
  const time = elapsedLabel(now.value.getTime() - current.startedAt)
  return current.progress.stage === 'queued'
    ? spc('sprite.busy.queued', locale, { time })
    : spc('sprite.busy.running', locale, {
        percent: Math.round(current.progress.percent),
        time,
        n: SPRITE_GRID.frames
      })
})
</script>

<template>
  <div class="size-full max-w-5xl">
    <component
      :is="view === 'preview' ? SpriteSheetPreview : SpriteSheetStage"
      :sprite
      :locale
      @touch="clicked = true"
    >
      <EditorHint
        v-if="!touched && phase.kind === 'editing'"
        :text="spc('sprite.hint', locale)"
      />
      <EditorBusy
        v-if="phase.kind === 'running'"
        :title="spc('sprite.busy.title', locale)"
        :detail="busyDetail"
        :cancel-label="spc('sprite.cancel', locale)"
        @cancel="sprite.cancel"
      />
    </component>
  </div>
</template>

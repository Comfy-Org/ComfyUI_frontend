<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import type { SpriteSheet } from '../../../composables/useSpriteSheet'
import type { Locale } from '../../../i18n/translations'
import { elapsedLabel } from '../../../lib/workshop/elapsed'
import { spc } from '../../../lib/workshop/sprite-sheet/copy'
import EditorBusy from '../app-editor/EditorBusy.vue'
import EditorHint from '../app-editor/EditorHint.vue'
import SpriteSheetPreview from './SpriteSheetPreview.vue'
import SpriteSheetStage from './SpriteSheetStage.vue'

const { sprite, locale = 'en' } = defineProps<{
  sprite: SpriteSheet
  locale?: Locale
}>()

const { image, setup, phase, canUndo } = sprite
const clicked = ref(false)
watch(image, () => (clicked.value = false))
const touched = computed(() => clicked.value || canUndo.value)

const now = useNow({ interval: 1000 })
const elapsed = computed(() =>
  phase.value.kind === 'running'
    ? elapsedLabel(now.value.getTime() - phase.value.startedAt)
    : ''
)
</script>

<template>
  <div class="flex size-full max-w-5xl flex-col items-center gap-3">
    <div class="min-h-0 w-full flex-1">
      <SpriteSheetStage :sprite :locale @touch="clicked = true">
        <EditorHint
          v-if="!touched && phase.kind === 'editing'"
          :text="spc('sprite.hint', locale)"
        />
        <EditorBusy
          v-if="phase.kind === 'running'"
          :title="spc('sprite.busy.title', locale)"
          :detail="
            spc('sprite.busy.detail', locale, {
              n: setup.frames,
              time: elapsed
            })
          "
          :cancel-label="spc('sprite.cancel', locale)"
          @cancel="sprite.cancel"
        />
      </SpriteSheetStage>
    </div>
    <SpriteSheetPreview :sprite :locale />
  </div>
</template>

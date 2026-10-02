<script setup lang="ts">
import { ref, watch } from 'vue'

import type {
  MoveImage,
  useMoveAnything
} from '../../../composables/useMoveAnything'
import type { Locale } from '../../../i18n/translations'
import { mc } from '../../../lib/workshop/move-anything/copy'
import EditorBusy from '../app-editor/EditorBusy.vue'
import EditorHint from '../app-editor/EditorHint.vue'
import MoveAnythingStage from './MoveAnythingStage.vue'

const {
  image,
  move,
  locale = 'en'
} = defineProps<{
  image: MoveImage
  move: ReturnType<typeof useMoveAnything>
  locale?: Locale
}>()

const { objects, phase, tool, quality, selected, detecting } = move
const HINTS = {
  move: 'move.hint.move',
  smart: 'move.hint.smart',
  box: 'move.hint.box'
} as const
const hint = () =>
  tool.value === 'move' && !selected.value
    ? 'move.hint.pick'
    : HINTS[tool.value]
const touched = ref(false)
watch([tool, () => image], () => (touched.value = false))

function select(id: string) {
  selected.value = id
  touched.value = true
}

function begin() {
  move.checkpoint()
  touched.value = true
}

function busyDetail() {
  return mc('move.busy.detail', locale, {
    n: move.moved.value.length,
    wait: mc(
      quality.value === 'fast'
        ? 'move.quality.fastHint'
        : 'move.quality.bestHint',
      locale
    )
  })
}
</script>

<template>
  <div class="relative size-full">
    <MoveAnythingStage
      :image
      :objects
      :tool
      :selected
      :detecting
      :locale
      @select="select"
      @begin="begin"
      @place="move.place"
      @pick="move.smartSelect"
      @box="move.boxSelect"
    >
      <EditorHint
        v-if="!touched && !detecting && phase.kind === 'arranging'"
        :text="mc(hint(), locale)"
      />
    </MoveAnythingStage>
    <EditorBusy
      v-if="phase.kind === 'moving'"
      :title="mc('move.busy.title', locale)"
      :detail="busyDetail()"
    />
  </div>
</template>

<script setup lang="ts">
import type { MoveImage, MoveView } from '../../../composables/useMoveAnything'
import type { Locale } from '../../../i18n/translations'
import { mc } from '../../../lib/workshop/move-anything/copy'
import EditorCompare from '../app-editor/EditorCompare.vue'
import EditorFrame from '../app-editor/EditorFrame.vue'

const {
  image,
  resultUrl,
  view,
  locale = 'en'
} = defineProps<{
  image: MoveImage
  resultUrl: string
  view: MoveView
  locale?: Locale
}>()
</script>

<template>
  <div class="size-full max-w-5xl">
    <EditorCompare
      v-if="view === 'compare'"
      :before="image.url"
      :after="resultUrl"
      :alt="mc('move.alt.result', locale)"
      :before-label="mc('move.view.original', locale)"
      :after-label="mc('move.view.result', locale)"
      :slider-label="mc('move.compare', locale)"
      :width="image.width"
      :height="image.height"
    />
    <EditorFrame v-else :width="image.width" :height="image.height">
      <img
        :src="view === 'result' ? resultUrl : image.url"
        :alt="
          mc(view === 'result' ? 'move.alt.result' : 'move.alt.example', locale)
        "
        class="size-full rounded-sm object-cover"
      />
    </EditorFrame>
  </div>
</template>

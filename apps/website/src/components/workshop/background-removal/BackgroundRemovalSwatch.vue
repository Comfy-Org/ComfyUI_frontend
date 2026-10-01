<script setup lang="ts">
import type { EditorImage } from '../../../composables/useEditorImage'
import type { CutoutBackground } from '../../../lib/workshop/background-removal/contract'
import { BACKGROUND_COLORS } from '../../../lib/workshop/background-removal/contract'
import EditorChecker from '../app-editor/EditorChecker.vue'
import BackgroundRemovalSubject from './BackgroundRemovalSubject.vue'

const { background, image } = defineProps<{
  background: CutoutBackground
  image?: EditorImage
}>()
</script>

<template>
  <span
    class="absolute inset-0 flex justify-center"
    :style="{ backgroundColor: BACKGROUND_COLORS[background] ?? undefined }"
    aria-hidden="true"
  >
    <EditorChecker v-if="background === 'transparent'" />
    <span
      v-if="image"
      class="relative h-full"
      :style="{ aspectRatio: `${image.width} / ${image.height}` }"
    >
      <BackgroundRemovalSubject :url="image.url" />
    </span>
  </span>
</template>

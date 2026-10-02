<script setup lang="ts">
import type { EditorImage } from '../../../composables/useEditorImage'
import type { CutoutSetup } from '../../../lib/workshop/background-removal/contract'
import EditorChecker from '../app-editor/EditorChecker.vue'
import BackgroundRemovalSubject from './BackgroundRemovalSubject.vue'

const { setup, image } = defineProps<{
  setup: CutoutSetup
  image?: EditorImage
}>()
</script>

<template>
  <span
    v-if="setup.mode === 'remove'"
    class="absolute inset-0 flex justify-center"
    :style="{
      backgroundColor:
        setup.background.kind === 'color' ? setup.background.color : undefined
    }"
    aria-hidden="true"
  >
    <EditorChecker v-if="setup.background.kind === 'transparent'" />
    <span
      v-if="image"
      class="relative h-full"
      :style="{ aspectRatio: `${image.width} / ${image.height}` }"
    >
      <BackgroundRemovalSubject :url="image.url" />
    </span>
  </span>
  <img
    v-else-if="image"
    :src="image.url"
    alt=""
    class="absolute inset-0 size-full object-cover"
  />
</template>

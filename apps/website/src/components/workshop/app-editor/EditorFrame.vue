<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'

import { EDITOR_ZOOM } from '../../../composables/useEditorZoom'
import { zoomTransform } from './zoom'

const { width, height } = defineProps<{ width: number; height: number }>()

const zoom = inject(EDITOR_ZOOM, undefined)
const box = useTemplateRef<HTMLElement>('box')

onMounted(() => {
  if (zoom && box.value) zoom.frame.value = box.value
})
onBeforeUnmount(() => {
  if (zoom?.frame.value === box.value) zoom.frame.value = undefined
})
watch(
  () => [width, height],
  () => zoom?.fit()
)
</script>

<template>
  <div class="size-full" style="container-type: size">
    <div
      ref="box"
      data-testid="editor-frame"
      class="relative mx-auto origin-top-left"
      :style="{
        width: `min(100cqw, calc(100cqh * ${width || 3} / ${height || 2}))`,
        aspectRatio: `${width || 3} / ${height || 2}`,
        transform: zoom && zoomTransform(zoom.view.value)
      }"
    >
      <slot />
    </div>
  </div>
</template>

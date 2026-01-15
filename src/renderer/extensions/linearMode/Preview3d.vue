<script setup lang="ts">
import { useTemplateRef, watch } from 'vue'

import AnimationControls from '@/components/load3d/controls/AnimationControls.vue'
import { useLoad3dViewer } from '@/composables/useLoad3dViewer'

const { modelUrl } = defineProps<{
  modelUrl: string
}>()

const containerRef = useTemplateRef('containerRef')

const viewer = useLoad3dViewer()

watch([containerRef, () => modelUrl], async () => {
  if (!containerRef.value || !modelUrl) return

  await viewer.initializeStandaloneViewer(containerRef.value, modelUrl)
})

//TODO: refactor to add control buttons
</script>
<template>
  <div
    ref="containerRef"
    class="relative w-full h-full"
    @mouseenter="viewer.handleMouseEnter"
    @mouseleave="viewer.handleMouseLeave"
    @resize="viewer.handleResize"
  >
    <div class="pointer-events-none absolute top-0 left-0 size-full">
      <AnimationControls
        v-if="viewer.animations.value && viewer.animations.value.length > 0"
        v-model:animations="viewer.animations.value"
        v-model:playing="viewer.playing.value"
        v-model:selected-speed="viewer.selectedSpeed.value"
        v-model:selected-animation="viewer.selectedAnimation.value"
        v-model:animation-progress="viewer.animationProgress.value"
        v-model:animation-duration="viewer.animationDuration.value"
        @seek="viewer.handleSeek"
      />
    </div>
  </div>
</template>

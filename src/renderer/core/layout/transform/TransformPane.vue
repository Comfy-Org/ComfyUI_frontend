<template>
  <div
    data-testid="transform-pane"
    :class="
      cn(
        'absolute inset-0 w-full h-full pointer-events-none',
        isInteracting ? 'transform-pane--interacting' : 'will-change-auto',
        isLOD && 'isLOD'
      )
    "
    :style="transformStyle"
  >
    <!-- Vue nodes will be rendered here -->
    <slot />
  </div>
</template>

<script setup lang="ts">
import { useRafFn } from '@vueuse/core'
import { computed, provide } from 'vue'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { TransformStateKey } from '@/renderer/core/layout/injectionKeys'
import { useTransformSettling } from '@/renderer/core/layout/transform/useTransformSettling'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import { useLOD } from '@/renderer/extensions/vueNodes/lod/useLOD'
import { cn } from '@/utils/tailwindUtil'

interface TransformPaneProps {
  canvas?: LGraphCanvas
}

const props = defineProps<TransformPaneProps>()

const {
  camera,
  transformStyle,
  syncWithCanvas,
  canvasToScreen,
  screenToCanvas,
  isNodeInViewport
} = useTransformState()

const { isLOD } = useLOD(camera)

const canvasElement = computed(() => props.canvas?.canvas)
const { isTransforming: isInteracting } = useTransformSettling(canvasElement, {
  settleDelay: 200,
  trackPan: true
})

provide(TransformStateKey, {
  camera,
  canvasToScreen,
  screenToCanvas,
  isNodeInViewport
})

const emit = defineEmits<{
  transformUpdate: []
}>()

useRafFn(
  () => {
    if (!props.canvas) {
      return
    }
    syncWithCanvas(props.canvas)
    emit('transformUpdate')
  },
  { immediate: true }
)
</script>

<style scoped>
.transform-pane--interacting {
  will-change: transform;
}
</style>

<template>
  <Teleport to="body">
    <div
      v-if="showGhost && rafPosition"
      ref="ghostRef"
      class="pointer-events-none fixed top-0 left-0 z-overlay will-change-transform"
    >
      <div class="origin-top-left scale-50 opacity-80">
        <LGraphNodePreview
          :node-def="draggedNode!"
          :widget-values="pendingWidgetValues"
          position="relative"
        />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { Point2D } from '@comfyorg/shared-frontend-utils/geometry'

import { useMouse, useRafFn } from '@vueuse/core'
import { computed, shallowRef, useTemplateRef, watch } from 'vue'

import { useNodeDragToCanvas } from '@/composables/node/useNodeDragToCanvas'
import { useCompositedTransform } from '@/renderer/core/layout/transform/useCompositedTransform'
import LGraphNodePreview from '@/renderer/extensions/vueNodes/components/LGraphNodePreview.vue'

const { isDragging, draggedNode, pendingWidgetValues } = useNodeDragToCanvas()

const { x, y, sourceType } = useMouse({ type: 'client' })

const showGhost = computed(() => Boolean(isDragging.value && draggedNode.value))
const rafPosition = shallowRef<Point2D>()
const ghostRef = useTemplateRef<HTMLElement>('ghostRef')
const { setTransform: setGhostTransform } = useCompositedTransform(ghostRef)

watch(
  [ghostRef, rafPosition],
  ([ghost, position]) => {
    if (ghost && position)
      setGhostTransform(`translate(${position.x + 12}px, ${position.y + 12}px)`)
  },
  { flush: 'post' }
)

const { pause, resume } = useRafFn(
  () => {
    if (sourceType.value === null) return
    const pos = rafPosition.value
    if (pos && pos.x === x.value && pos.y === y.value) return
    rafPosition.value = { x: x.value, y: y.value }
  },
  { immediate: false }
)

watch(
  showGhost,
  (show) => {
    if (show) {
      resume()
    } else {
      pause()
      rafPosition.value = undefined
    }
  },
  { immediate: true }
)
</script>

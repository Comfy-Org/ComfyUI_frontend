<template>
  <Teleport to="body">
    <div
      v-if="showGhost && rafPosition"
      class="pointer-events-none fixed top-0 left-0 z-10000 will-change-transform"
      :style="{
        transform: `translate(${rafPosition.x + 12}px, ${rafPosition.y + 12}px)`
      }"
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
import { useMouse, useRafFn } from '@vueuse/core'
import { computed, shallowRef, watch } from 'vue'

import { useNodeDragToCanvas } from '@/composables/node/useNodeDragToCanvas'
import LGraphNodePreview from '@/renderer/extensions/vueNodes/components/LGraphNodePreview.vue'

const { isDragging, draggedNode, pendingWidgetValues } = useNodeDragToCanvas()

const { x, y, sourceType } = useMouse({ type: 'client' })

const showGhost = computed(() => Boolean(isDragging.value && draggedNode.value))
const rafPosition = shallowRef<{ x: number; y: number }>()

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

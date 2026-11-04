<script setup lang="ts">
import type { Point2D as Point } from '@comfyorg/shared-frontend-utils/geometry'
import { cn } from '@comfyorg/tailwind-utils'
import { useElementSize } from '@vueuse/core'
import { provide, useTemplateRef } from 'vue'

import { SuperCanvasKey } from '@/renderer/extensions/superComfy/canvas/canvasContext'
import {
  fitView,
  screenToWorld
} from '@/renderer/extensions/superComfy/canvas/canvasGeometry'
import { useCanvasCamera } from '@/renderer/extensions/superComfy/canvas/useCanvasCamera'
import { useCanvasGestures } from '@/renderer/extensions/superComfy/canvas/useCanvasGestures'
import type { SuperNode as SuperNodeData } from '@/renderer/extensions/superComfy/engine/documentSchema'
import { useSuperComfyGraphStore } from '@/renderer/extensions/superComfy/stores/superComfyGraphStore'

import SuperComfyLinks from './SuperComfyLinks.vue'
import SuperNode from './nodes/SuperNode.vue'

const emit = defineEmits<{ requestAdd: [at: Point, client: Point] }>()

const store = useSuperComfyGraphStore()
const viewport = useTemplateRef<HTMLElement>('viewport')
const size = useElementSize(viewport)

const camera = useCanvasCamera(store.state.doc.viewport, (next) =>
  store.dispatch({ type: 'viewportChanged', viewport: next })
)

function localPoint(event: { clientX: number; clientY: number }): Point {
  const rect = viewport.value?.getBoundingClientRect()
  return {
    x: event.clientX - (rect?.left ?? 0),
    y: event.clientY - (rect?.top ?? 0)
  }
}

function toWorld(event: { clientX: number; clientY: number }): Point {
  return screenToWorld(localPoint(event), camera.camera.value)
}

const gestures = useCanvasGestures({
  doc: () => store.state.doc,
  toWorld,
  dispatch: store.dispatch,
  connect: store.connect,
  removeNodes: store.removeNodes,
  startPan: camera.startPan
})

provide(SuperCanvasKey, {
  draftActive: gestures.draftActive,
  isCompatible: gestures.isCompatible,
  onPortPointerDown: gestures.onPortPointerDown
})

function scrollsItself(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('textarea') !== null
}

function onWheel(event: WheelEvent) {
  const rect = viewport.value?.getBoundingClientRect()
  if (!rect || scrollsItself(event.target)) return
  event.preventDefault()
  camera.onWheel(event, rect)
}

function onDoubleClick(event: MouseEvent) {
  emit('requestAdd', toWorld(event), { x: event.clientX, y: event.clientY })
}

function nodeStyle(node: SuperNodeData) {
  return {
    transform: `translate(${node.x}px, ${node.y}px)`,
    width: `${node.width}px`
  }
}

function fit() {
  camera.fit(
    fitView(store.state.doc, {
      width: size.width.value,
      height: size.height.value
    })
  )
}

function viewCenter(): Point {
  return screenToWorld(
    { x: size.width.value / 2, y: size.height.value / 3 },
    camera.camera.value
  )
}

defineExpose({
  fit,
  viewCenter,
  deleteSelection: gestures.deleteSelection,
  clearSelection: gestures.clearSelection,
  selectOnly: gestures.selectOnly
})
</script>

<template>
  <div
    ref="viewport"
    class="relative size-full touch-none overflow-hidden select-none"
    data-testid="supercomfy-canvas"
    @pointerdown.self="gestures.onBackgroundPointerDown"
    @dblclick.self="onDoubleClick"
    @wheel="onWheel"
  >
    <div class="absolute top-0 left-0" :style="camera.transformStyle.value">
      <SuperComfyLinks
        :doc="store.state.doc"
        :draft="gestures.draft.value"
        :selection="gestures.selection.value"
      />
      <div
        v-for="node in store.state.doc.nodes"
        :key="node.id"
        :class="
          cn(
            'absolute top-0 left-0',
            gestures.selection.value.has(node.id) && 'z-1'
          )
        "
        :style="nodeStyle(node)"
        @pointerdown="gestures.onNodePointerDown($event, node.id)"
      >
        <SuperNode :node :selected="gestures.selection.value.has(node.id)" />
      </div>
    </div>
  </div>
</template>

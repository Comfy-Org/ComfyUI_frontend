<script setup lang="ts">
import { useElementSize, useRafFn } from '@vueuse/core'
import { ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { useSubgraphInputValuesStore } from './subgraphInputValuesStore'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import SubgraphInputValuesContent from './SubgraphInputValuesContent.vue'

const { t } = useI18n()
const context = useSubgraphInputValuesStore()
const canvasStore = useCanvasStore()
const { camera, syncWithCanvas } = useTransformState()
const { handleWheel, handlePointerDown, handlePointerMove, handlePointerUp } =
  useCanvasInteractions()
const panel = useTemplateRef('panel')
const { height: panelHeight } = useElementSize(panel)
const collapsed = ref(false)

useRafFn(() => {
  const element = panel.value
  const graph = context.graph
  const canvas = canvasStore.canvas
  if (!element || !graph || !canvas) return
  syncWithCanvas(canvas)
  const [x, y] = graph.inputNode.pos
  const screenWidth = canvas.canvas.width / canvas.dpr
  const screenHeight = canvas.canvas.height / canvas.dpr
  const width = Math.min(320, Math.max(1, (screenWidth - 88) / camera.z))
  const left = Math.max(
    72,
    Math.min(
      (x - width - 16 + camera.x) * camera.z,
      screenWidth - width * camera.z - 16
    )
  )
  const top = Math.max(
    96,
    Math.min(
      (y + camera.y) * camera.z,
      screenHeight - panelHeight.value * camera.z - 16
    )
  )
  element.style.transform = `translate(${left}px, ${top}px) scale(${camera.z})`
  element.style.width = `${width}px`
  element.style.maxHeight = `${Math.max(1, (screenHeight - 112) / camera.z)}px`
})

function handleKeydown(event: KeyboardEvent) {
  if (
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    event.key !== 'Escape'
  ) {
    event.stopPropagation()
  }
}
</script>

<template>
  <section
    v-if="context.graph && !canvasStore.linearMode"
    ref="panel"
    data-testid="subgraph-input-values"
    :aria-label="t('subgraphInputValues.title')"
    class="pointer-events-auto absolute top-0 left-0 z-panel w-80 origin-top-left overflow-y-auto rounded-xl border border-border bg-node text-node-foreground shadow-lg"
    @wheel="handleWheel"
    @pointerdown.capture="handlePointerDown"
    @pointermove.capture="handlePointerMove"
    @pointerup.capture="handlePointerUp"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
    @keydown="handleKeydown"
  >
    <header class="flex items-center gap-2 border-b border-border px-3 py-2">
      <i class="icon-[lucide--sliders-horizontal]" />
      <span class="flex-1 text-sm font-medium">{{
        t('subgraphInputValues.title')
      }}</span>
      <Button
        variant="muted-textonly"
        size="icon-sm"
        :aria-label="
          collapsed
            ? t('subgraphInputValues.expand')
            : t('subgraphInputValues.collapse')
        "
        :aria-expanded="!collapsed"
        @click="collapsed = !collapsed"
      >
        <i
          :class="
            collapsed
              ? 'icon-[lucide--chevron-down]'
              : 'icon-[lucide--chevron-up]'
          "
        />
      </Button>
    </header>
    <SubgraphInputValuesContent v-if="!collapsed" />
  </section>
</template>

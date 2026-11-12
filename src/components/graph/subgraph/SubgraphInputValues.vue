<script setup lang="ts">
import { computedWithControl, useEventListener } from '@vueuse/core'
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { SubgraphIONodeBase } from '@/lib/litegraph/src/subgraph/SubgraphIONodeBase'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import NodeFrame from '@/renderer/extensions/vueNodes/components/NodeFrame.vue'
import NodeHeader from '@/renderer/extensions/vueNodes/components/NodeHeader.vue'
import NodeFooter from '@/renderer/extensions/vueNodes/components/NodeFooter.vue'
import NodeResizeHandle from '@/renderer/extensions/vueNodes/components/NodeResizeHandle.vue'
import { RESIZE_HANDLES } from '@/renderer/extensions/vueNodes/interactions/resize/resizeHandleConfig'
import { cn } from '@comfyorg/tailwind-utils'
import { useSubgraphInputValuesStore } from './subgraphInputValuesStore'
import SubgraphInputValuesContent from './SubgraphInputValuesContent.vue'
import { useSubgraphInputLayout } from './useSubgraphInputLayout'

const { t } = useI18n()
const context = useSubgraphInputValuesStore()
const canvasStore = useCanvasStore()
const {
  handleWheel,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  forwardEventToCanvas
} = useCanvasInteractions()

const collapsed = ref(false)
const slots = computedWithControl(
  () => context.graph,
  () => context.graph?.inputNode.allSlots ?? []
)
useEventListener(
  () => context.graph?.events,
  [
    'input-added',
    'removing-input',
    'renaming-input',
    'inputs-reordered',
    'configured'
  ],
  slots.trigger
)
const title = computed(() =>
  context.selected
    ? t('subgraphInputValues.instance', {
        title: context.selected.title,
        id: context.selected.id
      })
    : context.graph?.name
)

const nodeView = useTemplateRef('nodeView')
const panel = computed(() => nodeView.value?.element ?? null)
const { style, startResize } = useSubgraphInputLayout(
  panel,
  () => slots.value.length,
  () => collapsed.value
)

function exitSubgraph() {
  if (!canvasStore.isPickingNodes) {
    void useCommandStore().execute('Comfy.Graph.ExitSubgraph')
  }
}

function stopUnmodifiedKeys(event: KeyboardEvent) {
  if (
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    event.key !== 'Escape'
  ) {
    event.stopPropagation()
  }
}

function forwardUnlessOnButton(event: PointerEvent) {
  if (event.target instanceof Element && event.target.closest('button')) return
  forwardEventToCanvas(event)
}
</script>

<template>
  <NodeFrame
    v-if="context.graph && !canvasStore.linearMode"
    ref="nodeView"
    data-testid="subgraph-input-values"
    data-subgraph-io
    :inert="canvasStore.isPickingNodes"
    :aria-label="title"
    :class="
      cn(
        'pointer-events-auto top-0 left-0 z-panel min-h-(--node-height) origin-top-left drop-shadow-none',
        collapsed ? 'w-fit max-w-(--node-width)' : 'w-(--node-width)'
      )
    "
    container-class="w-full rounded-(--node-radius) bg-node/60"
    :style
    @wheel="handleWheel"
    @pointerdown.capture="handlePointerDown"
    @pointermove.capture="handlePointerMove"
    @pointerup.capture="handlePointerUp"
    @pointerdown.self.stop="forwardEventToCanvas"
    @keydown="stopUnmodifiedKeys"
  >
    <template #before>
      <div
        aria-hidden="true"
        class="pointer-events-none absolute inset-y-0 right-0 z-10 rounded-r-(--node-radius) border-2 border-l-0 border-foreground"
        :style="{ width: `${SubgraphIONodeBase.roundedRadius}px` }"
      />
    </template>
    <div
      @pointerdown="forwardUnlessOnButton"
      @pointermove="forwardUnlessOnButton"
      @pointerup="forwardUnlessOnButton"
    >
      <NodeHeader
        :title
        :collapsed
        :style="{ paddingRight: `${SubgraphIONodeBase.socketInset}px` }"
        @collapse="collapsed = !collapsed"
      />
    </div>
    <SubgraphInputValuesContent
      data-testid="subgraph-input-body"
      :slots
      :collapsed
      @pointerdown.self="forwardEventToCanvas"
    />
    <template #after>
      <NodeFooter
        subgraph-action="exit"
        error-severity="none"
        :show-errors-tab-enabled="false"
        @navigate-subgraph="exitSubgraph"
      />
      <NodeResizeHandle
        v-if="!collapsed"
        :handle="RESIZE_HANDLES[0]"
        @resize="startResize"
      />
    </template>
  </NodeFrame>
</template>

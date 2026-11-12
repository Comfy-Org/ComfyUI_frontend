<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import SlotConnectionDot from '@/renderer/extensions/vueNodes/components/SlotConnectionDot.vue'
import NodeFrame from '@/renderer/extensions/vueNodes/components/NodeFrame.vue'
import NodeBody from '@/renderer/extensions/vueNodes/components/NodeBody.vue'
import NodeHeader from '@/renderer/extensions/vueNodes/components/NodeHeader.vue'
import NodeFooter from '@/renderer/extensions/vueNodes/components/NodeFooter.vue'
import NodeBadges from '@/renderer/extensions/vueNodes/components/NodeBadges.vue'
import { useSubgraphInputNode } from './useSubgraphInputNode'
import SubgraphInputValuesContent from './SubgraphInputValuesContent.vue'
import { useSubgraphInputLayout } from './useSubgraphInputLayout'
import NodeResizeHandle from '@/renderer/extensions/vueNodes/components/NodeResizeHandle.vue'
import { RESIZE_HANDLES } from '@/renderer/extensions/vueNodes/interactions/resize/resizeHandleConfig'

const { t } = useI18n()
const {
  context,
  collapsed,
  slots,
  title,
  badges,
  leaveSubgraph,
  handleKeydown
} = useSubgraphInputNode()
const canvasStore = useCanvasStore()
const {
  handleWheel,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  forwardEventToCanvas
} = useCanvasInteractions()
const nodeView = useTemplateRef('nodeView')
const panel = computed(() => nodeView.value?.element ?? null)
const header = useTemplateRef('header')
const { style, startResize } = useSubgraphInputLayout(
  panel,
  header,
  () => collapsed.value
)

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
    class="pointer-events-auto top-0 left-0 z-panel min-h-(--node-height) w-(--node-width) origin-top-left"
    :style
    @wheel="handleWheel"
    @pointerdown.capture="handlePointerDown"
    @pointermove.capture="handlePointerMove"
    @pointerup.capture="handlePointerUp"
    @pointerdown.self.stop="forwardEventToCanvas"
    @keydown="handleKeydown"
  >
    <template #before>
      <NodeBadges :groups="badges" role="img" :aria-label="t('g.subgraph')" />
    </template>
    <div
      ref="header"
      @pointerdown="forwardUnlessOnButton"
      @pointermove="forwardUnlessOnButton"
      @pointerup="forwardUnlessOnButton"
    >
      <NodeHeader :title :collapsed @collapse="collapsed = !collapsed" />
    </div>
    <NodeBody
      data-testid="subgraph-input-body"
      class="rounded-b-(--node-radius)"
      @pointerdown.self="forwardEventToCanvas"
    >
      <div>
        <div
          v-for="slot in slots"
          :key="slot.id"
          class="lg-slot lg-slot--output relative flex cursor-crosshair items-center justify-end pr-3"
          :style="{ height: `${LiteGraph.NODE_SLOT_HEIGHT}px` }"
          :data-testid="
            slot === context.graph.inputNode.emptySlot
              ? 'subgraph-add-input'
              : 'subgraph-input-port'
          "
          @pointerdown="forwardEventToCanvas"
          @pointermove="forwardEventToCanvas"
          @pointerup="forwardEventToCanvas"
          @dblclick="forwardEventToCanvas"
          @contextmenu.prevent
        >
          <span class="truncate">{{ slot.displayName }}</span>
          <SlotConnectionDot
            :slot-data="slot"
            class="absolute right-0 translate-x-1/2"
          />
        </div>
      </div>
      <SubgraphInputValuesContent
        v-if="!collapsed"
        @pointerdown.self="forwardEventToCanvas"
      />
    </NodeBody>
    <template #after>
      <NodeFooter
        subgraph-action="leave"
        error-severity="none"
        :show-errors-tab-enabled="false"
        @navigate-subgraph="leaveSubgraph"
      />
      <NodeResizeHandle
        v-if="!collapsed"
        :handle="RESIZE_HANDLES[0]"
        @resize="startResize"
      />
    </template>
  </NodeFrame>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import SingleSelect from '@comfyorg/design-system/single-select/SingleSelect'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import SlotConnectionDot from '@/renderer/extensions/vueNodes/components/SlotConnectionDot.vue'
import LGraphNode from '@/renderer/extensions/vueNodes/components/LGraphNode.vue'
import NodeBody from '@/renderer/extensions/vueNodes/components/NodeBody.vue'
import { useSubgraphInputNode } from './useSubgraphInputNode'
import SubgraphInputValuesContent from './SubgraphInputValuesContent.vue'
import { useSubgraphInputLayout } from './useSubgraphInputLayout'
import NodeResizeHandle from '@/renderer/extensions/vueNodes/components/NodeResizeHandle.vue'
import { RESIZE_HANDLES } from '@/renderer/extensions/vueNodes/interactions/resize/resizeHandleConfig'

const { t } = useI18n()
const { context, collapsed, slots, options, selectedKey, handleKeydown } =
  useSubgraphInputNode()
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
</script>

<template>
  <LGraphNode
    v-if="context.graph && !canvasStore.linearMode"
    ref="nodeView"
    data-testid="subgraph-input-values"
    data-subgraph-io
    :inert="canvasStore.isPickingNodes"
    :aria-label="t('subgraphInputValues.chooseInstance')"
    class="pointer-events-auto top-0 left-0 z-panel min-h-(--node-height) w-(--node-width) origin-top-left"
    :data-node-id="context.graph.inputNode.id"
    :style
    @wheel="handleWheel"
    @pointerdown.capture="handlePointerDown"
    @pointermove.capture="handlePointerMove"
    @pointerup.capture="handlePointerUp"
    @pointerdown.self.stop="forwardEventToCanvas"
    @pointermove.stop
    @pointerup.stop
    @keydown="handleKeydown"
  >
    <header
      ref="header"
      class="lg-node-header flex items-center gap-1 rounded-t-(--node-radius) bg-node-header py-1 pr-2 pl-1"
      @pointerdown.self="forwardEventToCanvas"
      @pointermove="forwardEventToCanvas"
      @pointerup.self="forwardEventToCanvas"
    >
      <Button
        variant="textonly"
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
              ? 'icon-[lucide--chevron-right]'
              : 'icon-[lucide--chevron-down]'
          "
        />
      </Button>
      <SingleSelect
        v-model="selectedKey"
        size="md"
        :options
        :label="t('subgraphInputValues.chooseInstance')"
        :accessible-label="t('subgraphInputValues.chooseInstance')"
        class="min-w-0 flex-1 border-0 bg-transparent font-medium"
        @pointerdown.stop
        @pointermove.stop
        @pointerup.stop
      />
    </header>
    <NodeBody
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
      <NodeResizeHandle
        v-if="!collapsed"
        :handle="RESIZE_HANDLES[0]"
        @resize="startResize"
      />
    </template>
  </LGraphNode>
</template>

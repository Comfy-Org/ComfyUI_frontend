<script
  setup
  lang="ts"
  generic="TNode extends SubgraphInputNode | SubgraphOutputNode"
>
import { computedWithControl, useEventListener } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { SubgraphIONodeBase } from '@/lib/litegraph/src/subgraph/SubgraphIONodeBase'
import type { SubgraphInputNode } from '@/lib/litegraph/src/subgraph/SubgraphInputNode'
import type { SubgraphOutputNode } from '@/lib/litegraph/src/subgraph/SubgraphOutputNode'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import NodeFrame from '@/renderer/extensions/vueNodes/components/NodeFrame.vue'
import NodeResizeHandle from '@/renderer/extensions/vueNodes/components/NodeResizeHandle.vue'
import { RESIZE_HANDLES } from '@/renderer/extensions/vueNodes/interactions/resize/resizeHandleConfig'
import { cn } from '@comfyorg/tailwind-utils'
import { useSubgraphInputValuesStore } from './subgraphInputValuesStore'
import { useSubgraphIoLayout } from './useSubgraphIoLayout'

const { ioNode } = defineProps<{ ioNode: TNode }>()

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

const slots = computedWithControl(
  () => ioNode,
  (): TNode['allSlots'] => ioNode.allSlots
)
useEventListener(
  () => ioNode.subgraph.events,
  [
    'input-added',
    'removing-input',
    'renaming-input',
    'inputs-reordered',
    'output-added',
    'removing-output',
    'renaming-output',
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
    : ioNode.subgraph.name
)

const nodeView = useTemplateRef('nodeView')
const panel = computed(() => nodeView.value?.element ?? null)
const { isInput, style, startResize } = useSubgraphIoLayout(
  () => ioNode,
  panel,
  () => slots.value
)

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
  if (
    event.target instanceof Element &&
    event.target.closest('button, [role="button"]')
  )
    return
  forwardEventToCanvas(event)
}
</script>

<template>
  <NodeFrame
    ref="nodeView"
    data-subgraph-io
    :inert="canvasStore.isPickingNodes"
    role="group"
    :aria-label="title"
    :class="
      cn(
        'pointer-events-auto top-0 left-0 z-panel min-h-(--node-height) origin-top-left drop-shadow-none [--node-header:transparent]',
        isInput ? 'w-(--node-width)' : 'w-fit max-w-(--node-width)'
      )
    "
    container-class="w-full"
    :style
    @wheel="handleWheel"
    @pointerdown.capture="handlePointerDown"
    @pointermove.capture="handlePointerMove"
    @pointerup.capture="handlePointerUp"
    @pointerdown="forwardUnlessOnButton"
    @pointermove="forwardUnlessOnButton"
    @pointerup="forwardUnlessOnButton"
    @keydown="stopUnmodifiedKeys"
  >
    <div
      data-testid="subgraph-input-body"
      class="flex min-h-0 flex-1 flex-col gap-(--node-widget-gap) pt-1 pb-3"
      @contextmenu.prevent
    >
      <slot :slots />
    </div>
    <template #after>
      <div
        aria-hidden="true"
        :class="
          cn(
            'pointer-events-none absolute inset-y-0 -z-1 border-2 border-foreground',
            isInput
              ? '-right-px rounded-r-(--node-radius) border-l-0'
              : '-left-px rounded-l-(--node-radius) border-r-0'
          )
        "
        :style="{ width: `${SubgraphIONodeBase.roundedRadius}px` }"
      />
      <NodeResizeHandle
        v-if="isInput"
        :handle="RESIZE_HANDLES[0]"
        @resize="startResize"
      />
    </template>
  </NodeFrame>
</template>

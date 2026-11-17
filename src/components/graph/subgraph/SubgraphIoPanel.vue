<script
  setup
  lang="ts"
  generic="TNode extends SubgraphInputNode | SubgraphOutputNode"
>
import { computedWithControl, useEventListener } from '@vueuse/core'
import { computed, nextTick, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { omit } from 'es-toolkit'

import { useFocusNode } from '@/composables/canvas/useFocusNode'
import type { InputValueSource } from '@/core/graph/subgraph/resolveInputValueSource'
import { SubgraphIONodeBase } from '@/lib/litegraph/src/subgraph/SubgraphIONodeBase'
import type { SubgraphInputNode } from '@/lib/litegraph/src/subgraph/SubgraphInputNode'
import type { SubgraphOutputNode } from '@/lib/litegraph/src/subgraph/SubgraphOutputNode'
import {
  reorderSubgraphInputs,
  reorderSubgraphOutputs
} from '@/lib/litegraph/src/subgraph/subgraphUtils'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { useSlotLinkDragUIState } from '@/renderer/core/canvas/links/slotLinkDragUIState'
import NodeResizeHandle from '@/renderer/extensions/vueNodes/components/NodeResizeHandle.vue'
import SlotConnectionDot from '@/renderer/extensions/vueNodes/components/SlotConnectionDot.vue'
import WidgetGrid from '@/renderer/extensions/vueNodes/components/WidgetGrid.vue'
import { computeProcessedWidgets } from '@/renderer/extensions/vueNodes/composables/processedWidgetRenderModel'
import { useNodeTooltips } from '@/renderer/extensions/vueNodes/composables/useNodeTooltips'
import { RESIZE_HANDLES } from '@/renderer/extensions/vueNodes/interactions/resize/resizeHandleConfig'
import { app } from '@/scripts/app'
import { getNodeByState } from '@/utils/graphTraversalUtil'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { cn } from '@comfyorg/tailwind-utils'
import { useSubgraphInputValuesStore } from './subgraphInputValuesStore'
import { useSubgraphIoLayout } from './useSubgraphIoLayout'
import { useSubgraphIoReorder } from './useSubgraphIoReorder'

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
    'outputs-reordered',
    'configured'
  ],
  slots.trigger
)
const isInput = computed(() => ioNode.slotDirection === 'output')
const side = computed(() =>
  isInput.value
    ? {
        testId: 'subgraph-input-values',
        direction: 'input',
        panel: 'w-(--node-width)',
        row: '',
        edge: '-right-px rounded-r-(--node-radius) border-l-0'
      }
    : {
        testId: 'subgraph-output-ports',
        direction: 'output',
        panel: 'w-fit max-w-(--node-width)',
        row: 'flex-row-reverse',
        edge: '-left-px rounded-l-(--node-radius) border-r-0'
      }
)
const title = computed(() =>
  context.selected
    ? t('subgraphInputValues.instance', {
        title: context.selected.title,
        id: context.selected.id
      })
    : ioNode.subgraph.name
)

const settingStore = useSettingStore()
const { getWidgetTooltip } = useNodeTooltips('')
const sources = computed(() =>
  context.selected
    ? context.sourcesFor(context.selected)
    : new Map<string, InputValueSource>()
)

type EditableSource = Extract<InputValueSource, { kind: 'editable' }>

function editorFor(source: EditableSource) {
  const widget = computeProcessedWidgets({
    nodeData: source.node,
    widgetIds: [source.widgetId],
    graphId: canvasStore.rootGraphId,
    showAdvanced:
      !!source.node.showAdvanced ||
      settingStore.get('Comfy.Node.AlwaysShowAdvancedWidgets'),
    isGraphReady: app.isGraphReady,
    rootGraph: app.isGraphReady ? app.rootGraph : null,
    ui: { getTooltipText: getWidgetTooltip }
  }).at(0)
  return (
    widget && { owner: source.node, widget: omit(widget, ['slotMetadata']) }
  )
}

function upstreamOf(source: InputValueSource | undefined) {
  if (!source || source.kind === 'unavailable') return undefined
  return source.node === context.selected ? undefined : source.node
}

function statusOf(source: InputValueSource | undefined) {
  if (!source || source.kind === 'editable') return undefined
  return t(
    source.kind === 'linked'
      ? 'subgraphInputValues.linked'
      : 'subgraphInputValues.unavailable'
  )
}

function sourceTitleOf(source: EditableSource | undefined) {
  return source?.shared
    ? `${t('subgraphInputValues.sharedSource')}. ${t('subgraphInputValues.sourceHint')}`
    : t('subgraphInputValues.locateSource')
}

const rows = computed(() =>
  slots.value.map((port) => {
    const source = isInput.value ? sources.value.get(port.name) : undefined
    const editable = source?.kind === 'editable' ? source : undefined
    const isAddPort = port === ioNode.emptySlot
    return {
      port,
      isAddPort,
      reorderable: !isAddPort && !canvasStore.isReadOnly,
      portTestId: isAddPort
        ? `subgraph-add-${side.value.direction}`
        : `subgraph-${side.value.direction}-port`,
      portLabel: isAddPort ? undefined : port.displayName,
      shared: editable?.shared,
      editor: editable && editorFor(editable),
      upstream: upstreamOf(source),
      status: statusOf(source),
      sourceTitle: sourceTitleOf(editable)
    }
  })
)
const hint = computed(() =>
  isInput.value && !context.selected
    ? t('subgraphInputValues.enterInstanceHint')
    : undefined
)

const { focusNodeInstance } = useFocusNode()
async function locate(node: NodeState) {
  const live = getNodeByState(ioNode.subgraph.rootGraph, node)
  if (live) await focusNodeInstance(live)
}

function captureEdits() {
  useWorkflowStore().activeWorkflow?.changeTracker.captureCanvasState()
}

const { state: linkDrag } = useSlotLinkDragUIState()
function isDimmed(port: TNode['allSlots'][number]) {
  const from = linkDrag.active
    ? canvasStore.canvas?.linkConnector.renderLinks[0]?.fromSlot
    : undefined
  return !!from && !port.isValidTarget(from)
}

const panel = useTemplateRef('panel')
const { style, startResize } = useSubgraphIoLayout(
  () => ioNode,
  panel,
  () => slots.value
)

function reorder(from: number, to: number) {
  if (canvasStore.isReadOnly) return
  const order = [...ioNode.slots.keys()]
  order.splice(to, 0, ...order.splice(from, 1))
  const applied = isInput.value
    ? reorderSubgraphInputs(ioNode.subgraph, order)
    : reorderSubgraphOutputs(ioNode.subgraph, order)
  if (applied) captureEdits()
}

const { draggingIndex, rowStyle, startDrag, stepWithKeyboard } =
  useSubgraphIoReorder(
    () =>
      [
        ...(panel.value?.querySelectorAll<HTMLElement>(
          '[data-subgraph-port]'
        ) ?? [])
      ].slice(0, ioNode.slots.length),
    panel,
    reorder
  )

function isDragged(index: number) {
  return draggingIndex.value === index || undefined
}

function dragRowClass(index: number) {
  if (draggingIndex.value === undefined) return undefined
  return draggingIndex.value === index
    ? 'z-1 rounded-(--node-widget-radius) bg-node shadow-lg'
    : 'transition-transform duration-150'
}

async function stepHandle(event: KeyboardEvent, index: number, id: string) {
  if (!stepWithKeyboard(event, index, ioNode.slots.length)) return
  await nextTick()
  panel.value
    ?.querySelector<HTMLElement>(`[data-reorder-handle="${CSS.escape(id)}"]`)
    ?.focus()
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
  if (
    event.target instanceof Element &&
    event.target.closest('button, [role="button"]')
  )
    return
  forwardEventToCanvas(event)
}
</script>

<template>
  <div
    ref="panel"
    :data-testid="side.testId"
    :inert="canvasStore.isPickingNodes"
    role="group"
    :aria-label="title"
    :class="
      cn(
        'group/node lg-node pointer-events-auto absolute top-0 left-0 isolate z-panel flex min-h-(--node-height) origin-top-left cursor-grab touch-none flex-col text-xs text-node-foreground contain-layout contain-style',
        side.panel
      )
    "
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
      class="flex min-h-0 flex-1 flex-col gap-(--node-widget-gap) py-2"
      @contextmenu.prevent
      @focusout="captureEdits"
    >
      <div
        v-for="(row, index) in rows"
        :key="row.port.id"
        data-subgraph-port
        :class="
          cn(
            'relative flex min-w-0 items-center has-data-expands:min-h-0 has-data-expands:flex-1',
            side.row,
            dragRowClass(index)
          )
        "
        :style="rowStyle(index)"
      >
        <button
          v-if="row.upstream"
          type="button"
          class="absolute top-1/2 right-full mr-0.5 flex -translate-y-1/2 cursor-pointer items-center gap-1 rounded-sm border-none bg-transparent px-1 py-0.5 text-2xs whitespace-nowrap text-muted-foreground hover:text-foreground"
          :title="row.sourceTitle"
          :aria-label="t('subgraphInputValues.locateSource')"
          @click="locate(row.upstream)"
        >
          <span>{{
            t('subgraphInputValues.fromSource', {
              title: row.upstream.title,
              id: row.upstream.id
            })
          }}</span>
          <i
            v-if="row.shared"
            role="img"
            class="icon-[lucide--link] size-3"
            :aria-label="t('subgraphInputValues.sharedSource')"
          />
        </button>
        <button
          v-if="row.reorderable"
          type="button"
          :data-reorder-handle="row.port.id"
          :data-dragging="isDragged(index)"
          :aria-label="
            t('subgraphInputValues.reorderPort', { name: row.portLabel })
          "
          :title="t('subgraphInputValues.reorderHint')"
          class="flex h-(--node-widget-height) w-4 shrink-0 cursor-grab touch-none items-center justify-center rounded-sm border-none bg-transparent p-0 text-muted-foreground hover:text-foreground data-dragging:cursor-grabbing data-dragging:text-foreground"
          @pointerdown="startDrag($event, index)"
          @keydown="stepHandle($event, index, row.port.id)"
        >
          <i aria-hidden="true" class="icon-[lucide--grip-vertical] size-3.5" />
        </button>
        <div
          class="flex min-h-0 min-w-0 flex-1 flex-col self-stretch"
          :inert="canvasStore.isReadOnly"
        >
          <WidgetGrid
            v-if="row.editor"
            :key="row.editor.widget.widgetId"
            :processed-widgets="[row.editor.widget]"
            :node-id="row.editor.owner.id"
            :node-type="row.editor.owner.type"
            :node-title="row.editor.owner.title"
            :sync-layout="false"
          />
          <div
            v-else-if="!row.isAddPort"
            class="mx-3 flex h-(--node-widget-height) min-w-0 items-center gap-2 rounded-(--node-widget-radius) bg-input/50 px-3"
          >
            <span class="truncate">{{ row.port.displayName }}</span>
            <span
              class="ml-auto truncate text-muted-foreground italic empty:hidden"
              >{{ row.status }}</span
            >
          </div>
        </div>
        <div
          :data-testid="row.portTestId"
          :aria-label="row.portLabel"
          :class="
            cn(
              'lg-slot flex h-(--node-widget-height) w-0 shrink-0 cursor-crosshair items-center justify-center',
              isDimmed(row.port) && 'opacity-40'
            )
          "
        >
          <SlotConnectionDot
            data-port-anchor
            class="shrink-0"
            :slot-data="row.port"
          />
        </div>
      </div>
      <p v-if="hint" class="mx-3 my-0 text-muted-foreground">
        {{ hint }}
      </p>
    </div>
    <div
      aria-hidden="true"
      :class="
        cn(
          'pointer-events-none absolute inset-y-0 -z-1 border-2 border-foreground',
          side.edge
        )
      "
      :style="{ width: `${SubgraphIONodeBase.roundedRadius}px` }"
    />
    <NodeResizeHandle
      v-if="isInput"
      :handle="RESIZE_HANDLES[0]"
      @resize="startResize"
    />
  </div>
</template>

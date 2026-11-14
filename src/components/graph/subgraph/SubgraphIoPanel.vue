<script
  setup
  lang="ts"
  generic="TNode extends SubgraphInputNode | SubgraphOutputNode"
>
import { computedWithControl, useEventListener } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { omit } from 'es-toolkit'

import { useFocusNode } from '@/composables/canvas/useFocusNode'
import type { InputValueSource } from '@/core/graph/subgraph/resolveInputValueSource'
import { SubgraphIONodeBase } from '@/lib/litegraph/src/subgraph/SubgraphIONodeBase'
import type { SubgraphInputNode } from '@/lib/litegraph/src/subgraph/SubgraphInputNode'
import type { SubgraphOutputNode } from '@/lib/litegraph/src/subgraph/SubgraphOutputNode'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import NodeFrame from '@/renderer/extensions/vueNodes/components/NodeFrame.vue'
import NodeResizeHandle from '@/renderer/extensions/vueNodes/components/NodeResizeHandle.vue'
import WidgetGrid from '@/renderer/extensions/vueNodes/components/WidgetGrid.vue'
import { computeProcessedWidgets } from '@/renderer/extensions/vueNodes/composables/processedWidgetRenderModel'
import { useNodeTooltips } from '@/renderer/extensions/vueNodes/composables/useNodeTooltips'
import { RESIZE_HANDLES } from '@/renderer/extensions/vueNodes/interactions/resize/resizeHandleConfig'
import { app } from '@/scripts/app'
import { getNodeByState } from '@/utils/graphTraversalUtil'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { cn } from '@comfyorg/tailwind-utils'
import SubgraphIoPort from './SubgraphIoPort.vue'
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
const isInput = computed(() => ioNode === ioNode.subgraph.inputNode)
const side = computed(() =>
  isInput.value
    ? {
        testId: 'subgraph-input-values',
        panel: 'w-(--node-width)',
        row: '',
        edge: '-right-px rounded-r-(--node-radius) border-l-0'
      }
    : {
        testId: 'subgraph-output-ports',
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
    const source = isInput.value ? context.sources.get(port.name) : undefined
    const editable = source?.kind === 'editable' ? source : undefined
    return {
      port,
      isAddPort: port === ioNode.emptySlot,
      shared: editable?.shared,
      editor: editable && editorFor(editable),
      upstream: upstreamOf(source),
      status: statusOf(source),
      sourceTitle: sourceTitleOf(editable)
    }
  })
)
const hint = computed(() => {
  if (!isInput.value) return undefined
  if (!context.selected) return t('subgraphInputValues.enterInstanceHint')
  return context.sources.size ? undefined : t('subgraphInputValues.noInputs')
})

const { focusNodeInstance } = useFocusNode()
async function locate(node: NodeState) {
  const live = getNodeByState(ioNode.subgraph.rootGraph, node)
  if (live) await focusNodeInstance(live)
}

function captureEdits() {
  useWorkflowStore().activeWorkflow?.changeTracker.captureCanvasState()
}

const nodeView = useTemplateRef('nodeView')
const panel = computed(() => nodeView.value?.element ?? null)
const { style, startResize } = useSubgraphIoLayout(
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
    :data-testid="side.testId"
    :inert="canvasStore.isPickingNodes"
    role="group"
    :aria-label="title"
    :class="
      cn(
        'pointer-events-auto top-0 left-0 z-panel min-h-(--node-height) origin-top-left',
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
      class="flex min-h-0 flex-1 flex-col gap-(--node-widget-gap) pt-1 pb-3"
      @contextmenu.prevent
      @focusout="captureEdits"
    >
      <div
        v-for="row in rows"
        :key="row.port.id"
        data-subgraph-port
        :class="
          cn(
            'relative flex min-w-0 items-center has-data-expands:min-h-0 has-data-expands:flex-1',
            side.row
          )
        "
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
        <SubgraphIoPort :port="row.port" :label="row.port.displayName" />
      </div>
      <p v-if="hint" class="mx-3 my-0 text-muted-foreground">
        {{ hint }}
      </p>
    </div>
    <template #after>
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
    </template>
  </NodeFrame>
</template>

<script setup lang="ts">
import {
  useDebounceFn,
  useEventListener,
  useResizeObserver
} from '@vueuse/core'
import { computed, provide, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Popover from '@/components/ui/Popover.vue'
import Button from '@/components/ui/button/Button.vue'
import { extractVueNodeData } from '@/composables/graph/useGraphNodeManager'
import { OverlayAppendToKey } from '@/composables/useTransformCompatOverlayProps'
import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useMaskEditor } from '@/composables/maskeditor/useMaskEditor'
import { extractWidgetStringValue } from '@/composables/maskeditor/useMaskEditorLoader'
import { appendCloudResParam } from '@/platform/distribution/cloudPreviewUtil'
import DropZone from '@/renderer/extensions/linearMode/DropZone.vue'
import NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { parseImageWidgetValue } from '@/utils/imageUtil'
import { resolveNodeWidget } from '@/utils/litegraphUtil'
import { cn } from '@/utils/tailwindUtil'
import { HideLayoutFieldKey } from '@/types/widgetTypes'
import { promptRenameWidget } from '@/utils/widgetUtil'

interface WidgetEntry {
  key: string
  nodeId: NodeId
  widgetName: string
  persistedHeight: number | undefined
  nodeData: ReturnType<typeof nodeToNodeData> & {
    widgets: NonNullable<ReturnType<typeof nodeToNodeData>['widgets']>
  }
  action: { widget: IBaseWidget; node: LGraphNode }
}

const { mobile = false, builderMode = false } = defineProps<{
  mobile?: boolean
  builderMode?: boolean
}>()

const { t } = useI18n()
const executionErrorStore = useExecutionErrorStore()
const appModeStore = useAppModeStore()
const maskEditor = useMaskEditor()

interface ResizableEntry {
  el: HTMLElement
  nodeId: NodeId
  widgetName: string
}
const resizablesByKey = new Map<string, ResizableEntry>()
const resizablesByEl = new WeakMap<HTMLElement, ResizableEntry>()
const observedElements = shallowRef<HTMLElement[]>([])

const persistHeight = useDebounceFn(
  (nodeId: NodeId, widgetName: string, height: number) => {
    appModeStore.updateInputConfig(nodeId, widgetName, { height })
  },
  100
)

useResizeObserver(observedElements, (entries) => {
  for (const entry of entries) {
    const el = entry.target as HTMLElement
    // Only persist user-initiated resizes (browser sets inline style.height on drag)
    if (!el.style.height) continue
    const info = resizablesByEl.get(el)
    if (!info) continue
    persistHeight(info.nodeId, info.widgetName, el.offsetHeight)
  }
})

function trackResizable(
  el: unknown,
  key: string,
  nodeId: NodeId,
  widgetName: string
) {
  const prev = resizablesByKey.get(key)
  if (prev) resizablesByEl.delete(prev.el)
  resizablesByKey.delete(key)

  if (el instanceof HTMLElement) {
    // Queries match elements owned by DropZone (data-slot="drop-zone-indicator")
    // and NodeWidgets (textarea).
    const resizable =
      el.querySelector<HTMLElement>('textarea') ??
      el.querySelector<HTMLElement>('[data-slot="drop-zone-indicator"]')
    if (resizable) {
      const entry = { el: resizable, nodeId, widgetName }
      resizablesByKey.set(key, entry)
      resizablesByEl.set(resizable, entry)
    }
  }

  observedElements.value = [...resizablesByKey.values()].map((r) => r.el)
}

provide(HideLayoutFieldKey, true)
provide(OverlayAppendToKey, 'body')

const graphNodes = shallowRef<LGraphNode[]>(app.rootGraph.nodes)
useEventListener(
  app.rootGraph.events,
  'configured',
  () => (graphNodes.value = app.rootGraph.nodes)
)

const mappedSelections = computed((): WidgetEntry[] => {
  void graphNodes.value
  const nodeDataByNode = new Map<
    LGraphNode,
    ReturnType<typeof nodeToNodeData>
  >()

  return appModeStore.selectedInputs.flatMap(([nodeId, widgetName, config]) => {
    const [node, widget] = resolveNodeWidget(nodeId, widgetName)
    if (!widget || !node || node.mode !== LGraphEventMode.ALWAYS) return []

    if (!nodeDataByNode.has(node)) {
      nodeDataByNode.set(node, nodeToNodeData(node))
    }
    const fullNodeData = nodeDataByNode.get(node)!

    const matchingWidget = fullNodeData.widgets?.find((vueWidget) => {
      if (vueWidget.slotMetadata?.linked) return false

      if (!node.isSubgraphNode()) return vueWidget.name === widget.name

      const storeNodeId = vueWidget.storeNodeId?.split(':')?.[1] ?? ''
      return (
        isPromotedWidgetView(widget) &&
        widget.sourceNodeId == storeNodeId &&
        widget.sourceWidgetName === vueWidget.storeName
      )
    })
    if (!matchingWidget) return []

    matchingWidget.slotMetadata = undefined
    matchingWidget.nodeId = String(node.id)

    return [
      {
        key: `${nodeId}:${widgetName}`,
        nodeId,
        widgetName,
        persistedHeight: config?.height,
        nodeData: {
          ...fullNodeData,
          widgets: [matchingWidget]
        },
        action: { widget, node }
      }
    ]
  })
})

function getDropIndicator(node: LGraphNode) {
  if (node.type !== 'LoadImage') return undefined

  const stringValue = extractWidgetStringValue(node.widgets?.[0]?.value)

  const { filename, subfolder, type } = stringValue
    ? parseImageWidgetValue(stringValue)
    : { filename: '', subfolder: '', type: 'input' }

  const buildImageUrl = () => {
    if (!filename) return undefined
    const params = new URLSearchParams({ filename, subfolder, type })
    appendCloudResParam(params, filename)
    return api.apiURL(`/view?${params}${app.getPreviewFormatParam()}`)
  }

  const imageUrl = buildImageUrl()

  return {
    iconClass: 'icon-[lucide--image]',
    imageUrl,
    label: mobile ? undefined : t('linearMode.dragAndDropImage'),
    onClick: () => node.widgets?.[1]?.callback?.(undefined),
    onMaskEdit: imageUrl ? () => maskEditor.openMaskEditor(node) : undefined
  }
}

function nodeToNodeData(node: LGraphNode) {
  const dropIndicator = getDropIndicator(node)
  const nodeData = extractVueNodeData(node)

  return {
    ...nodeData,
    hasErrors: !!executionErrorStore.lastNodeErrors?.[node.id],
    dropIndicator,
    onDragDrop: node.onDragDrop,
    onDragOver: node.onDragOver
  }
}

async function handleDragDrop(e: DragEvent) {
  for (const { nodeData } of mappedSelections.value) {
    if (!nodeData?.onDragOver?.(e)) continue

    const rawResult = nodeData?.onDragDrop?.(e)
    if (rawResult === false) continue

    e.stopPropagation()
    e.preventDefault()
    if ((await rawResult) === true) return
  }
}

defineExpose({ handleDragDrop })
</script>
<template>
  <div
    v-for="{
      key,
      nodeId,
      widgetName,
      persistedHeight,
      nodeData,
      action
    } in mappedSelections"
    :key
    :class="
      cn(
        builderMode &&
          'draggable-item drag-handle pointer-events-auto relative cursor-grab [&.is-draggable]:cursor-grabbing'
      )
    "
    :aria-label="
      builderMode
        ? `${action.widget.label ?? action.widget.name} — ${action.node.title}`
        : undefined
    "
    :data-testid="builderMode ? 'builder-widget-item' : 'app-mode-widget-item'"
    :data-widget-key="key"
  >
    <div
      :class="
        cn(
          'mt-1.5 flex min-h-8 items-center gap-1 px-3',
          builderMode && 'drag-handle'
        )
      "
    >
      <span
        :class="cn('truncate text-sm/8', builderMode && 'pointer-events-none')"
        data-testid="builder-widget-label"
      >
        {{ action.widget.label || action.widget.name }}
      </span>
      <span
        v-if="builderMode"
        class="pointer-events-none mx-1 min-w-10 flex-1 truncate text-right text-xs text-muted-foreground"
      >
        {{ action.node.title }}
      </span>
      <div v-else class="flex-1" />
      <Popover
        :class="cn('shrink-0', builderMode && 'pointer-events-auto')"
        :entries="[
          {
            label: t('g.rename'),
            icon: 'icon-[lucide--pencil]',
            command: () => promptRenameWidget(action.widget, action.node, t)
          },
          {
            label: t('g.remove'),
            icon: 'icon-[lucide--x]',
            command: () =>
              appModeStore.removeSelectedInput(action.widget, action.node)
          }
        ]"
      >
        <template #button>
          <Button
            variant="textonly"
            size="icon"
            data-testid="widget-actions-menu"
          >
            <i class="icon-[lucide--ellipsis]" />
          </Button>
        </template>
      </Popover>
    </div>
    <div
      :ref="(el) => trackResizable(el, key, nodeId, widgetName)"
      :class="builderMode && 'pointer-events-none'"
      :inert="builderMode || undefined"
    >
      <DropZone
        :on-drag-over="nodeData.onDragOver"
        :on-drag-drop="nodeData.onDragDrop"
        :drop-indicator="nodeData.dropIndicator"
        :persisted-height="nodeData.dropIndicator ? persistedHeight : undefined"
        class="text-muted-foreground"
      >
        <NodeWidgets
          :node-data
          :style="
            !nodeData.dropIndicator && persistedHeight
              ? { '--persisted-height': `${persistedHeight}px` }
              : undefined
          "
          :class="
            cn(
              'gap-y-3 rounded-lg py-1 [&_textarea]:resize-y **:[.col-span-2]:grid-cols-1 not-md:**:[.h-7]:h-10',
              !nodeData.dropIndicator &&
                persistedHeight &&
                '[&_textarea]:h-(--persisted-height)',
              nodeData.hasErrors && 'ring-2 ring-node-stroke-error ring-inset'
            )
          "
        />
      </DropZone>
    </div>
  </div>
</template>

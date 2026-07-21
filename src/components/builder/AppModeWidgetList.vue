<script setup lang="ts">
import { computed, provide } from 'vue'

import { useAppModeWidgetResizing } from '@/components/builder/useAppModeWidgetResizing'
import { useResolvedSelectedInputs } from '@/components/builder/useResolvedSelectedInputs'
import { useI18n } from 'vue-i18n'

import Popover from '@/components/ui/Popover.vue'
import Button from '@/components/ui/button/Button.vue'
import { extractVueNodeData } from '@/composables/graph/useGraphNodeManager'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
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
import { cn } from '@comfyorg/tailwind-utils'
import { HideLayoutFieldKey, WidgetHeightKey } from '@/types/widgetTypes'
import { UNASSIGNED_NODE_ID } from '@/types/nodeId'
import { promptRenameWidget } from '@/utils/widgetUtil'

interface WidgetAction {
  widget: IBaseWidget
  node: LGraphNode
}

interface AvailableWidgetEntry {
  status: 'available'
  key: string
  label: string
  nodeTitle: string
  persistedHeight: number | undefined
  nodeData: ReturnType<typeof nodeToNodeData> & {
    widgets: NonNullable<ReturnType<typeof nodeToNodeData>['widgets']>
  }
  action: WidgetAction
}

interface UnavailableWidgetEntry {
  status: 'unavailable'
  key: string
  label: string
  nodeTitle?: string
  action?: WidgetAction
}

type WidgetEntry = AvailableWidgetEntry | UnavailableWidgetEntry

const { mobile = false, builderMode = false } = defineProps<{
  mobile?: boolean
  builderMode?: boolean
}>()

const { t } = useI18n()
const executionErrorStore = useExecutionErrorStore()
const appModeStore = useAppModeStore()
const maskEditor = useMaskEditor()

const { onPointerDown } = useAppModeWidgetResizing((widget, config) =>
  appModeStore.updateInputConfig(widget, config)
)

provide(HideLayoutFieldKey, true)
provide(WidgetHeightKey, mobile ? 'h-10' : 'h-7')

const resolvedInputs = useResolvedSelectedInputs()

const mappedSelections = computed((): WidgetEntry[] => {
  const nodeDataByNode = new Map<
    LGraphNode,
    ReturnType<typeof nodeToNodeData>
  >()

  return resolvedInputs.value.flatMap((entry): WidgetEntry[] => {
    if (entry.status !== 'resolved') {
      return [
        {
          status: 'unavailable',
          key: entry.widgetId,
          label: entry.displayName
        }
      ]
    }
    const { widgetId, node, widget, config } = entry
    if (node.mode !== LGraphEventMode.ALWAYS) {
      return [
        {
          status: 'unavailable',
          key: widgetId,
          label: widget.label || widget.name,
          nodeTitle: node.title,
          action: { widget, node }
        }
      ]
    }

    if (!nodeDataByNode.has(node)) {
      nodeDataByNode.set(node, nodeToNodeData(node))
    }
    const fullNodeData = nodeDataByNode.get(node)!

    const matchingWidget = fullNodeData.widgets?.find((vueWidget) => {
      if (vueWidget.slotMetadata?.linked) return false
      return vueWidget.widgetId === widgetId
    })
    if (!matchingWidget) return []

    matchingWidget.slotMetadata = undefined
    matchingWidget.nodeId = node.id

    return [
      {
        status: 'available',
        key: widgetId,
        label: widget.label || widget.name,
        nodeTitle: node.title,
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

function widgetMenuEntries({ widget, node }: WidgetAction) {
  return [
    {
      label: t('g.rename'),
      icon: 'icon-[lucide--pencil]',
      command: () => promptRenameWidget(widget, node, t)
    },
    {
      label: t('g.remove'),
      icon: 'icon-[lucide--x]',
      command: () => appModeStore.removeSelectedInput(widget)
    }
  ]
}

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
    hasErrors: !!executionErrorStore.surfacedNodeErrors?.[node.id],
    dropIndicator,
    onDragDrop: node.onDragDrop,
    onDragOver: node.onDragOver
  }
}

async function handleDragDrop() {
  const onDragDrop = async (e: DragEvent) => {
    for (const entry of mappedSelections.value)
      if (
        entry.status === 'available' &&
        entry.nodeData.onDragOver?.(e) &&
        (await entry.nodeData.onDragDrop?.(e))
      )
        return true
    return false
  }

  app.dragOverNode = { id: UNASSIGNED_NODE_ID, onDragDrop }
}

defineExpose({ handleDragDrop })
</script>
<template>
  <div
    v-for="entry in mappedSelections"
    :key="entry.key"
    :class="
      cn(
        builderMode &&
          'draggable-item drag-handle pointer-events-auto relative cursor-grab [&.is-draggable]:cursor-grabbing'
      )
    "
    :aria-label="
      builderMode
        ? [entry.label, entry.nodeTitle].filter(Boolean).join(' — ')
        : undefined
    "
    :data-testid="builderMode ? 'builder-widget-item' : 'app-mode-widget-item'"
    :data-widget-key="entry.key"
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
        {{ entry.label }}
      </span>
      <span
        v-if="builderMode && entry.nodeTitle"
        class="pointer-events-none mx-1 min-w-10 flex-1 truncate text-right text-xs text-muted-foreground"
      >
        {{ entry.nodeTitle }}
      </span>
      <div v-else class="flex-1" />
      <Popover
        v-if="entry.action"
        :class="cn('shrink-0', builderMode && 'pointer-events-auto')"
        :entries="widgetMenuEntries(entry.action)"
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
      v-if="entry.status === 'available'"
      :style="
        entry.persistedHeight
          ? { '--persisted-height': `${entry.persistedHeight}px` }
          : undefined
      "
      :class="
        cn(
          builderMode && 'pointer-events-none',
          entry.persistedHeight &&
            '**:data-[slot=drop-zone-indicator]:h-(--persisted-height) [&_textarea]:h-(--persisted-height)'
        )
      "
      :inert="builderMode || undefined"
      @pointerdown.capture="(e) => onPointerDown(entry.action.widget, e)"
    >
      <DropZone
        :on-drag-over="entry.nodeData.onDragOver"
        :on-drag-drop="entry.nodeData.onDragDrop"
        :drop-indicator="entry.nodeData.dropIndicator"
        class="text-muted-foreground"
      >
        <NodeWidgets
          :node-data="entry.nodeData"
          :class="
            cn(
              'gap-y-3 rounded-lg py-1 [&_textarea]:resize-y **:[.col-span-2]:grid-cols-1',
              entry.nodeData.hasErrors &&
                'ring-2 ring-node-stroke-error ring-inset'
            )
          "
        />
      </DropZone>
    </div>
    <div
      v-else
      class="mx-3 mb-1.5 flex items-center gap-2 rounded-lg border border-dashed border-border-subtle px-3 py-2 text-sm text-muted-foreground"
      data-testid="widget-unavailable"
    >
      <i class="icon-[lucide--eye-off] shrink-0" />
      <span>{{ t('linearMode.widgetUnavailable') }}</span>
    </div>
  </div>
</template>

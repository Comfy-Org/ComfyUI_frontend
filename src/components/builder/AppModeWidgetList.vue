<script setup lang="ts">
import { computed, provide } from 'vue'

import { useAppModeWidgetResizing } from '@/components/builder/useAppModeWidgetResizing'
import { useResolvedSelectedInputs } from '@/components/builder/useResolvedSelectedInputs'
import { useI18n } from 'vue-i18n'

import Popover from '@/components/ui/Popover.vue'
import Button from '@/components/ui/button/Button.vue'
import { extractVueNodeData } from '@/composables/graph/useGraphNodeManager'
import { UNASSIGNED_NODE_ID } from '@/lib/litegraph/src/utils/nodeId'
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
import { HideLayoutFieldKey } from '@/types/widgetTypes'
import { promptRenameWidget } from '@/utils/widgetUtil'

interface WidgetEntry {
  key: string
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

const { onPointerDown } = useAppModeWidgetResizing((widget, config) =>
  appModeStore.updateInputConfig(widget, config)
)

provide(HideLayoutFieldKey, true)

const resolvedInputs = useResolvedSelectedInputs()

const mappedSelections = computed((): WidgetEntry[] => {
  const nodeDataByNode = new Map<
    LGraphNode,
    ReturnType<typeof nodeToNodeData>
  >()

  return resolvedInputs.value.flatMap((entry) => {
    if (entry.status !== 'resolved') return []
    const { widgetId, node, widget, config } = entry
    if (node.mode !== LGraphEventMode.ALWAYS) return []

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
        key: widgetId,
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

async function handleDragDrop() {
  const onDragDrop = async (e: DragEvent) => {
    for (const { nodeData } of mappedSelections.value)
      if (nodeData?.onDragOver?.(e) && (await nodeData.onDragDrop?.(e)))
        return true
    return false
  }

  app.dragOverNode = { id: UNASSIGNED_NODE_ID, onDragDrop }
}

defineExpose({ handleDragDrop })
</script>
<template>
  <div
    v-for="{ key, persistedHeight, nodeData, action } in mappedSelections"
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
            command: () => appModeStore.removeSelectedInput(action.widget)
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
      :style="
        persistedHeight
          ? { '--persisted-height': `${persistedHeight}px` }
          : undefined
      "
      :class="
        cn(
          builderMode && 'pointer-events-none',
          persistedHeight &&
            '**:data-[slot=drop-zone-indicator]:h-(--persisted-height) [&_textarea]:h-(--persisted-height)'
        )
      "
      :inert="builderMode || undefined"
      @pointerdown.capture="(e) => onPointerDown(action.widget, e)"
    >
      <DropZone
        :on-drag-over="nodeData.onDragOver"
        :on-drag-drop="nodeData.onDragDrop"
        :drop-indicator="nodeData.dropIndicator"
        class="text-muted-foreground"
      >
        <NodeWidgets
          :node-data
          :class="
            cn(
              'gap-y-3 rounded-lg py-1 [&_textarea]:resize-y **:[.col-span-2]:grid-cols-1 not-md:**:[.h-7]:h-10',
              nodeData.hasErrors && 'ring-2 ring-node-stroke-error ring-inset'
            )
          "
        />
      </DropZone>
    </div>
  </div>
</template>

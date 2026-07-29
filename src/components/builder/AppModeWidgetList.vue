<script setup lang="ts">
import { computed, provide } from 'vue'

import { useAppModeWidgetResizing } from '@/components/builder/useAppModeWidgetResizing'
import { useResolvedSelectedInputs } from '@/components/builder/useResolvedSelectedInputs'
import { useI18n } from 'vue-i18n'

import Popover from '@/components/ui/Popover.vue'
import Button from '@/components/ui/button/Button.vue'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { deriveWidgetRenderState } from '@/lib/litegraph/src/utils/widget'
import type { WidgetId } from '@/types/widgetId'
import { useMaskEditor } from '@/composables/maskeditor/useMaskEditor'
import { extractWidgetStringValue } from '@/composables/maskeditor/useMaskEditorLoader'
import { appendCloudResParam } from '@/platform/distribution/cloudPreviewUtil'
import DropZone from '@/renderer/extensions/linearMode/DropZone.vue'
import NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useLinkStore } from '@/stores/linkStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { parseImageWidgetValue } from '@/utils/imageUtil'
import { cn } from '@comfyorg/tailwind-utils'
import { HideLayoutFieldKey, WidgetHeightKey } from '@/types/widgetTypes'
import { UNASSIGNED_NODE_ID } from '@/types/nodeId'
import { promptRenameWidget } from '@/utils/widgetUtil'

interface WidgetEntry {
  key: string
  persistedHeight: number | undefined
  nodeData: ReturnType<typeof nodeToNodeData>
  widgetIds: readonly WidgetId[]
  action: { widget: IBaseWidget; node: LGraphNode }
}

const { mobile = false, builderMode = false } = defineProps<{
  mobile?: boolean
  builderMode?: boolean
}>()

const { t } = useI18n()
const executionErrorStore = useExecutionErrorStore()
const appModeStore = useAppModeStore()
const widgetValueStore = useWidgetValueStore()
const linkStore = useLinkStore()
const maskEditor = useMaskEditor()

const { onPointerDown } = useAppModeWidgetResizing((widget, config) =>
  appModeStore.updateInputConfig(widget, config)
)

provide(HideLayoutFieldKey, true)
provide(WidgetHeightKey, mobile ? 'h-10' : 'h-7')

const resolvedInputs = useResolvedSelectedInputs()

function ensureSelectedWidgetState(
  widgetId: WidgetId,
  widget: IBaseWidget
): void {
  if (widgetValueStore.getWidget(widgetId)) return

  widgetValueStore.registerWidget(
    widgetId,
    {
      type: widget.type,
      value: widget.value,
      options: widget.options,
      label: widget.label,
      serialize: widget.serialize,
      disabled: widget.disabled
    },
    deriveWidgetRenderState(widget)
  )
}

function isWidgetInputLinked(node: LGraphNode, widgetName: string): boolean {
  const graphId = node.graph?.rootGraph.id
  const slot = node.inputs?.findIndex((i) => i.widget?.name === widgetName)
  if (!graphId || slot === undefined || slot < 0) return false
  return linkStore.isInputSlotConnected(graphId, node.id, slot)
}

const mappedSelections = computed((): WidgetEntry[] => {
  return resolvedInputs.value.flatMap((entry) => {
    if (entry.status !== 'resolved') return []
    const { widgetId, node, widget, config } = entry
    if (node.mode !== LGraphEventMode.ALWAYS) return []

    ensureSelectedWidgetState(widgetId, widget)
    const fullNodeData = nodeToNodeData(node, widgetId)
    if (isWidgetInputLinked(node, widget.name)) return []

    return [
      {
        key: widgetId,
        persistedHeight: config?.height,
        nodeData: fullNodeData,
        widgetIds: [widgetId],
        action: { widget, node }
      }
    ]
  })
})

function getDropIndicator(node: LGraphNode, id: WidgetId) {
  if (node.type !== 'LoadImage') return undefined

  const stringValue = extractWidgetStringValue(
    widgetValueStore.getWidget(id)?.value
  )

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

function nodeToNodeData(node: LGraphNode, id: WidgetId) {
  const dropIndicator = getDropIndicator(node, id)

  return {
    ...node._state,
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
    v-for="{
      key,
      persistedHeight,
      nodeData,
      widgetIds,
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
          :widget-ids
          :class="
            cn(
              'gap-y-3 rounded-lg py-1 [&_textarea]:resize-y **:[.col-span-2]:grid-cols-1',
              nodeData.hasErrors && 'ring-2 ring-node-stroke-error ring-inset'
            )
          "
        />
      </DropZone>
    </div>
  </div>
</template>

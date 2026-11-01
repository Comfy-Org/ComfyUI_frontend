<script setup lang="ts">
import { computed, provide, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MenuItem } from '@comfyorg/design-system/menu/types'

import WidgetDescription from '@/components/builder/WidgetDescription.vue'
import { useAppModeWidgetResizing } from '@/components/builder/useAppModeWidgetResizing'
import { getLoaderDropIndicator } from '@/components/builder/useLoaderDropIndicator'
import { useResolvedSelectedInputs } from '@/components/builder/useResolvedSelectedInputs'
import {
  autoGroupName,
  createInputLinkChecker,
  isRenderableAppInput
} from '@/components/builder/useInputGroups'
import Button from '@comfyorg/design-system/button/Button'
import Menu from '@comfyorg/design-system/menu/Menu'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LGraphEventMode } from '@comfyorg/graph-model/globalEnums'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import { deriveWidgetRenderState } from '@/lib/litegraph/src/utils/widget'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import { useMaskEditor } from '@/renderer/extensions/maskEditor/composables/useMaskEditor'
import DropZone from '@/renderer/extensions/linearMode/DropZone.vue'
import NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'
import { app } from '@/scripts/app'
import { draggableItemClass } from '@/scripts/ui/draggableList'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useLinkStore } from '@/stores/linkStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { useInputGroupStore } from '@/stores/inputGroupStore'
import { useTemplateInputDownloadStore } from '@/platform/workflow/templates/stores/templateInputDownloadStore'
import { cn } from '@comfyorg/tailwind-utils'
import { HideLayoutFieldKey, WidgetHeightKey } from '@/types/widgetTypes'
import { UNASSIGNED_NODE_ID } from '@comfyorg/graph-model/nodeId'
import { promptRenameWidget } from '@/utils/widgetUtil'

interface WidgetEntry {
  key: string
  persistedHeight: number | undefined
  nodeData: ReturnType<typeof nodeToNodeData>
  widgetIds: readonly WidgetId[]
  action: { widgetId: WidgetId; widget: IBaseWidget; node: LGraphNode }
  description?: string
}

const {
  mobile = false,
  builderMode = false,
  widgetIds,
  hideActions = false,
  draggable = true
} = defineProps<{
  mobile?: boolean
  builderMode?: boolean
  widgetIds?: readonly WidgetId[]
  hideActions?: boolean
  draggable?: boolean
}>()

const { t } = useI18n()
const executionErrorStore = useExecutionErrorStore()
const appModeStore = useAppModeStore()
const inputGroupStore = useInputGroupStore()
const templateInputDownloadStore = useTemplateInputDownloadStore()
const widgetValueStore = useWidgetValueStore()
const linkStore = useLinkStore()
const isInputLinked = createInputLinkChecker(linkStore)
const maskEditor = useMaskEditor()

const { onPointerDown } = useAppModeWidgetResizing((widget, config) =>
  appModeStore.updateInputConfig(widget, config)
)

provide(HideLayoutFieldKey, true)
provide(WidgetHeightKey, mobile ? 'h-10' : 'h-7')

const resolvedInputs = useResolvedSelectedInputs()
const isDraggable = computed(() => builderMode && draggable)
const widgetIdFilter = computed(() =>
  widgetIds ? new Set(widgetIds) : undefined
)

function shouldRender(widgetId: WidgetId): boolean {
  const includedIds = widgetIdFilter.value
  return includedIds
    ? includedIds.has(widgetId)
    : !inputGroupStore.isGrouped(widgetId)
}

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

watchEffect(() => {
  for (const entry of resolvedInputs.value) {
    if (!isRenderableAppInput(entry, isInputLinked)) continue
    if (!shouldRender(entry.widgetId)) continue
    ensureSelectedWidgetState(entry.widgetId, entry.widget)
  }
})

const mappedSelections = computed((): WidgetEntry[] => {
  return resolvedInputs.value.flatMap((entry) => {
    if (!isRenderableAppInput(entry, isInputLinked)) return []
    const { widgetId, node, widget, config } = entry
    if (!shouldRender(widgetId)) return []
    const fullNodeData = nodeToNodeData(node, widgetId)

    return [
      {
        key: widgetId,
        persistedHeight: config?.height,
        description: config?.description,
        nodeData: fullNodeData,
        widgetIds: [widgetId],
        action: { widgetId, widget, node }
      }
    ]
  })
})

function getDropIndicator(node: LGraphNode, id: WidgetId) {
  return getLoaderDropIndicator(node, id, {
    mobile,
    label: t,
    onMaskEdit: maskEditor.openMaskEditor,
    widgetValueStore,
    previewRevision: templateInputDownloadStore.previewRevision
  })
}

function nodeToNodeData(node: LGraphNode, id: WidgetId) {
  const dropIndicator = getDropIndicator(node, id)

  return {
    ...node._state,
    hasErrors: !!executionErrorStore.surfacedNodeErrors?.[node.id],
    dropIndicator,
    onDragDrop: node.onDragDrop,
    onDragOver: node.onDragOver
  }
}

async function handleDragDrop() {
  const onDragDrop = async (e: DragEvent) => {
    for (const entry of resolvedInputs.value) {
      if (!isRenderableAppInput(entry, isInputLinked)) continue
      const { node, widgetId } = entry
      const nodeData = nodeToNodeData(node, widgetId)
      if (nodeData.onDragOver?.(e) && (await nodeData.onDragDrop?.(e)))
        return true
    }
    return false
  }

  app.dragOverNode = { id: UNASSIGNED_NODE_ID, onDragDrop }
}

function buildMenuEntries(action: WidgetEntry['action']): MenuItem[] {
  const entries: MenuItem[] = [
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
  ]
  if (!builderMode) return entries

  const currentGroup = inputGroupStore.inputGroups.find((group) =>
    group.items.some((item) => item.key === action.widgetId)
  )
  entries.push({ separator: true })
  if (currentGroup) {
    entries.push({
      label: t('linearMode.groups.removeFromGroup'),
      icon: 'icon-[lucide--ungroup]',
      command: () =>
        inputGroupStore.removeItemFromGroup(currentGroup.id, action.widgetId)
    })
  }

  for (const group of inputGroupStore.inputGroups) {
    if (group.id === currentGroup?.id) continue
    const name = group.name ?? autoGroupName(group, resolvedInputs.value)
    entries.push({
      label: t('linearMode.groups.addToGroupNamed', { name }),
      icon: 'icon-[lucide--group]',
      command: () => inputGroupStore.addItemToGroup(group.id, action.widgetId)
    })
  }
  entries.push({
    label: t('linearMode.groups.newGroup'),
    icon: 'icon-[lucide--plus]',
    command: () => inputGroupStore.createGroup(undefined, action.widgetId)
  })
  return entries
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
      action,
      description
    } in mappedSelections"
    :key
    :class="cn(isDraggable && ['pointer-events-auto', draggableItemClass])"
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
      <Menu
        v-if="!hideActions"
        :class="cn('shrink-0', builderMode && 'pointer-events-auto')"
        :items="buildMenuEntries(action)"
      >
        <template #trigger>
          <Button
            variant="textonly"
            size="icon"
            data-testid="widget-actions-menu"
          >
            <!-- fallow-ignore-next-line css-token-drift -->
            <i class="icon-[lucide--ellipsis]" />
          </Button>
        </template>
      </Menu>
    </div>
    <div
      v-if="description || builderMode"
      data-testid="app-mode-widget-description"
      class="h-5 px-5 text-muted-foreground"
    >
      <WidgetDescription
        :description
        label-class="drag-handle"
        label-type="div"
        :disabled="!builderMode"
        :widget="action.widget"
      />
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
              nodeData.hasErrors && 'ring-2 ring-destructive ring-inset'
            )
          "
        />
      </DropZone>
    </div>
  </div>
</template>

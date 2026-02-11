<script setup lang="ts">
import { computed, inject, provide, ref, shallowRef, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { isProxyWidget } from '@/core/graph/subgraph/proxyWidget'
import { parseProxyWidgets } from '@/core/schemas/proxyWidget'
import type {
  LGraphGroup,
  LGraphNode,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'
import { app } from '@/scripts/app'

import PropertiesAccordionItem from '../layout/PropertiesAccordionItem.vue'
import { HideLayoutFieldKey } from '@/types/widgetTypes'

import { GetNodeParentGroupKey } from '../shared'
import WidgetItem from './WidgetItem.vue'

const {
  label,
  node,
  widgets: widgetsProp,
  showLocateButton = false,
  isDraggable = false,
  hiddenFavoriteIndicator = false,
  showNodeName = false,
  parents = [],
  enableEmptyState = false,
  tooltip
} = defineProps<{
  label?: string
  parents?: SubgraphNode[]
  node?: LGraphNode
  widgets: { widget: IBaseWidget; node: LGraphNode }[]
  showLocateButton?: boolean
  isDraggable?: boolean
  hiddenFavoriteIndicator?: boolean
  showNodeName?: boolean
  /**
   * Whether to show the empty state slot when there are no widgets.
   */
  enableEmptyState?: boolean
  tooltip?: string
}>()

const collapse = defineModel<boolean>('collapse', { default: false })

const widgetsContainer = ref<HTMLElement>()
const rootElement = ref<HTMLElement>()

const widgets = shallowRef(widgetsProp)
watchEffect(() => (widgets.value = widgetsProp))

provide(HideLayoutFieldKey, true)

const canvasStore = useCanvasStore()
const executionStore = useExecutionStore()
const rightSidePanelStore = useRightSidePanelStore()
const { t } = useI18n()

/**
 * Checks whether the current node has errors from lastNodeErrors or lastExecutionError.
 * Uses execution ID mapping to match graph node IDs.
 */
const nodeHasError = computed(() => {
  if (!targetNode.value) return false
  const nodeId = targetNode.value.id

  // Check lastNodeErrors (validation errors from 400 Bad Request)
  if (executionStore.lastNodeErrors) {
    for (const executionId of Object.keys(executionStore.lastNodeErrors)) {
      const graphNode = getNodeByExecutionId(app.rootGraph, executionId)
      if (graphNode && String(graphNode.id) === String(nodeId)) return true
    }
  }

  // Check lastExecutionError (runtime WebSocket error)
  if (executionStore.lastExecutionError) {
    const execNodeId = String(executionStore.lastExecutionError.node_id)
    const graphNode = getNodeByExecutionId(app.rootGraph, execNodeId)
    if (graphNode && String(graphNode.id) === String(nodeId)) return true
  }

  return false
})

/** Switches the right side panel to the Errors tab. */
function navigateToErrorTab() {
  rightSidePanelStore.openPanel('errors')
}

const getNodeParentGroup = inject(GetNodeParentGroupKey, null)

function isWidgetShownOnParents(
  widgetNode: LGraphNode,
  widget: IBaseWidget
): boolean {
  if (!parents.length) return false
  const proxyWidgets = parseProxyWidgets(parents[0].properties.proxyWidgets)

  // For proxy widgets (already promoted), check using overlay information
  if (isProxyWidget(widget)) {
    return proxyWidgets.some(
      ([nodeId, widgetName]) =>
        widget._overlay.nodeId == nodeId &&
        widget._overlay.widgetName === widgetName
    )
  }

  // For regular widgets (not yet promoted), check using node ID and widget name
  return proxyWidgets.some(
    ([nodeId, widgetName]) =>
      widgetNode.id == nodeId && widget.name === widgetName
  )
}

const isEmpty = computed(() => widgets.value.length === 0)

const displayLabel = computed(
  () => label ?? (node ? node.title : t('rightSidePanel.inputs'))
)

const targetNode = computed<LGraphNode | null>(() => {
  if (node) return node
  if (isEmpty.value) return null

  const firstNodeId = widgets.value[0].node.id
  const allSameNode = widgets.value.every(({ node }) => node.id === firstNodeId)

  return allSameNode ? widgets.value[0].node : null
})

const parentGroup = computed<LGraphGroup | null>(() => {
  if (!targetNode.value || !getNodeParentGroup) return null
  return getNodeParentGroup(targetNode.value)
})

const canShowLocateButton = computed(
  () => showLocateButton && targetNode.value !== null
)

function handleLocateNode() {
  if (!targetNode.value || !canvasStore.canvas) return

  const graphNode = canvasStore.canvas.graph?.getNodeById(targetNode.value.id)
  if (graphNode) {
    canvasStore.canvas.animateToBounds(graphNode.boundingRect)
  }
}

function handleWidgetValueUpdate(
  widget: IBaseWidget,
  newValue: string | number | boolean | object
) {
  widget.value = newValue
  widget.callback?.(newValue)
  canvasStore.canvas?.setDirty(true, true)
}

defineExpose({
  widgetsContainer,
  rootElement
})
</script>

<template>
  <div ref="rootElement">
    <PropertiesAccordionItem
      v-model:collapse="collapse"
      :enable-empty-state
      :disabled="isEmpty"
      :tooltip
    >
      <template #label>
        <div class="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <span class="flex-1 flex items-center gap-2 min-w-0">
            <i
              v-if="nodeHasError"
              class="icon-[lucide--octagon-alert] size-4 shrink-0 text-destructive-background-hover"
            />
            <span
              class="truncate"
              :class="nodeHasError ? 'text-destructive-background-hover' : ''"
            >
              <slot name="label">
                {{ displayLabel }}
              </slot>
            </span>
            <span
              v-if="parentGroup"
              class="text-xs text-muted-foreground truncate flex-1 text-right min-w-11"
              :title="parentGroup.title"
            >
              {{ parentGroup.title }}
            </span>
          </span>
          <Button
            v-if="nodeHasError"
            variant="secondary"
            size="sm"
            class="shrink-0 rounded-lg text-sm"
            @click.stop="navigateToErrorTab"
          >
            {{ t('rightSidePanel.seeError') }}
          </Button>
          <Button
            v-if="canShowLocateButton"
            variant="textonly"
            size="icon-sm"
            class="subbutton shrink-0 mr-3 size-8 cursor-pointer text-muted-foreground hover:text-base-foreground"
            :title="t('rightSidePanel.locateNode')"
            :aria-label="t('rightSidePanel.locateNode')"
            @click.stop="handleLocateNode"
          >
            <i class="icon-[lucide--locate] size-4" />
          </Button>
        </div>
      </template>

      <template #empty><slot name="empty" /></template>

      <div
        ref="widgetsContainer"
        class="space-y-2 rounded-lg px-4 pt-1 relative"
      >
        <TransitionGroup name="list-scale">
          <WidgetItem
            v-for="{ widget, node } in widgets"
            :key="`${node.id}-${widget.name}-${widget.type}`"
            :widget="widget"
            :node="node"
            :is-draggable="isDraggable"
            :hidden-favorite-indicator="hiddenFavoriteIndicator"
            :show-node-name="showNodeName"
            :parents="parents"
            :is-shown-on-parents="isWidgetShownOnParents(node, widget)"
            @update:widget-value="handleWidgetValueUpdate(widget, $event)"
          />
        </TransitionGroup>
      </div>
    </PropertiesAccordionItem>
  </div>
</template>

<script setup lang="ts">
import { useMounted, watchDebounced } from '@vueuse/core'
import {
  computed,
  inject,
  onBeforeUnmount,
  provide,
  ref,
  shallowRef,
  watchEffect
} from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { resolvePromotedWidgetSource } from '@/core/graph/subgraph/resolvePromotedWidgetSource'
import type { LGraphGroup, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { SubgraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { DraggableList } from '@/scripts/ui/draggableList'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { cn } from '@comfyorg/tailwind-utils'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { getExecutionIdByNode } from '@/utils/graphTraversalUtil'
import { getWidgetDefaultValue } from '@/utils/widgetUtil'
import type { WidgetValue } from '@/utils/widgetUtil'

import PropertiesAccordionItem from '../layout/PropertiesAccordionItem.vue'
import { HideLayoutFieldKey, WidgetHeightKey } from '@/types/widgetTypes'

import { GetNodeParentGroupKey } from '../shared'
import WidgetItem from './WidgetItem.vue'
import { getStableWidgetRenderKey } from '@/core/graph/subgraph/widgetRenderKey'

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

const emit = defineEmits<{
  reorder: [event: { fromIndex: number; toIndex: number }]
}>()

const widgetsContainer = ref<HTMLElement>()
const rootElement = ref<HTMLElement>()

const widgets = shallowRef(widgetsProp)
watchEffect(() => (widgets.value = widgetsProp))

const draggableList = ref<DraggableList | undefined>()
const isMounted = useMounted()

function setDraggableState() {
  draggableList.value?.dispose()
  draggableList.value = undefined

  if (!isMounted.value || !isDraggable || collapse.value) return
  const container = widgetsContainer.value
  if (!container?.children?.length) return

  const list = new DraggableList(container, '.draggable-item')

  list.applyNewItemsOrder = function () {
    const reorderedItems: HTMLElement[] = []

    let oldPosition = -1
    this.getAllItems().forEach((item, index) => {
      if (item === this.draggableItem) {
        oldPosition = index
        return
      }
      if (!this.isItemToggled(item)) {
        reorderedItems[index] = item
        return
      }
      const newIndex = this.isItemAbove(item) ? index + 1 : index - 1
      reorderedItems[newIndex] = item
    })

    if (oldPosition === -1) {
      console.error('[SectionWidgets] draggableItem not found in items')
      return
    }

    for (let index = 0; index < this.getAllItems().length; index++) {
      if (typeof reorderedItems[index] === 'undefined') {
        reorderedItems[index] = this.draggableItem as HTMLElement
      }
    }

    const newPosition = reorderedItems.indexOf(
      this.draggableItem as HTMLElement
    )

    emit('reorder', { fromIndex: oldPosition, toIndex: newPosition })
  }

  draggableList.value = list
}

watchDebounced(
  [widgets, () => isDraggable, collapse],
  () => setDraggableState(),
  { debounce: 100, immediate: true }
)
onBeforeUnmount(() => draggableList.value?.dispose())

provide(HideLayoutFieldKey, true)
provide(WidgetHeightKey, 'h-7')

const canvasStore = useCanvasStore()
const executionErrorStore = useExecutionErrorStore()
const rightSidePanelStore = useRightSidePanelStore()
const nodeDefStore = useNodeDefStore()
const { t } = useI18n()

const getNodeParentGroup = inject(GetNodeParentGroupKey, null)

function isWidgetShownOnParents(widget: IBaseWidget): boolean {
  const id = widget.widgetId
  if (!id) return false
  return parents.some((parent) =>
    parent.inputs.some((input) => input.widgetId === id)
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

const hasDirectError = computed(() => {
  if (!targetNode.value) return false
  return executionErrorStore.activeGraphErrorNodeIds.has(
    String(targetNode.value.id)
  )
})

const hasContainerInternalError = computed(() => {
  if (!targetNode.value) return false
  if (!(targetNode.value instanceof SubgraphNode)) return false

  return executionErrorStore.isContainerWithInternalError(targetNode.value)
})

const nodeHasError = computed(() => {
  if (!targetNode.value) return false
  if (canvasStore.selectedItems.length === 1) return false
  return hasDirectError.value || hasContainerInternalError.value
})

const showSeeError = computed(
  () =>
    nodeHasError.value &&
    useSettingStore().get('Comfy.RightSidePanel.ShowErrorsTab')
)

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

function navigateToErrorTab() {
  if (!targetNode.value) return
  if (!useSettingStore().get('Comfy.RightSidePanel.ShowErrorsTab')) return
  rightSidePanelStore.focusedErrorNodeId = String(targetNode.value.id)
  rightSidePanelStore.openPanel('errors')
}

function clearWidgetErrors(
  widgetNode: LGraphNode,
  widget: IBaseWidget,
  value: WidgetValue
) {
  const rootGraph = widgetNode.graph?.rootGraph
  if (!rootGraph) return

  const executionId = getExecutionIdByNode(rootGraph, widgetNode)
  if (!executionId) return

  const options = { min: widget.options?.min, max: widget.options?.max }
  const source = resolvePromotedWidgetSource(rootGraph, widgetNode, widget)
  if (source?.sourceExecutionId) {
    executionErrorStore.clearWidgetRelatedErrors(
      source.sourceExecutionId,
      source.sourceWidgetName,
      source.sourceWidgetName,
      value,
      {
        min: source.sourceWidget.options?.min,
        max: source.sourceWidget.options?.max
      }
    )
  }

  executionErrorStore.clearWidgetRelatedErrors(
    executionId,
    widget.name,
    widget.name,
    value,
    options
  )
}

function setWidgetValue(
  widgetNode: LGraphNode,
  widget: IBaseWidget,
  value: WidgetValue
) {
  // Store-backed widgets (interior node widgets and promoted subgraph inputs)
  // are addressed by widgetId; writing there keeps the displayed value in sync.
  if (widget.widgetId) useWidgetValueStore().setValue(widget.widgetId, value)
  widget.value = value
  widget.callback?.(value)
  clearWidgetErrors(widgetNode, widget, value)
  canvasStore.canvas?.setDirty(true, true)
}

function handleResetAllWidgets() {
  for (const { widget, node: widgetNode } of widgetsProp) {
    const spec = nodeDefStore.getInputSpecForWidget(widgetNode, widget.name)
    const defaultValue = getWidgetDefaultValue(spec)
    if (defaultValue !== undefined) {
      setWidgetValue(widgetNode, widget, defaultValue)
    }
  }
}

function handleWidgetValueUpdate(
  widgetNode: LGraphNode,
  widget: IBaseWidget,
  newValue: WidgetValue
) {
  if (newValue === undefined) return
  setWidgetValue(widgetNode, widget, newValue)
}

function handleWidgetReset(
  widgetNode: LGraphNode,
  widget: IBaseWidget,
  newValue: WidgetValue
) {
  setWidgetValue(widgetNode, widget, newValue)
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
      :size="showSeeError ? 'lg' : 'default'"
    >
      <template #label>
        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span class="flex min-w-0 flex-1 items-center gap-2">
            <i
              v-if="nodeHasError"
              class="icon-[lucide--octagon-alert] size-4 shrink-0 text-destructive-background-hover"
            />
            <span
              :class="
                cn(
                  'truncate',
                  nodeHasError && 'text-destructive-background-hover'
                )
              "
            >
              <slot name="label">
                {{ displayLabel }}
              </slot>
            </span>
            <span
              v-if="parentGroup"
              class="min-w-11 flex-1 truncate text-right text-xs text-muted-foreground"
              :title="parentGroup.title"
            >
              {{ parentGroup.title }}
            </span>
          </span>
          <Button
            v-if="showSeeError"
            variant="secondary"
            size="sm"
            class="h-8 shrink-0 rounded-lg text-sm"
            @click.stop="navigateToErrorTab"
          >
            {{ t('rightSidePanel.seeError') }}
          </Button>
          <Button
            v-if="!isEmpty"
            variant="muted-textonly"
            size="icon-sm"
            class="subbutton size-8 shrink-0 hover:text-base-foreground"
            :title="t('rightSidePanel.resetAllParameters')"
            :aria-label="t('rightSidePanel.resetAllParameters')"
            @click.stop="handleResetAllWidgets"
          >
            <i class="icon-[lucide--rotate-ccw] size-4" />
          </Button>
          <Button
            v-if="canShowLocateButton"
            variant="muted-textonly"
            size="icon-sm"
            class="subbutton mr-3 size-8 shrink-0 hover:text-base-foreground"
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
        class="relative space-y-2 rounded-lg px-4 pt-1"
      >
        <TransitionGroup name="list-scale">
          <WidgetItem
            v-for="{ widget, node } in widgets"
            :key="getStableWidgetRenderKey(widget)"
            :widget="widget"
            :node="node"
            :is-draggable="isDraggable"
            :hidden-favorite-indicator="hiddenFavoriteIndicator"
            :show-node-name="showNodeName"
            :parents="parents"
            :is-shown-on-parents="isWidgetShownOnParents(widget)"
            @update:widget-value="handleWidgetValueUpdate(node, widget, $event)"
            @reset-to-default="handleWidgetReset(node, widget, $event)"
          />
        </TransitionGroup>
      </div>
    </PropertiesAccordionItem>
  </div>
</template>

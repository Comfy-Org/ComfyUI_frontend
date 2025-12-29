<script setup lang="ts">
import {
  computed,
  provide,
  ref,
  shallowRef,
  triggerRef,
  watchEffect
} from 'vue'
import { useI18n } from 'vue-i18n'

import MoreButton from '@/components/button/MoreButton.vue'
import Button from '@/components/ui/button/Button.vue'
import { demoteWidget } from '@/core/graph/subgraph/proxyWidgetUtils'
import type { LGraphNode, NodeId } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import WidgetLegacy from '@/renderer/extensions/vueNodes/widgets/components/WidgetLegacy.vue'
import {
  getComponent,
  shouldExpand
} from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import { useDialogService } from '@/services/dialogService'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { useFavoritedWidgetsStore } from '@/stores/workspace/favoritedWidgetsStore'
import { cn } from '@/utils/tailwindUtil'

import PropertiesAccordionItem from '../layout/PropertiesAccordionItem.vue'

const {
  label,
  widgets: widgetsProp,
  showLocateButton = false,
  isDraggable = false,
  hiddenFavoriteIndicator = false
} = defineProps<{
  label?: string
  widgets: { widget: IBaseWidget; node: LGraphNode }[]
  showLocateButton?: boolean
  isDraggable?: boolean
  hiddenFavoriteIndicator?: boolean
}>()

const widgetsContainer = ref<HTMLElement>()

const widgets = shallowRef(widgetsProp)
watchEffect(() => (widgets.value = widgetsProp))

provide('hideLayoutField', true)

const canvasStore = useCanvasStore()
const favoritedWidgetsStore = useFavoritedWidgetsStore()
const subgraphNavigationStore = useSubgraphNavigationStore()
const dialogService = useDialogService()
const { t } = useI18n()

function getWidgetComponent(widget: IBaseWidget) {
  const component = getComponent(widget.type, widget.name)
  return component || WidgetLegacy
}

function onWidgetValueChange(
  widget: IBaseWidget,
  value: string | number | boolean | object
) {
  widget.value = value
  widget.callback?.(value)
  canvasStore.canvas?.setDirty(true, true)
}

const isInSubgraph = computed(() => {
  return subgraphNavigationStore.navigationStack.length > 0
})

function getParentNodes(): SubgraphNode[] {
  const { navigationStack } = subgraphNavigationStore
  const subgraph = navigationStack.at(-1)
  if (!subgraph) return []

  const parentGraph = navigationStack.at(-2) ?? subgraph.rootGraph
  return parentGraph.nodes.filter(
    (node): node is SubgraphNode =>
      node.type === subgraph.id && node.isSubgraphNode()
  )
}

const isEmpty = computed(() => widgets.value.length === 0)

const displayLabel = computed(
  () =>
    label ??
    (isEmpty.value
      ? t('rightSidePanel.inputsNone')
      : t('rightSidePanel.inputs'))
)

const targetNode = computed<LGraphNode | null>(() => {
  if (!showLocateButton || isEmpty.value) return null

  const firstNodeId = widgets.value[0]?.node.id
  const allSameNode = widgets.value.every(({ node }) => node.id === firstNodeId)

  return allSameNode ? widgets.value[0].node : null
})

const canShowLocateButton = computed(
  () => showLocateButton && targetNode.value !== null
)

function handleToggleFavorite(nodeId: NodeId, widgetName: string) {
  favoritedWidgetsStore.toggleFavorite(nodeId, widgetName)
}

function handleLocateNode() {
  if (!targetNode.value || !canvasStore.canvas) return

  const graphNode = canvasStore.canvas.graph?.getNodeById(targetNode.value.id)
  if (graphNode) {
    canvasStore.canvas.animateToBounds(graphNode.boundingRect)
  }
}

async function handleRenameWidget(node: LGraphNode, widget: IBaseWidget) {
  const newLabel = await dialogService.prompt({
    title: t('g.rename'),
    message: t('g.enterNewName') + ':',
    defaultValue: widget.label,
    placeholder: widget.name
  })

  if (newLabel === null) return

  const input = node.inputs?.find((inp) => inp.widget?.name === widget.name)

  widget.label = newLabel || undefined
  if (input) {
    input.label = newLabel || undefined
  }

  canvasStore.canvas?.setDirty(true)
  triggerRef(widgets)
}

function handleHideInput(node: LGraphNode, widget: IBaseWidget) {
  const parents = getParentNodes()
  if (!parents.length) return

  demoteWidget(node, widget, parents)
  canvasStore.canvas?.setDirty(true, true)
}

defineExpose({
  widgetsContainer
})
</script>

<template>
  <PropertiesAccordionItem :is-empty>
    <template #label>
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <span class="truncate flex-1">
          <slot name="label">
            {{ displayLabel }}
          </slot>
        </span>
        <Button
          v-if="canShowLocateButton"
          variant="textonly"
          size="icon-sm"
          class="shrink-0 mr-3"
          :title="t('rightSidePanel.locateNode')"
          @click.stop="handleLocateNode"
        >
          <i class="icon-[lucide--locate] size-4 text-muted-foreground" />
        </Button>
      </div>
    </template>

    <div
      v-if="!isEmpty"
      ref="widgetsContainer"
      class="space-y-2 rounded-lg px-4 pt-1"
    >
      <div
        v-for="({ widget, node }, index) in widgets"
        :key="`widget-${index}-${widget.name}`"
        :class="
          cn(
            'widget-item col-span-full grid grid-cols-subgrid rounded-lg group',
            isDraggable &&
              'draggable-item drag-handle cursor-grab bg-interface-panel-surface [&.is-draggable]:cursor-grabbing outline-interface-panel-surface [&.is-draggable]:outline-4 [&.is-draggable]:outline-offset-0'
          )
        "
      >
        <!-- widget header -->
        <div
          :class="
            cn(
              'min-h-8 flex items-center justify-between gap-1 mb-1.5',
              isDraggable && 'pointer-events-none'
            )
          "
        >
          <p
            v-if="widget.name"
            :class="
              cn(
                'text-sm leading-8 p-0 m-0 line-clamp-1',
                isDraggable && 'pointer-events-none'
              )
            "
          >
            {{ widget.label || widget.name }}
          </p>
          <div class="flex items-center gap-1 shrink-0 pointer-events-auto">
            <MoreButton is-vertical>
              <template #default="{ close }">
                <button
                  class="border-none bg-transparent flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-interface-menu-item-background-hover"
                  @click="
                    () => {
                      handleRenameWidget(node, widget)
                      close()
                    }
                  "
                >
                  <i class="icon-[lucide--edit] size-4" />
                  <span>{{ t('g.rename') }}</span>
                </button>

                <button
                  v-if="isInSubgraph"
                  class="border-none bg-transparent flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-interface-menu-item-background-hover"
                  @click="
                    () => {
                      handleHideInput(node, widget)
                      close()
                    }
                  "
                >
                  <i class="icon-[lucide--eye-off] size-4" />
                  <span>{{ t('rightSidePanel.hideInput') }}</span>
                </button>

                <button
                  class="border-none bg-transparent flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-interface-menu-item-background-hover"
                  @click="
                    () => {
                      handleToggleFavorite(node.id, widget.name)
                      close()
                    }
                  "
                >
                  <i
                    :class="
                      cn(
                        'size-4',
                        favoritedWidgetsStore.isFavorited(node.id, widget.name)
                          ? 'icon-[lucide--star]'
                          : 'icon-[lucide--star]'
                      )
                    "
                  />
                  <span>{{
                    favoritedWidgetsStore.isFavorited(node.id, widget.name)
                      ? t('rightSidePanel.removeFavorite')
                      : t('rightSidePanel.addFavorite')
                  }}</span>
                </button>
              </template>
            </MoreButton>
          </div>
        </div>
        <!-- favorite indicator -->
        <div
          v-if="
            !hiddenFavoriteIndicator &&
            favoritedWidgetsStore.isFavorited(node.id, widget.name)
          "
          class="relative z-2 pointer-events-none"
        >
          <i
            class="absolute -right-1 -top-1 pi pi-star-fill text-xs text-muted-foreground pointer-events-none"
          />
        </div>
        <!-- widget content -->
        <component
          :is="getWidgetComponent(widget)"
          :widget="widget"
          :model-value="widget.value"
          :node-id="String(node.id)"
          :node-type="node.type"
          :class="cn('col-span-1', shouldExpand(widget.type) && 'min-h-36')"
          @update:model-value="
            (value: string | number | boolean | object) =>
              onWidgetValueChange(widget, value)
          "
        />
        <!-- Drag handle -->
        <div
          v-if="isDraggable"
          class="pointer-events-none mt-1.5 mx-auto max-w-40 w-1/2 h-1 rounded-lg bg-transparent group-hover:bg-interface-stroke group-[.is-draggable]:bg-component-node-widget-background-highlighted transition-colors duration-150"
        />
      </div>
    </div>
  </PropertiesAccordionItem>
</template>

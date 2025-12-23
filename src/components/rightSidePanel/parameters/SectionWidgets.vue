<script setup lang="ts">
import { computed, provide } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { LGraphNode, NodeId } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import WidgetLegacy from '@/renderer/extensions/vueNodes/widgets/components/WidgetLegacy.vue'
import {
  getComponent,
  shouldExpand
} from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import { useFavoritedWidgetsStore } from '@/stores/workspace/favoritedWidgetsStore'
import { cn } from '@/utils/tailwindUtil'

import PropertiesAccordionItem from '../layout/PropertiesAccordionItem.vue'

const {
  label,
  widgets,
  showLocateButton = false
} = defineProps<{
  label?: string
  widgets: { widget: IBaseWidget; node: LGraphNode }[]
  showLocateButton?: boolean
}>()

provide('hideLayoutField', true)

const canvasStore = useCanvasStore()
const favoritedWidgetsStore = useFavoritedWidgetsStore()
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

const isEmpty = computed(() => widgets.length === 0)

const displayLabel = computed(
  () =>
    label ??
    (isEmpty.value
      ? t('rightSidePanel.inputsNone')
      : t('rightSidePanel.inputs'))
)

const targetNode = computed<LGraphNode | null>(() => {
  if (!showLocateButton || isEmpty.value) return null

  const firstNodeId = widgets[0]?.node.id
  const allSameNode = widgets.every(({ node }) => node.id === firstNodeId)

  return allSameNode ? widgets[0].node : null
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

    <div v-if="!isEmpty" class="space-y-4 rounded-lg bg-interface-surface px-4">
      <div
        v-for="({ widget, node }, index) in widgets"
        :key="`widget-${index}-${widget.name}`"
        class="widget-item gap-1.5 col-span-full grid grid-cols-subgrid"
      >
        <div class="min-h-8 flex items-center justify-between gap-1">
          <p v-if="widget.name" class="text-sm leading-8 p-0 m-0 line-clamp-1">
            {{ widget.label || widget.name }}
          </p>
          <Button
            variant="textonly"
            size="icon-sm"
            class="shrink-0"
            :title="
              favoritedWidgetsStore.isFavorited(node.id, widget.name)
                ? t('rightSidePanel.removeFavorite')
                : t('rightSidePanel.addFavorite')
            "
            @click="handleToggleFavorite(node.id, widget.name)"
          >
            <i
              :class="
                cn(
                  'size-4',
                  favoritedWidgetsStore.isFavorited(node.id, widget.name)
                    ? 'icon-[lucide--star] text-yellow-500'
                    : 'icon-[lucide--star] text-muted-foreground'
                )
              "
            />
          </Button>
        </div>
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
      </div>
    </div>
  </PropertiesAccordionItem>
</template>

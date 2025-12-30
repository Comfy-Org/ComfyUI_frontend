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

import Button from '@/components/ui/button/Button.vue'
import type { LGraphNode, SubgraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

import PropertiesAccordionItem from '../layout/PropertiesAccordionItem.vue'
import WidgetItem from './WidgetItem.vue'

const {
  label,
  widgets: widgetsProp,
  showLocateButton = false,
  isDraggable = false,
  hiddenFavoriteIndicator = false,
  showNodeName = false,
  defaultCollapse = false,
  parents = [],
  isShownOnParents = false
} = defineProps<{
  label?: string
  parents?: SubgraphNode[]
  widgets: { widget: IBaseWidget; node: LGraphNode }[]
  showLocateButton?: boolean
  isDraggable?: boolean
  hiddenFavoriteIndicator?: boolean
  showNodeName?: boolean
  defaultCollapse?: boolean
  isShownOnParents?: boolean
}>()

const collapse = defineModel<boolean>('collapse')

const widgetsContainer = ref<HTMLElement>()

const widgets = shallowRef(widgetsProp)
watchEffect(() => (widgets.value = widgetsProp))

provide('hideLayoutField', true)

const canvasStore = useCanvasStore()
const { t } = useI18n()

function onWidgetValueChange(
  widget: IBaseWidget,
  value: string | number | boolean | object
) {
  widget.value = value
  widget.callback?.(value)
  canvasStore.canvas?.setDirty(true, true)
}

function onWidgetUpdate() {
  triggerRef(widgets)
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

function handleLocateNode() {
  if (!targetNode.value || !canvasStore.canvas) return

  const graphNode = canvasStore.canvas.graph?.getNodeById(targetNode.value.id)
  if (graphNode) {
    canvasStore.canvas.animateToBounds(graphNode.boundingRect)
  }
}

defineExpose({
  widgetsContainer
})
</script>

<template>
  <PropertiesAccordionItem
    v-model:collapse="collapse"
    :is-empty
    :default-collapse="defaultCollapse"
  >
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
      <WidgetItem
        v-for="({ widget, node }, index) in widgets"
        :key="`widget-${index}-${widget.name}`"
        :widget="widget"
        :node="node"
        :is-draggable="isDraggable"
        :hidden-favorite-indicator="hiddenFavoriteIndicator"
        :show-node-name="showNodeName"
        :parents="parents"
        :is-shown-on-parents="isShownOnParents"
        @value-change="onWidgetValueChange"
        @widget-update="onWidgetUpdate"
      />
    </div>
  </PropertiesAccordionItem>
</template>

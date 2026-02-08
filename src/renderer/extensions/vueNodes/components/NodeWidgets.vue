<template>
  <div v-if="renderError" class="node-error p-2 text-sm text-red-500">
    {{ st('nodeErrors.widgets', 'Node Widgets Error') }}
  </div>
  <div
    v-else
    :class="
      cn(
        'lg-node-widgets grid grid-cols-[min-content_minmax(80px,max-content)_minmax(125px,auto)] gap-y-1 pr-3',
        shouldHandleNodePointerEvents
          ? 'pointer-events-auto'
          : 'pointer-events-none'
      )
    "
    :style="{
      'grid-template-rows': gridTemplateRows,
      flex: gridTemplateRows.includes('auto') ? 1 : undefined
    }"
    @pointerdown.capture="handleBringToFront"
    @pointerdown="handleWidgetPointerEvent"
    @pointermove="handleWidgetPointerEvent"
    @pointerup="handleWidgetPointerEvent"
  >
    <template
      v-for="(widget, index) in processedWidgets"
      :key="`widget-${index}-${widget.name}`"
    >
      <div
        v-if="
          !widget.simplified.hidden &&
          (!widget.simplified.advanced || showAdvanced)
        "
        class="lg-node-widget group col-span-full grid grid-cols-subgrid items-stretch"
        :data-widget-name="widget.name"
      >
        <!-- Widget Input Slot Dot -->
        <div
          :class="
            cn(
              'z-10 w-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100 flex items-stretch',
              widget.slotMetadata?.linked && 'opacity-100'
            )
          "
        >
          <InputSlot
            v-if="widget.slotMetadata"
            :slot-data="{
              name: widget.name,
              type: widget.type,
              boundingRect: [0, 0, 0, 0]
            }"
            :node-id="nodeData?.id != null ? String(nodeData.id) : ''"
            :index="widget.slotMetadata.index"
            :socketless="widget.simplified.spec?.socketless"
            dot-only
          />
        </div>
        <!-- Widget Component -->
        <component
          :is="widget.vueComponent"
          v-model="widget.value"
          v-tooltip.left="widget.tooltipConfig"
          :widget="widget.simplified"
          :node-id="nodeData?.id != null ? String(nodeData.id) : ''"
          :node-type="nodeType"
          class="col-span-2"
          @update:model-value="widget.updateHandler"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { TooltipOptions } from 'primevue'
import { computed, onErrorCaptured, ref, toValue } from 'vue'
import type { Component } from 'vue'

import type {
  VueNodeData,
  WidgetSlotMetadata
} from '@/composables/graph/useGraphNodeManager'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { st } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { useNodeTooltips } from '@/renderer/extensions/vueNodes/composables/useNodeTooltips'
import { useNodeZIndex } from '@/renderer/extensions/vueNodes/composables/useNodeZIndex'
import WidgetDOM from '@/renderer/extensions/vueNodes/widgets/components/WidgetDOM.vue'
// Import widget components directly
import WidgetLegacy from '@/renderer/extensions/vueNodes/widgets/components/WidgetLegacy.vue'
import {
  getComponent,
  shouldExpand,
  shouldRenderAsVue
} from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import { useAdvancedWidgetOverridesStore } from '@/stores/workspace/advancedWidgetOverridesStore'
import type { SimplifiedWidget, WidgetValue } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'

import InputSlot from './InputSlot.vue'

interface NodeWidgetsProps {
  nodeData?: VueNodeData
  node?: LGraphNode | null
}

const { nodeData, node: lgraphNode = null } = defineProps<NodeWidgetsProps>()

const { shouldHandleNodePointerEvents, forwardEventToCanvas } =
  useCanvasInteractions()
const { bringNodeToFront } = useNodeZIndex()

const advancedOverridesStore = useAdvancedWidgetOverridesStore()

function handleWidgetPointerEvent(event: PointerEvent) {
  if (shouldHandleNodePointerEvents.value) return
  event.stopPropagation()
  forwardEventToCanvas(event)
}

function handleBringToFront() {
  if (nodeData?.id != null) {
    bringNodeToFront(String(nodeData.id))
  }
}

// Error boundary implementation
const renderError = ref<string | null>(null)

const { toastErrorHandler } = useErrorHandling()

onErrorCaptured((error) => {
  renderError.value = error.message
  toastErrorHandler(error)
  return false
})

const nodeType = computed(() => nodeData?.type || '')
const settingStore = useSettingStore()
const alwaysShowAdvancedWidgets = computed(() =>
  settingStore.get('Comfy.Node.AlwaysShowAdvancedWidgets')
)
const showAdvanced = computed(
  () => nodeData?.showAdvanced || alwaysShowAdvancedWidgets.value
)
const { getWidgetTooltip, createTooltipConfig } = useNodeTooltips(
  nodeType.value
)

interface ProcessedWidget {
  name: string
  type: string
  vueComponent: Component
  simplified: SimplifiedWidget
  value: WidgetValue
  updateHandler: (value: WidgetValue) => void
  tooltipConfig: TooltipOptions
  slotMetadata?: WidgetSlotMetadata
}

/**
 * Preprocess Vue widgets for rendering and value updates.
 *
 * Widgets with linked input slots are forced disabled to avoid conflicting
 * input sources (linked slot vs. local widget value).
 */
const processedWidgets = computed((): ProcessedWidget[] => {
  if (!nodeData?.widgets) return []

  const { widgets } = nodeData
  const result: ProcessedWidget[] = []

  for (const widget of widgets) {
    if (!shouldRenderAsVue(widget)) continue

    const vueComponent =
      getComponent(widget.type) ||
      (widget.isDOMWidget ? WidgetDOM : WidgetLegacy)

    const { slotMetadata, options } = widget

    const widgetOptions = slotMetadata?.linked
      ? { ...options, disabled: true }
      : options

    const resolvedAdvanced = lgraphNode
      ? advancedOverridesStore.getAdvancedState(lgraphNode, widget)
      : !!widget.options?.advanced

    const simplified: SimplifiedWidget = {
      name: widget.name,
      type: widget.type,
      value: widget.value,
      borderStyle: widget.borderStyle,
      callback: widget.callback,
      controlWidget: widget.controlWidget,
      label: widget.label,
      nodeType: widget.nodeType,
      options: widgetOptions,
      spec: widget.spec,
      advanced: resolvedAdvanced,
      hidden: widget.options?.hidden
    }

    function updateHandler(value: WidgetValue) {
      widget.value = value
      widget.callback?.(value)
    }

    const tooltipText = getWidgetTooltip(widget)
    const tooltipConfig = createTooltipConfig(tooltipText)

    result.push({
      name: widget.name,
      type: widget.type,
      vueComponent,
      simplified,
      value: widget.value,
      updateHandler,
      tooltipConfig,
      slotMetadata
    })
  }

  if (nodeData?.showAdvanced && !alwaysShowAdvancedWidgets.value) {
    const normal = result.filter((w) => !w.simplified.advanced)
    const advanced = result.filter((w) => w.simplified.advanced)
    return [...normal, ...advanced]
  }

  return result
})

/**
 * Grid rows must follow the original `nodeData.widgets` order; the rendered list
 * may reorder widgets (e.g. grouping advanced widgets at the end).
 */
const gridTemplateRows = computed((): string => {
  if (!nodeData?.widgets) return ''
  const processedNames = new Set(toValue(processedWidgets).map((w) => w.name))
  return nodeData.widgets
    .filter((w) => {
      if (!processedNames.has(w.name)) return false
      if (w.options?.hidden) return false

      const resolved = lgraphNode
        ? advancedOverridesStore.getAdvancedState(lgraphNode, w)
        : !!w.options?.advanced

      return !resolved || showAdvanced.value
    })
    .map((w) =>
      shouldExpand(w.type) || w.hasLayoutSize ? 'auto' : 'min-content'
    )
    .join(' ')
})
</script>

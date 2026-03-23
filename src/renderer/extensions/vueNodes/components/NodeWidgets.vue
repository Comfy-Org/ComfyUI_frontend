<template>
  <div v-if="renderError" class="node-error p-2 text-sm text-red-500">
    {{ st('nodeErrors.widgets', 'Node Widgets Error') }}
  </div>
  <div
    v-else
    :class="
      cn(
        'lg-node-widgets grid grid-cols-[min-content_minmax(80px,min-content)_minmax(125px,1fr)] gap-y-1 pr-3',
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
    <template v-for="widget in processedWidgets" :key="widget.renderKey">
      <div
        v-if="!widget.hidden && (!widget.advanced || showAdvanced)"
        class="lg-node-widget group col-span-full grid grid-cols-subgrid items-stretch"
      >
        <!-- Widget Input Slot Dot -->
        <div
          :class="
            cn(
              'z-10 flex w-3 items-stretch opacity-0 transition-opacity duration-150 group-hover:opacity-100',
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
            :has-error="widget.hasError"
            :index="widget.slotMetadata.index"
            :socketless="widget.simplified.spec?.socketless"
            dot-only
          />
        </div>
        <!-- Widget Component -->
        <AppInput
          :id="widget.id"
          :name="widget.name"
          :enable="canSelectInputs && !widget.simplified.options?.disabled"
        >
          <component
            :is="widget.vueComponent"
            v-model="widget.value"
            v-tooltip.left="widget.tooltipConfig"
            :widget="widget.simplified"
            :node-id="nodeData?.id != null ? String(nodeData.id) : ''"
            :node-type="nodeType"
            :class="
              cn(
                'col-span-2',
                widget.hasError && 'font-bold text-node-stroke-error'
              )
            "
            @update:model-value="widget.updateHandler"
            @contextmenu="widget.handleContextMenu"
          />
        </AppInput>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { TooltipOptions } from 'primevue'
import { computed, onErrorCaptured, ref, toValue } from 'vue'
import type { Component } from 'vue'

import type {
  SafeWidgetData,
  VueNodeData,
  WidgetSlotMetadata
} from '@/composables/graph/useGraphNodeManager'
import { useAppMode } from '@/composables/useAppMode'
import { showNodeOptions } from '@/composables/graph/useMoreOptionsMenu'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { st } from '@/i18n'
import type { IWidgetOptions } from '@/lib/litegraph/src/types/widgets'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import AppInput from '@/renderer/extensions/linearMode/AppInput.vue'
import { useNodeTooltips } from '@/renderer/extensions/vueNodes/composables/useNodeTooltips'
import { useNodeEventHandlers } from '@/renderer/extensions/vueNodes/composables/useNodeEventHandlers'
import { useNodeZIndex } from '@/renderer/extensions/vueNodes/composables/useNodeZIndex'
import WidgetDOM from '@/renderer/extensions/vueNodes/widgets/components/WidgetDOM.vue'
// Import widget components directly
import WidgetLegacy from '@/renderer/extensions/vueNodes/widgets/components/WidgetLegacy.vue'
import {
  getComponent,
  shouldExpand,
  shouldRenderAsVue
} from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import { nodeTypeValidForApp } from '@/stores/appModeStore'
import type { WidgetState } from '@/stores/widgetValueStore'
import {
  stripGraphPrefix,
  useWidgetValueStore
} from '@/stores/widgetValueStore'
import { usePromotionStore } from '@/stores/promotionStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import type { SimplifiedWidget, WidgetValue } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'

import InputSlot from './InputSlot.vue'

interface NodeWidgetsProps {
  nodeData?: VueNodeData
}

const { nodeData } = defineProps<NodeWidgetsProps>()

const { shouldHandleNodePointerEvents, forwardEventToCanvas } =
  useCanvasInteractions()
const { isSelectInputsMode } = useAppMode()
const canvasStore = useCanvasStore()
const { bringNodeToFront } = useNodeZIndex()
const promotionStore = usePromotionStore()
const executionErrorStore = useExecutionErrorStore()

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

const { handleNodeRightClick } = useNodeEventHandlers()

// Error boundary implementation
const renderError = ref<string | null>(null)

const { toastErrorHandler } = useErrorHandling()

onErrorCaptured((error) => {
  renderError.value = error.message
  toastErrorHandler(error)
  return false
})

const canSelectInputs = computed(
  () =>
    isSelectInputsMode.value &&
    nodeData?.mode === LGraphEventMode.ALWAYS &&
    nodeTypeValidForApp(nodeData.type) &&
    !nodeData.hasErrors
)
const nodeType = computed(() => nodeData?.type || '')
const settingStore = useSettingStore()
const showAdvanced = computed(
  () =>
    nodeData?.showAdvanced ||
    settingStore.get('Comfy.Node.AlwaysShowAdvancedWidgets')
)
const { getWidgetTooltip, createTooltipConfig } = useNodeTooltips(
  nodeType.value
)
const widgetValueStore = useWidgetValueStore()

interface ProcessedWidget {
  advanced: boolean
  handleContextMenu: (e: PointerEvent) => void
  hasLayoutSize: boolean
  hasError: boolean
  hidden: boolean
  id: string
  name: string
  renderKey: string
  simplified: SimplifiedWidget
  tooltipConfig: TooltipOptions
  type: string
  updateHandler: (value: WidgetValue) => void
  value: WidgetValue
  vueComponent: Component
  slotMetadata?: WidgetSlotMetadata
}

function hasWidgetError(
  widget: SafeWidgetData,
  nodeErrors: { errors: { extra_info?: { input_name?: string } }[] } | undefined
): boolean {
  const errors = nodeErrors?.errors
  const inputName = widget.slotName ?? widget.name
  return !!errors?.some((e) => e.extra_info?.input_name === inputName)
}

function getWidgetIdentity(
  widget: SafeWidgetData,
  nodeId: string | number | undefined,
  index: number
): {
  dedupeIdentity?: string
  renderKey: string
} {
  const rawWidgetId = widget.storeNodeId ?? widget.nodeId
  const storeWidgetName = widget.storeName ?? widget.name
  const slotNameForIdentity = widget.slotName ?? widget.name
  const stableIdentityRoot = rawWidgetId
    ? `node:${String(stripGraphPrefix(rawWidgetId))}`
    : undefined

  const dedupeIdentity = stableIdentityRoot
    ? `${stableIdentityRoot}:${storeWidgetName}:${slotNameForIdentity}:${widget.type}`
    : undefined
  const renderKey =
    dedupeIdentity ??
    `transient:${String(nodeId ?? '')}:${storeWidgetName}:${slotNameForIdentity}:${widget.type}:${index}`

  return {
    dedupeIdentity,
    renderKey
  }
}

function isWidgetVisible(options: IWidgetOptions): boolean {
  const hidden = options.hidden ?? false
  const advanced = options.advanced ?? false
  return !hidden && (!advanced || showAdvanced.value)
}

const processedWidgets = computed((): ProcessedWidget[] => {
  if (!nodeData?.widgets) return []
  const nodeErrors = executionErrorStore.lastNodeErrors?.[nodeData.id ?? '']
  const graphId = canvasStore.canvas?.graph?.rootGraph.id

  const nodeId = nodeData.id
  const { widgets } = nodeData
  const result: ProcessedWidget[] = []
  const uniqueWidgets: Array<{
    widget: SafeWidgetData
    identity: ReturnType<typeof getWidgetIdentity>
    mergedOptions: IWidgetOptions
    widgetState: WidgetState | undefined
    isVisible: boolean
  }> = []
  const dedupeIndexByIdentity = new Map<string, number>()

  for (const [index, widget] of widgets.entries()) {
    if (!shouldRenderAsVue(widget)) continue

    const identity = getWidgetIdentity(widget, nodeId, index)
    const storeWidgetName = widget.storeName ?? widget.name
    const bareWidgetId = String(
      stripGraphPrefix(widget.storeNodeId ?? widget.nodeId ?? nodeId ?? '')
    )
    const widgetState = graphId
      ? widgetValueStore.getWidget(graphId, bareWidgetId, storeWidgetName)
      : undefined
    const mergedOptions: IWidgetOptions = {
      ...(widget.options ?? {}),
      ...(widgetState?.options ?? {})
    }
    const visible = isWidgetVisible(mergedOptions)
    if (!identity.dedupeIdentity) {
      uniqueWidgets.push({
        widget,
        identity,
        mergedOptions,
        widgetState,
        isVisible: visible
      })
      continue
    }

    const existingIndex = dedupeIndexByIdentity.get(identity.dedupeIdentity)
    if (existingIndex === undefined) {
      dedupeIndexByIdentity.set(identity.dedupeIdentity, uniqueWidgets.length)
      uniqueWidgets.push({
        widget,
        identity,
        mergedOptions,
        widgetState,
        isVisible: visible
      })
      continue
    }

    const existingWidget = uniqueWidgets[existingIndex]
    if (existingWidget && !existingWidget.isVisible && visible) {
      uniqueWidgets[existingIndex] = {
        widget,
        identity,
        mergedOptions,
        widgetState,
        isVisible: true
      }
    }
  }

  for (const {
    widget,
    mergedOptions,
    widgetState,
    identity: { renderKey }
  } of uniqueWidgets) {
    const hostNodeId = String(nodeId ?? '')
    const bareWidgetId = String(
      stripGraphPrefix(widget.storeNodeId ?? widget.nodeId ?? nodeId ?? '')
    )
    const promotionSourceNodeId = widget.storeName
      ? String(bareWidgetId)
      : undefined

    const vueComponent =
      getComponent(widget.type) ||
      (widget.isDOMWidget ? WidgetDOM : WidgetLegacy)

    const { slotMetadata } = widget

    // Get value from store (falls back to undefined if not registered)
    const value = widgetState?.value as WidgetValue

    // Build options from store state, with disabled override for
    // slot-linked widgets or widgets with disabled state (e.g. display-only)
    const isDisabled = slotMetadata?.linked || widgetState?.disabled
    const widgetOptions = isDisabled
      ? { ...mergedOptions, disabled: true }
      : mergedOptions

    const borderStyle =
      graphId &&
      promotionStore.isPromotedByAny(graphId, {
        sourceNodeId: hostNodeId,
        sourceWidgetName: widget.storeName ?? widget.name,
        disambiguatingSourceNodeId: promotionSourceNodeId
      })
        ? 'ring ring-component-node-widget-promoted'
        : mergedOptions.advanced
          ? 'ring ring-component-node-widget-advanced'
          : undefined

    const simplified: SimplifiedWidget = {
      name: widget.name,
      type: widget.type,
      value,
      borderStyle,
      callback: widget.callback,
      controlWidget: widget.controlWidget,
      label: widget.promotedLabel ?? widgetState?.label,
      options: widgetOptions,
      spec: widget.spec
    }

    function updateHandler(newValue: WidgetValue) {
      // Update value in store
      if (widgetState) widgetState.value = newValue
      // Invoke LiteGraph callback wrapper (handles triggerDraw, etc.)
      widget.callback?.(newValue)
    }

    const tooltipText = getWidgetTooltip(widget)
    const tooltipConfig = createTooltipConfig(tooltipText)
    const handleContextMenu = (e: PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      handleNodeRightClick(e, nodeId)
      showNodeOptions(
        e,
        widget.name,
        widget.nodeId !== undefined
          ? String(stripGraphPrefix(widget.nodeId))
          : undefined
      )
    }

    result.push({
      advanced: mergedOptions.advanced ?? false,
      handleContextMenu,
      hasLayoutSize: widget.hasLayoutSize ?? false,
      hasError: hasWidgetError(widget, nodeErrors),
      hidden: mergedOptions.hidden ?? false,
      id: String(bareWidgetId),
      name: widget.name,
      renderKey,
      type: widget.type,
      vueComponent,
      simplified,
      value,
      updateHandler,
      tooltipConfig,
      slotMetadata
    })
  }

  return result
})

const gridTemplateRows = computed((): string => {
  // Use processedWidgets directly since it already has store-based hidden/advanced
  return toValue(processedWidgets)
    .filter((w) => !w.hidden && (!w.advanced || showAdvanced.value))
    .map((w) =>
      shouldExpand(w.type) || w.hasLayoutSize ? 'auto' : 'min-content'
    )
    .join(' ')
})
</script>

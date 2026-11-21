<template>
  <div
    v-show="widgetState.visible"
    ref="widgetElement"
    class="dom-widget size-full"
    :class="cn(widget.type === 'customtext' && 'flex flex-col')"
    :data-widget-id="widget.id"
    :title="tooltip"
    :style="style"
  >
    <component
      :is="widget.component"
      v-if="isComponentWidget(widget)"
      class="size-full"
      :model-value="widget.value"
      :widget="widget"
      :node-id="widget.node.id"
      v-bind="widget.props"
      @update:model-value="emit('update:widgetValue', $event)"
    />
    <TextareaAugmentations
      v-if="widget.type === 'customtext' && isDOMWidget(widget)"
      :element="textareaElement"
      :target="{ nodeType: widget.node.type ?? '', widgetName: widget.name }"
      :value="String(widget.value ?? '')"
      :enabled="
        widgetState.visible && !widgetState.readonly && !widget.computedDisabled
      "
      teleported
    />
  </div>
</template>

<script setup lang="ts">
import { useElementBounding, useEventListener, whenever } from '@vueuse/core'
import type { CSSProperties } from 'vue'
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'
import { useAbsolutePosition } from '@/composables/element/useAbsolutePosition'
import { useDomClipping } from '@/composables/element/useDomClipping'
import { findFirstNode } from '@/lib/litegraph/src/utils/collections'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import TextareaAugmentations from '@/renderer/extensions/textEditor/components/TextareaAugmentations.vue'
import { isComponentWidget, isDOMWidget } from '@/scripts/domWidget'
import type { DomWidgetState } from '@/stores/domWidgetStore'

import { reportDomWidgetMountFailure } from './domWidgetMountReporting'

const { widgetState } = defineProps<{
  widgetState: DomWidgetState
}>()
const widget = widgetState.widget

function textareaElement(): HTMLTextAreaElement | undefined {
  if (!isDOMWidget(widget)) return undefined
  return widget.element instanceof HTMLTextAreaElement
    ? widget.element
    : undefined
}

const emit = defineEmits<{
  'update:widgetValue': [value: string | object]
}>()

const widgetElement = ref<HTMLElement | undefined>()
const { style: positionStyle, updatePosition } = useAbsolutePosition({
  useTransform: true
})
const { style: clippingStyle, updateClipPath } = useDomClipping()

const canvasStore = useCanvasStore()
const settingStore = useSettingStore()
const enableDomClipping = computed(() =>
  settingStore.get('Comfy.DOMClippingEnabled')
)
const style = computed<CSSProperties>(() => {
  const isDisabled = widget.computedDisabled

  return {
    ...positionStyle.value,
    ...(enableDomClipping.value ? clippingStyle.value : {}),
    zIndex: widgetState.zIndex,
    pointerEvents:
      !widgetState.visible || widgetState.readonly || isDisabled
        ? 'none'
        : 'auto',
    opacity: isDisabled ? 0.5 : 1
  }
})

const updateDomClipping = () => {
  const lgCanvas = canvasStore.canvas
  if (!lgCanvas || !widgetElement.value) return

  const selectedNode = findFirstNode(lgCanvas.selectedItems)
  if (!selectedNode) {
    // Clear clipping when no node is selected
    updateClipPath(widgetElement.value, lgCanvas.canvas, false, undefined)
    return
  }

  const isSelected = selectedNode === widgetState.widget.node
  const renderArea = selectedNode?.renderArea
  const offset = lgCanvas.ds.offset
  const scale = lgCanvas.ds.scale
  const selectedAreaConfig = renderArea
    ? {
        x: renderArea[0],
        y: renderArea[1],
        width: renderArea[2],
        height: renderArea[3],
        scale,
        offset: [offset[0], offset[1]] as [number, number]
      }
    : undefined

  updateClipPath(
    widgetElement.value,
    lgCanvas.canvas,
    isSelected,
    selectedAreaConfig
  )
}

/**
 * @note mapping between canvas position and client position depends on the
 * canvas element's position, so we need to watch the canvas element's position
 * and update the position of the widget accordingly.
 */
const { left, top } = useElementBounding(canvasStore.getCanvas().canvas)

watch(
  [
    () => widgetState.pos,
    () => widgetState.size,
    // Visibility transitions (e.g. LOD low_quality flipping) must refresh
    // style: while invisible, DomWidgets.vue does not update widgetState
    // and ds.offset/ds.scale are non-reactive, so updatePosition must be
    // re-run against the current viewport when the widget reappears.
    () => widgetState.visible,
    left,
    top,
    enableDomClipping
  ],
  () => {
    updatePosition(widgetState)
    if (enableDomClipping.value) {
      updateDomClipping()
    }
  },
  { immediate: true }
)

watch(
  () => widgetState.visible,
  (newVisible, oldVisible) => {
    if (!newVisible && oldVisible) {
      widget.options.onHide?.(widget)
    }
  }
)
useEventListener(document, 'mousedown', (event) => {
  if (!isDOMWidget(widget) || !widgetState.visible || !widget.element.blur) {
    return
  }
  if (!widget.element.contains(event.target as HTMLElement)) {
    widget.element.blur()
  }
})

onMounted(() => {
  if (!isDOMWidget(widget)) {
    return
  }
  useEventListener(
    widget.element,
    widget.options.selectOn ?? ['focus', 'click'],
    () => {
      const lgCanvas = canvasStore.canvas
      if (!lgCanvas) return

      const ownerNode = widgetState.widget.node
      lgCanvas.selectNode(ownerNode)
      lgCanvas.bringToFront(ownerNode)
    }
  )
})

const inputSpec = widget.node.constructor.nodeData
const tooltip = inputSpec?.inputs?.[widget.name]?.tooltip

const mountElementIfVisible = () => {
  if (!(widgetState.visible && isDOMWidget(widget) && widgetElement.value)) {
    return
  }
  if (widgetElement.value.contains(widget.element)) {
    return
  }

  try {
    widget.element.classList.add(
      'h-full',
      'w-full',
      ...(widget.type === 'customtext' ? ['min-h-0', 'flex-1'] : [])
    )
    widgetElement.value.appendChild(widget.element)
  } catch (error) {
    reportDomWidgetMountFailure(error, {
      nodeId: widget.node.id,
      nodeType: widget.node.type,
      widgetName: widget.name
    })
  }
}

// Check on mount - but only after next tick to ensure visibility is calculated
onMounted(() => {
  void nextTick(mountElementIfVisible)
})

// And watch for visibility changes
watch(
  () => widgetState.visible,
  () => {
    mountElementIfVisible()
  }
)

whenever(() => !canvasStore.linearMode, mountElementIfVisible)
</script>

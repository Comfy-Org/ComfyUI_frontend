<template>
  <div
    v-show="widgetState.visible"
    ref="widgetElement"
    class="dom-widget"
    :title="tooltip"
    :style="style"
  >
    <component
      :is="widget.component"
      v-if="isComponentWidget(widget)"
      :model-value="widget.value"
      :widget="widget"
      v-bind="widget.props"
      @update:model-value="emit('update:widgetValue', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { useElementBounding, useEventListener } from '@vueuse/core'
import { CSSProperties, computed, nextTick, onMounted, ref, watch } from 'vue'

import { useAbsolutePosition } from '@/composables/element/useAbsolutePosition'
import { useDomClipping } from '@/composables/element/useDomClipping'
import { isComponentWidget, isDOMWidget } from '@/scripts/domWidget'
import { DomWidgetState } from '@/stores/domWidgetStore'
import { useCanvasStore } from '@/stores/graphStore'
import { useSettingStore } from '@/stores/settingStore'

const { widgetState } = defineProps<{
  widgetState: DomWidgetState
}>()
const widget = widgetState.widget

const emit = defineEmits<{
  'update:widgetValue': [value: string | object]
}>()

const widgetElement = ref<HTMLElement | undefined>()

/**
 * @note Do NOT convert style to a computed value, as it will cause lag when
 * updating the style on different animation frames. Vue's computed value is
 * evaluated asynchronously.
 */
const style = ref<CSSProperties>({})
const { style: positionStyle, updatePosition } = useAbsolutePosition({
  useTransform: true
})
const { style: clippingStyle, updateClipPath } = useDomClipping()

const canvasStore = useCanvasStore()
const settingStore = useSettingStore()
const enableDomClipping = computed(() =>
  settingStore.get('Comfy.DOMClippingEnabled')
)

const updateDomClipping = () => {
  const lgCanvas = canvasStore.canvas
  if (!lgCanvas || !widgetElement.value) return

  const selectedNode = Object.values(lgCanvas.selected_nodes ?? {})[0]
  if (!selectedNode) {
    // Clear clipping when no node is selected
    updateClipPath(widgetElement.value, lgCanvas.canvas, false, undefined)
    return
  }

  const isSelected = selectedNode === widget.node
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
  [() => widgetState, left, top],
  ([widgetState, _, __]) => {
    updatePosition(widgetState)
    if (enableDomClipping.value) {
      updateDomClipping()
    }

    style.value = {
      ...positionStyle.value,
      ...(enableDomClipping.value ? clippingStyle.value : {}),
      zIndex: widgetState.zIndex,
      pointerEvents:
        widgetState.readonly || widget.computedDisabled ? 'none' : 'auto',
      opacity: widget.computedDisabled ? 0.5 : 1
    }
  },
  { deep: true }
)

watch(
  () => widgetState.visible,
  (newVisible, oldVisible) => {
    if (!newVisible && oldVisible) {
      widget.options.onHide?.(widget)
    }
  }
)

// Set up event listeners only after the widget is mounted and visible
const setupDOMEventListeners = () => {
  if (!isDOMWidget(widget) || !widgetState.visible) return

  if (widget.element.blur) {
    useEventListener(document, 'mousedown', (event) => {
      if (!widget.element.contains(event.target as HTMLElement)) {
        widget.element.blur()
      }
    })
  }

  for (const evt of widget.options.selectOn ?? ['focus', 'click']) {
    useEventListener(widget.element, evt, () => {
      const lgCanvas = canvasStore.canvas
      lgCanvas?.selectNode(widget.node)
      lgCanvas?.bringToFront(widget.node)
    })
  }
}

// Set up event listeners when widget becomes visible
watch(
  () => widgetState.visible,
  (visible) => {
    if (visible) {
      setupDOMEventListeners()
    }
  },
  { immediate: true }
)

const inputSpec = widget.node.constructor.nodeData
const tooltip = inputSpec?.inputs?.[widget.name]?.tooltip

// Mount DOM element when widget is or becomes visible
const mountElementIfVisible = () => {
  if (widgetState.visible && isDOMWidget(widget) && widgetElement.value) {
    // Only append if not already a child
    if (!widgetElement.value.contains(widget.element)) {
      widgetElement.value.appendChild(widget.element)
    }
  }
}

// Check on mount - but only after next tick to ensure visibility is calculated
onMounted(() => {
  nextTick(() => {
    mountElementIfVisible()
  }).catch((error) => {
    console.error('Error mounting DOM widget element:', error)
  })
})

// And watch for visibility changes
watch(
  () => widgetState.visible,
  () => {
    mountElementIfVisible()
  }
)
</script>

<style scoped>
.dom-widget > * {
  @apply h-full w-full;
}
</style>

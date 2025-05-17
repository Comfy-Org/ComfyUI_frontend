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
import { CSSProperties, computed, onMounted, ref, watch } from 'vue'

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
  if (!selectedNode) return

  const node = widget.node
  const isSelected = selectedNode === node
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

if (isDOMWidget(widget)) {
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

const inputSpec = widget.node.constructor.nodeData
const tooltip = inputSpec?.inputs?.[widget.name]?.tooltip

onMounted(() => {
  if (isDOMWidget(widget) && widgetElement.value) {
    widgetElement.value.appendChild(widget.element)
  }
})
</script>

<style scoped>
.dom-widget > * {
  @apply h-full w-full;
}
</style>

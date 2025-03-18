<template>
  <div
    class="dom-widget"
    :title="tooltip"
    ref="widgetElement"
    :style="style"
    v-show="widgetState.visible"
  >
    <component
      v-if="isComponentWidget(widget)"
      :is="widget.component"
      :modelValue="widget.value"
      @update:modelValue="emit('update:widgetValue', $event)"
      :widget="widget"
    />
  </div>
</template>

<script setup lang="ts">
import type { LGraphNode } from '@comfyorg/litegraph'
import { useEventListener } from '@vueuse/core'
import { CSSProperties, computed, onMounted, ref, watch } from 'vue'

import { useAbsolutePosition } from '@/composables/element/useAbsolutePosition'
import { useDomClipping } from '@/composables/element/useDomClipping'
import {
  type BaseDOMWidget,
  isComponentWidget,
  isDOMWidget
} from '@/scripts/domWidget'
import { DomWidgetState } from '@/stores/domWidgetStore'
import { useCanvasStore } from '@/stores/graphStore'
import { useSettingStore } from '@/stores/settingStore'

const { widget, widgetState } = defineProps<{
  widget: BaseDOMWidget<string | object>
  widgetState: DomWidgetState
}>()

const emit = defineEmits<{
  (e: 'update:widgetValue', value: string | object): void
}>()

const widgetElement = ref<HTMLElement | undefined>()

const { style: positionStyle, updatePositionWithTransform } =
  useAbsolutePosition()
const { style: clippingStyle, updateClipPath } = useDomClipping()
const style = computed<CSSProperties>(() => ({
  ...positionStyle.value,
  ...(enableDomClipping.value ? clippingStyle.value : {}),
  zIndex: widgetState.zIndex,
  pointerEvents: widgetState.readonly ? 'none' : 'auto'
}))

const canvasStore = useCanvasStore()
const settingStore = useSettingStore()
const enableDomClipping = computed(() =>
  settingStore.get('Comfy.DOMClippingEnabled')
)

const updateDomClipping = () => {
  const lgCanvas = canvasStore.canvas
  if (!lgCanvas || !widgetElement.value) return

  const selectedNode = Object.values(
    lgCanvas.selected_nodes ?? {}
  )[0] as LGraphNode
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

watch(
  () => widgetState,
  (newState) => {
    updatePositionWithTransform(newState)
    if (enableDomClipping.value) {
      updateDomClipping()
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

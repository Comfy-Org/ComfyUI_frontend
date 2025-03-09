<template>
  <div
    class="dom-widget"
    ref="widgetElement"
    :style="style"
    v-show="widgetState.visible"
  />
</template>

<script setup lang="ts">
import type { LGraphNode } from '@comfyorg/litegraph'
import { CSSProperties, computed, onMounted, ref, watch } from 'vue'

import { useAbsolutePosition } from '@/composables/element/useAbsolutePosition'
import { useDomClipping } from '@/composables/element/useDomClipping'
import type { DOMWidget } from '@/scripts/domWidget'
import { DomWidgetState } from '@/stores/domWidgetStore'
import { useCanvasStore } from '@/stores/graphStore'
import { useSettingStore } from '@/stores/settingStore'

const { widget, widgetState } = defineProps<{
  widget: DOMWidget<HTMLElement, any>
  widgetState: DomWidgetState
}>()

const widgetElement = ref<HTMLElement>()

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

onMounted(() => {
  widgetElement.value.appendChild(widget.element)
})
</script>

<style scoped>
.dom-widget > * {
  @apply h-full w-full;
}
</style>

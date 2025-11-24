<template>
  <div class="relative">
    <div class="mb-4">
      <Button
        class="text-text-secondary w-full border-0 bg-component-node-widget-background hover:bg-secondary-background-hover"
        :disabled="isCameraOn || readonly"
        @click="handleTurnOnCamera"
      >
        {{ t('g.turnOnCamera', 'Turn on Camera') }}
      </Button>
    </div>
    <LODFallback />
  </div>
</template>

<script setup lang="ts">
import { Button } from 'primevue'
import {
  computed,
  markRaw,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  toRaw
} from 'vue'

import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import LODFallback from '@/renderer/extensions/vueNodes/components/LODFallback.vue'
import { app } from '@/scripts/app'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const props = defineProps<{
  widget: SimplifiedWidget<string | number | undefined>
  readonly?: boolean
  nodeId: string
}>()

const isCameraOn = ref(false)

// Store original widget states for restoration
const originalWidgets = ref<IBaseWidget[]>([])

const litegraphNode = computed(() => {
  if (!props.nodeId || !app.rootGraph) return null
  return app.rootGraph.getNodeById(props.nodeId) as LGraphNode | null
})

function storeOriginalWidgets() {
  const node = litegraphNode.value
  if (!node?.widgets) return

  // Store raw widgets to preserve their state without reactivity
  originalWidgets.value = node.widgets.map((w) => toRaw(w))
}

function hideWidgets() {
  const node = litegraphNode.value
  if (!node?.widgets) return

  // Use toRaw to unwrap reactive proxies, then markRaw to prevent re-wrapping
  const newWidgets = node.widgets.map((widget) => {
    const rawWidget = toRaw(widget)
    const shouldHide = ['height', 'width', 'capture_on_queue'].includes(
      rawWidget.name
    )

    if (shouldHide) {
      // Special handling for capture_on_queue widget
      if (rawWidget.name === 'capture_on_queue') {
        return markRaw({
          ...rawWidget,
          type: 'selectToggle',
          label: 'Capture Image',
          value: rawWidget.value ?? false,
          options: {
            ...rawWidget.options,
            hidden: true,
            values: [
              { label: 'On Run', value: true },
              { label: 'Manually', value: false }
            ]
          }
        })
      }

      return markRaw({
        ...rawWidget,
        options: {
          ...rawWidget.options,
          hidden: true
        }
      })
    }
    return rawWidget
  })

  node.widgets = newWidgets
}

function restoreWidgets() {
  const node = litegraphNode.value
  if (!node?.widgets || originalWidgets.value.length === 0) return

  // Restore the original widgets (already raw from storage)
  node.widgets = originalWidgets.value.map((w) => toRaw(w))
}

function showWidgets() {
  const node = litegraphNode.value
  if (!node?.widgets) return

  // Use toRaw to unwrap reactive proxies, then markRaw to prevent re-wrapping
  const newWidgets = node.widgets.map((widget) => {
    const rawWidget = toRaw(widget)
    const shouldShow = ['height', 'width', 'capture_on_queue'].includes(
      rawWidget.name
    )

    if (shouldShow) {
      // Special handling for capture_on_queue widget
      if (rawWidget.name === 'capture_on_queue') {
        return markRaw({
          ...rawWidget,
          type: 'selectToggle',
          label: 'Capture Image',
          value: rawWidget.value ?? false,
          options: {
            ...rawWidget.options,
            hidden: false,
            values: [
              { label: 'On Run', value: true },
              { label: 'Manually', value: false }
            ]
          }
        })
      }

      return markRaw({
        ...rawWidget,
        options: {
          ...rawWidget.options,
          hidden: false
        }
      })
    }
    return rawWidget
  })

  node.widgets = newWidgets

  // Increment graph version to trigger reactivity
  if (node.graph) {
    node.graph._version++
  }

  app.graph.setDirtyCanvas(true, true)
}

async function handleTurnOnCamera() {
  if (props.readonly || isCameraOn.value) return

  isCameraOn.value = true
  showWidgets()

  // Wait for next tick to ensure reactivity has processed
  await nextTick()

  // Force another canvas update after nextTick
  app.graph.setDirtyCanvas(true, true)
}

onMounted(() => {
  // Store original widget states before modifying them
  storeOriginalWidgets()
  // Hide all widgets initially until camera is turned on
  hideWidgets()
})

onUnmounted(() => {
  restoreWidgets()
})
</script>

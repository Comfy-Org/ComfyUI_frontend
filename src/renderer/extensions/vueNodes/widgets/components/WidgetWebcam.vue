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
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

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

  // Deep clone the original widgets to preserve their state
  originalWidgets.value = [...node.widgets]
}

function hideWidgets() {
  const node = litegraphNode.value
  if (!node?.widgets) return

  // Create completely new widget objects to trigger shallowReactive
  const newWidgets = node.widgets.map((widget) => {
    const shouldHide = ['height', 'width', 'capture_on_queue'].includes(
      widget.name
    )

    if (shouldHide) {
      // Special handling for capture_on_queue widget
      if (widget.name === 'capture_on_queue') {
        return {
          ...widget,
          type: 'selectToggle',
          label: 'Capture Image',
          value: widget.value ?? false,
          options: {
            ...widget.options,
            hidden: true,
            values: [
              { label: 'On Run', value: true },
              { label: 'Manually', value: false }
            ]
          }
        }
      }

      return {
        ...widget,
        options: {
          ...widget.options,
          hidden: true
        }
      }
    }
    return widget
  })

  node.widgets = newWidgets
}

function restoreWidgets() {
  const node = litegraphNode.value
  if (!node?.widgets || originalWidgets.value.length === 0) return

  // Restore the original widgets
  node.widgets = originalWidgets.value
}

function showWidgets() {
  const node = litegraphNode.value
  if (!node?.widgets) return

  // Create completely new widget objects to trigger shallowReactive
  const newWidgets = node.widgets.map((widget) => {
    const shouldShow = ['height', 'width', 'capture_on_queue'].includes(
      widget.name
    )

    if (shouldShow) {
      // Special handling for capture_on_queue widget
      if (widget.name === 'capture_on_queue') {
        return {
          ...widget,
          type: 'selectToggle',
          label: 'Capture Image',
          value: widget.value ?? false,
          options: {
            ...widget.options,
            hidden: false,
            values: [
              { label: 'On Run', value: true },
              { label: 'Manually', value: false }
            ]
          }
        }
      }

      return {
        ...widget,
        options: {
          ...widget.options,
          hidden: false
        }
      }
    }
    return widget
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

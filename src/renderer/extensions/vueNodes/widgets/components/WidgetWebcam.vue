<template>
  <div class="relative">
    <div class="mb-4">
      <Button
        class="text-text-secondary w-full border-0 bg-component-node-widget-background hover:bg-secondary-background-hover"
        :disabled="isCameraOn || readonly"
        @click="handleTurnOnCamera"
      >
        {{ t('g.turnOnCamera', 'Turn on Camera') }}
        <i-lucide:video class="ml-1" />
      </Button>
    </div>
    <LODFallback />
  </div>
</template>

<script setup lang="ts">
import { Button } from 'primevue'
import { computed, nextTick, onMounted, ref } from 'vue'

import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import LODFallback from '@/renderer/extensions/vueNodes/components/LODFallback.vue'
import { app } from '@/scripts/app'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const props = defineProps<{
  widget: SimplifiedWidget<string | number | undefined>
  readonly?: boolean
  nodeId: string
}>()

const isCameraOn = ref(false)

const litegraphNode = computed(() => {
  if (!props.nodeId || !app.rootGraph) return null
  return app.rootGraph.getNodeById(props.nodeId) as LGraphNode | null
})

function hideWidgets() {
  const node = litegraphNode.value
  if (!node?.widgets) return

  // Create completely new widget objects to trigger shallowReactive
  const newWidgets = node.widgets.map((widget) => {
    const shouldHide = ['height', 'width', 'capture_on_queue'].includes(
      widget.name
    )

    if (shouldHide) {
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

function showWidgets() {
  const node = litegraphNode.value
  if (!node?.widgets) return

  // Create completely new widget objects to trigger shallowReactive
  const newWidgets = node.widgets.map((widget) => {
    const shouldShow = ['height', 'width', 'capture_on_queue'].includes(
      widget.name
    )

    if (shouldShow) {
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
  // Hide all widgets initially until camera is turned on
  hideWidgets()
})
</script>

<script setup lang="ts">
import { remove } from 'es-toolkit'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import DraggableList from '@/components/common/DraggableList.vue'
import { extractVueNodeData } from '@/composables/graph/useGraphNodeManager'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import DropZone from '@/renderer/extensions/linearMode/DropZone.vue'
import NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'
import { applyLightThemeColor } from '@/renderer/extensions/vueNodes/utils/nodeStyleUtils'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { cn } from '@/utils/tailwindUtil'
import { useAppModeStore } from '@/stores/appModeStore'
const { t } = useI18n()
const appModeStore = useAppModeStore()

const mappedSelections = computed(() => {
  let unprocessedInputs = [...appModeStore.selectedInputs]
  return unprocessedInputs.map(([nodeId, widgetName]) => {
    const node =
      app.rootGraph.getNodeById(nodeId) ??
      [...app.rootGraph.subgraphs.values()]
        .flatMap((sg) => sg.nodes)
        .find((n) => n.id == nodeId)
    if (!node) throw new Error('missing node')

    const nodeData = nodeToNodeData(node)
    remove(nodeData.widgets ?? [], ({ name }) => widgetName !== name)
    return nodeData
  })
})

function getDropIndicator(node: LGraphNode) {
  if (node.type !== 'LoadImage') return undefined

  const filename = node.widgets?.[0]?.value
  const resultItem = { type: 'input', filename: `${filename}` }

  return {
    iconClass: 'icon-[lucide--image]',
    imageUrl: filename
      ? api.apiURL(
          `/view?${new URLSearchParams(resultItem)}${app.getPreviewFormatParam()}`
        )
      : undefined,
    label: t('linearMode.dragAndDropImage'),
    onClick: () => node.widgets?.[1]?.callback?.(undefined)
  }
}

function nodeToNodeData(node: LGraphNode) {
  const dropIndicator = getDropIndicator(node)
  const nodeData = extractVueNodeData(node)
  for (const widget of nodeData.widgets ?? []) widget.slotMetadata = undefined

  return { ...nodeData, dropIndicator }
}
</script>
<template>
  <div
    class="border gap-2 min-w-70 size-full border-[var(--interface-stroke)] bg-comfy-menu-bg flex flex-col px-2"
  >
    <section
      data-testid="linear-widgets"
      class="grow-1 md:overflow-y-auto md:contain-size"
    >
      <DraggableList
        v-slot="{ dragClass }"
        v-model="appModeStore.selectedInputs"
      >
        <template v-for="nodeData of mappedSelections" :key="nodeData.id">
          <div :class="cn(dragClass, 'relative')">
            <DropZone
              :drop-indicator="nodeData.dropIndicator"
              class="text-muted-foreground"
            >
              <NodeWidgets
                :node-data
                class="py-3 gap-y-3 **:[.col-span-2]:grid-cols-1 *:has-[textarea]:h-50 rounded-lg pointer-events-none"
                :style="{ background: applyLightThemeColor(nodeData.bgcolor) }"
              />
            </DropZone>
            <div class="absolute size-full top-0 drag-handle" />
          </div>
        </template>
      </DraggableList>
    </section>
  </div>
</template>

<template>
  <div ref="container" class="node-lib-node-container">
    <TreeExplorerTreeNode :node="node">
      <template #actions>
        <Button
          size="small"
          text
          severity="secondary"
          @click.stop="onClick"
        >
          <i-lucide:eye-off v-if="isShown"/>
          <i-lucide:eye v-else/>
        </Button>
      </template>
    </TreeExplorerTreeNode>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Button from 'primevue/button'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { useCanvasStore } from '@/stores/graphStore'

function hasWidget() {
  const node = props.node.data[2]
  const name = props.node.data[1].name
  return node.widgets.some((w) => w.name === name)
}

let isShown = ref(false)

import TreeExplorerTreeNode from '@/components/common/TreeExplorerTreeNode.vue'
import { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

const props = defineProps<{
  node: RenderedTreeExplorerNode<ComfyNodeDefImpl>
}>()

onMounted(() => {
  isShown.value = hasWidget()
})

function onClick(e) {
  const nodeId = props.node.data[0].id
  const widgetName = props.node.data[1].name
  const node = props.node.data[2]

  const { widgetStates } = useDomWidgetStore()
  if (!isShown.value) {
    const w = node.addProxyWidget(`${nodeId}`, widgetName)
    if (widgetStates.has(w.id)) {
      const widgetState = widgetStates.get(w.id)
      widgetState.active = true
      widgetState.widget = w
    }
    isShown.value = true
  } else {
    //FIXME: widget name collisions
    const index = node.widgets.findIndex((w) => w.name === widgetName)
    if (index < 0) throw new Error("Can't disable missing widget")
    const w = node.widgets.splice(index, 1)
    if (widgetStates.has(w.id)) {
      widgetStates.get(w.id).active = false
    }
    const { properties } = node
    properties.proxyWidgets = properties.proxyWidgets.filter((p) => p[1] !== widgetName)

    isShown.value = false
  }
  useCanvasStore().canvas.setDirty(true)
}
</script>

<style scoped>
.node-lib-node-container {
  @apply h-full w-full;
}
</style>

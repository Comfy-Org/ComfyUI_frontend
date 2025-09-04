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

  console.log(isShown.value)
  if (!isShown.value) {
    node.addProxyWidget(`${nodeId}`, widgetName)
    isShown.value = true
  } else {
    //FIXME: widget name collisions
    const index = node.widgets.findIndex((w) => w.name === widgetName)
    if (index < 0) throw new Error("Can't disable missing widget")
    node.widgets.splice(index, 1)
    isShown.value = false
  }
}
</script>

<style scoped>
.node-lib-node-container {
  @apply h-full w-full;
}
</style>

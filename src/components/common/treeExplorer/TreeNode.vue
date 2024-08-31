<template>
  <div class="tree-leaf" ref="container">
    <div class="leaf-content">
      <span class="leaf-label">
        <slot name="label" :node="node">
          {{ props.node.label }}
        </slot>
      </span>
    </div>
    <slot name="actions" :node="node">
      <!-- Default slot content for actions -->
    </slot>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'
const props = defineProps<{
  node: RenderedTreeExplorerNode
}>()
const emit = defineEmits<{
  (e: 'dragStart', node: RenderedTreeExplorerNode): void
  (e: 'dragEnd', node: RenderedTreeExplorerNode): void
}>()
const container = ref<HTMLElement | null>(null)
let draggableCleanup: () => void
onMounted(() => {
  const treeNodeElement = container.value?.closest(
    '.p-tree-node'
  ) as HTMLElement
  draggableCleanup = draggable({
    element: treeNodeElement,
    getInitialData() {
      return {
        type: 'tree-explorer-node',
        data: props.node
      }
    },
    onDragStart: () => emit('dragStart', props.node),
    onDrop: () => emit('dragEnd', props.node)
  })
})
onUnmounted(() => {
  if (draggableCleanup) {
    draggableCleanup()
  }
})
</script>

<style scoped>
.tree-leaf {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.leaf-content {
  display: flex;
  align-items: center;
  flex-grow: 1;
}
.leaf-label {
  margin-left: 0.5rem;
}
</style>

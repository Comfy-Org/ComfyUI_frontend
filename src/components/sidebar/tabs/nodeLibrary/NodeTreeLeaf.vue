<template>
  <div class="node-tree-leaf" ref="container">
    <div class="node-content">
      <Tag
        v-if="node.experimental"
        :value="$t('experimental')"
        severity="primary"
      />
      <Tag v-if="node.deprecated" :value="$t('deprecated')" severity="danger" />
      <span class="node-label">{{ node.display_name }}</span>
    </div>
    <Button
      class="bookmark-button"
      size="small"
      :icon="isBookmarked ? 'pi pi-bookmark-fill' : 'pi pi-bookmark'"
      text
      severity="secondary"
      @click.stop="toggleBookmark"
    />
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { onMounted, onUnmounted, ref } from 'vue'
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { CanvasDragAndDropData } from '@/types/litegraphTypes'

const props = defineProps<{
  node: ComfyNodeDefImpl
  isBookmarked: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-bookmark', value: ComfyNodeDefImpl): void
}>()

const toggleBookmark = () => {
  emit('toggle-bookmark', props.node)
}

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
        type: 'add-node',
        data: props.node
      } as CanvasDragAndDropData<ComfyNodeDefImpl>
    }
  })
})
onUnmounted(() => {
  draggableCleanup()
})
</script>

<style scoped>
.node-tree-leaf {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.node-content {
  display: flex;
  align-items: center;
  flex-grow: 1;
}

.node-label {
  margin-left: 0.5rem;
}

.bookmark-button {
  width: unset;
  padding: 0.25rem;
}
</style>

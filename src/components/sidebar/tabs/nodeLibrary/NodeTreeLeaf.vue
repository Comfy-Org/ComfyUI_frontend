<template>
  <TreeExplorerTreeNode :node="node">
    <template #before-label>
      <Tag
        v-if="nodeDef.experimental"
        :value="$t('experimental')"
        severity="primary"
      />
      <Tag
        v-if="nodeDef.deprecated"
        :value="$t('deprecated')"
        severity="danger"
      />
    </template>
    <template #actions>
      <Button
        class="bookmark-button"
        size="small"
        :icon="isBookmarked ? 'pi pi-bookmark-fill' : 'pi pi-bookmark'"
        text
        severity="secondary"
        @click.stop="toggleBookmark"
      />
    </template>
  </TreeExplorerTreeNode>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import TreeExplorerTreeNode from '@/components/common/TreeExplorerTreeNode.vue'
import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { computed } from 'vue'
import { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'

const props = defineProps<{
  node: RenderedTreeExplorerNode<ComfyNodeDefImpl>
}>()

const nodeDef = computed(() => props.node.data)
const nodeBookmarkStore = useNodeBookmarkStore()
const isBookmarked = computed(() =>
  nodeBookmarkStore.isBookmarked(nodeDef.value)
)

const emit = defineEmits<{
  (e: 'toggle-bookmark', value: ComfyNodeDefImpl): void
}>()

const toggleBookmark = () => {
  nodeBookmarkStore.toggleBookmark(nodeDef.value)
}
</script>

<style scoped>
.bookmark-button {
  width: unset;
  padding: 0.25rem;
}
</style>

<template>
  <TreeExplorer :roots="props.roots"></TreeExplorer>
</template>

<script setup lang="ts">
import TreeExplorer from '@/components/common/TreeExplorer.vue'
import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { TreeExplorerNode } from '@/types/treeExplorerTypes'

const props = defineProps<{
  roots: TreeExplorerNode<ComfyNodeDefImpl>[]
}>()
</script>

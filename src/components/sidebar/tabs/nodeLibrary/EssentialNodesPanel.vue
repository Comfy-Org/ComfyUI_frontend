<template>
  <TabsContent value="essentials" class="min-h-0 flex-1 overflow-y-auto">
    <TreeExplorerV2
      v-model:expanded-keys="expandedKeys"
      :root="root"
      @node-click="(node) => emit('nodeClick', node)"
    />
  </TabsContent>
</template>

<script setup lang="ts">
import { TabsContent } from 'reka-ui'

import TreeExplorerV2 from '@/components/common/TreeExplorerV2.vue'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

defineProps<{
  root: RenderedTreeExplorerNode<ComfyNodeDefImpl>
}>()

const expandedKeys = defineModel<string[]>('expandedKeys', { required: true })

const emit = defineEmits<{
  nodeClick: [node: RenderedTreeExplorerNode<ComfyNodeDefImpl>]
}>()
</script>

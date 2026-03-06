<template>
  <TabsContent value="blueprints" class="h-full flex-1 overflow-y-auto">
    <div v-for="(section, index) in sections" :key="section.title ?? index">
      <h3
        v-if="section.title"
        class="mb-0 px-4 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase"
      >
        {{ $t(section.title) }}
      </h3>
      <TreeExplorerV2
        v-model:expanded-keys="expandedKeys"
        :root="section.root"
        :show-context-menu="false"
        @node-click="(node) => emit('nodeClick', node)"
      />
    </div>
  </TabsContent>
</template>

<script setup lang="ts">
import { TabsContent } from 'reka-ui'

import TreeExplorerV2 from '@/components/common/TreeExplorerV2.vue'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type {
  NodeLibrarySection,
  RenderedTreeExplorerNode
} from '@/types/treeExplorerTypes'

defineProps<{
  sections: NodeLibrarySection<ComfyNodeDefImpl>[]
}>()

const expandedKeys = defineModel<string[]>('expandedKeys', { required: true })

const emit = defineEmits<{
  nodeClick: [node: RenderedTreeExplorerNode<ComfyNodeDefImpl>]
}>()
</script>

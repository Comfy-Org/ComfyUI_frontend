<template>
  <div class="scrollbar-custom h-full flex-1 pb-2">
    <div v-for="(section, index) in sections" :key="section.title ?? index">
      <SidebarSectionHeader v-if="section.title" :text="$t(section.title)" />
      <TreeExplorerV2
        v-model:expanded-keys="expandedKeys"
        :root="section.root"
        :show-context-menu="false"
        @node-click="(node) => emit('nodeClick', node)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import TreeExplorerV2 from '@/components/common/TreeExplorerV2.vue'
import SidebarSectionHeader from '@/components/sidebar/tabs/SidebarSectionHeader.vue'
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

<template>
  <div class="scrollbar-custom h-full flex-1 pb-2">
    <!-- Favorites section -->
    <SidebarSectionHeader
      :text="$t('sideToolbar.nodeLibraryTab.sections.bookmarked')"
    />
    <TreeExplorerV2
      v-if="hasFavorites"
      v-model:expanded-keys="expandedKeys"
      :root="favoritesRoot"
      show-context-menu
      @node-click="(node) => emit('nodeClick', node)"
    />
    <div v-else class="px-6 py-2 text-xs text-muted-background">
      {{ $t('sideToolbar.nodeLibraryTab.noBookmarkedNodes') }}
    </div>

    <!-- Node sections -->
    <div v-for="(section, index) in sections" :key="section.category ?? index">
      <SidebarSectionHeader
        v-if="section.category && sortOrder !== 'alphabetical'"
        :text="$t(NODE_CATEGORY_LABELS[section.category])"
      />
      <TreeExplorerV2
        v-model:expanded-keys="expandedKeys"
        :root="section.root"
        show-context-menu
        @node-click="(node) => emit('nodeClick', node)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import TreeExplorerV2 from '@/components/common/TreeExplorerV2.vue'
import SidebarSectionHeader from '@/components/sidebar/tabs/SidebarSectionHeader.vue'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { NODE_CATEGORY_LABELS } from '@/types/nodeOrganizationTypes'
import type {
  NodeLibrarySection,
  RenderedTreeExplorerNode,
  TreeNode
} from '@/types/treeExplorerTypes'

const { fillNodeInfo, sortOrder = 'original' } = defineProps<{
  sections: NodeLibrarySection<ComfyNodeDefImpl>[]
  fillNodeInfo: (node: TreeNode) => RenderedTreeExplorerNode<ComfyNodeDefImpl>
  sortOrder?: string
}>()

const expandedKeys = defineModel<string[]>('expandedKeys', { required: true })

const emit = defineEmits<{
  nodeClick: [node: RenderedTreeExplorerNode<ComfyNodeDefImpl>]
}>()

const nodeBookmarkStore = useNodeBookmarkStore()

const hasFavorites = computed(
  () => (nodeBookmarkStore.bookmarkedRoot.children?.length ?? 0) > 0
)

const favoritesRoot = computed(() =>
  fillNodeInfo(nodeBookmarkStore.bookmarkedRoot)
)
</script>

<template>
  <TabsContent value="all" class="flex-1 overflow-y-auto h-full">
    <!-- Favorites section -->
    <h3
      class="px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground mb-0"
    >
      {{ $t('sideToolbar.nodeLibraryTab.sections.bookmarked') }}
    </h3>
    <TreeExplorerV2
      v-if="hasFavorites"
      v-model:expanded-keys="expandedKeys"
      :root="favoritesRoot"
      show-context-menu
      @node-click="(node) => emit('nodeClick', node)"
      @add-to-favorites="handleAddToFavorites"
    />
    <div v-else class="px-6 py-2 text-xs text-muted-background">
      {{ $t('sideToolbar.nodeLibraryTab.noBookmarkedNodes') }}
    </div>

    <!-- Node sections -->
    <div v-for="(section, index) in sections" :key="section.category ?? index">
      <h3
        v-if="section.category && sortOrder !== 'alphabetical'"
        class="px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground mb-0"
      >
        {{ $t(NODE_CATEGORY_LABELS[section.category]) }}
      </h3>
      <TreeExplorerV2
        v-model:expanded-keys="expandedKeys"
        :root="section.root"
        show-context-menu
        @node-click="(node) => emit('nodeClick', node)"
        @add-to-favorites="handleAddToFavorites"
      />
    </div>
  </TabsContent>
</template>

<script setup lang="ts">
import { TabsContent } from 'reka-ui'
import { computed } from 'vue'

import TreeExplorerV2 from '@/components/common/TreeExplorerV2.vue'
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

function handleAddToFavorites(
  node: RenderedTreeExplorerNode<ComfyNodeDefImpl>
) {
  if (node.data) {
    nodeBookmarkStore.toggleBookmark(node.data)
  }
}
</script>

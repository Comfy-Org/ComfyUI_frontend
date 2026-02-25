<template>
  <div class="group/categories flex min-h-0 flex-col overflow-y-auto py-2.5">
    <!-- Preset categories -->
    <div v-if="!hidePresets" class="flex flex-col px-1">
      <button
        v-for="preset in topCategories"
        :key="preset.id"
        type="button"
        :data-testid="`category-${preset.id}`"
        :aria-current="selectedCategory === preset.id || undefined"
        :class="categoryBtnClass(preset.id)"
        @click="selectCategory(preset.id)"
      >
        {{ preset.label }}
      </button>
    </div>

    <!-- Source categories -->
    <div
      v-if="!hidePresets && sourceCategories.length > 0"
      class="my-2 flex flex-col border-y border-border-subtle px-1 py-2"
    >
      <button
        v-for="preset in sourceCategories"
        :key="preset.id"
        type="button"
        :data-testid="`category-${preset.id}`"
        :aria-current="selectedCategory === preset.id || undefined"
        :class="categoryBtnClass(preset.id)"
        @click="selectCategory(preset.id)"
      >
        {{ preset.label }}
      </button>
    </div>

    <!-- Category tree -->
    <div
      :class="
        cn(
          'flex flex-col px-1',
          !hidePresets &&
            !sourceCategories.length &&
            'mt-2 border-t border-border-subtle pt-2'
        )
      "
    >
      <NodeSearchCategoryTreeNode
        v-for="category in categoryTree"
        :key="category.key"
        :node="category"
        :selected-category="selectedCategory"
        :selected-collapsed="selectedCollapsed"
        :hide-chevrons="hideChevrons"
        @select="selectCategory"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import NodeSearchCategoryTreeNode, {
  CATEGORY_SELECTED_CLASS,
  CATEGORY_UNSELECTED_CLASS
} from '@/components/searchbox/v2/NodeSearchCategoryTreeNode.vue'
import type { CategoryNode } from '@/components/searchbox/v2/NodeSearchCategoryTreeNode.vue'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import { nodeOrganizationService } from '@/services/nodeOrganizationService'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { NodeSourceType } from '@/types/nodeSource'
import type { TreeNode } from '@/types/treeExplorerTypes'
import { cn } from '@/utils/tailwindUtil'

const {
  hideChevrons = false,
  hidePresets = false,
  nodeDefs
} = defineProps<{
  hideChevrons?: boolean
  hidePresets?: boolean
  nodeDefs?: ComfyNodeDefImpl[]
}>()

const selectedCategory = defineModel<string>('selectedCategory', {
  required: true
})

const { t } = useI18n()
const { flags } = useFeatureFlags()
const nodeDefStore = useNodeDefStore()
const nodeBookmarkStore = useNodeBookmarkStore()

const topCategories = computed(() => {
  const categories = [{ id: 'most-relevant', label: t('g.mostRelevant') }]
  if (nodeBookmarkStore.bookmarks.length > 0) {
    categories.push({ id: 'favorites', label: t('g.favorites') })
  }
  return categories
})

const hasEssentialNodes = computed(
  () =>
    flags.nodeLibraryEssentialsEnabled &&
    nodeDefStore.visibleNodeDefs.some(
      (n) => n.nodeSource.type === NodeSourceType.Essentials
    )
)

const sourceCategories = computed(() => {
  const categories = []
  if (hasEssentialNodes.value) {
    categories.push({ id: 'essentials', label: t('g.essentials') })
  }
  categories.push({ id: 'custom', label: t('g.custom') })
  return categories
})

const categoryTree = computed<CategoryNode[]>(() => {
  const defs = nodeDefs ?? nodeDefStore.visibleNodeDefs
  const tree = nodeOrganizationService.organizeNodes(defs, {
    groupBy: 'category'
  })

  const stripRootPrefix = (key: string) => key.replace(/^root\//, '')

  function mapNode(node: TreeNode): CategoryNode {
    const children = node.children
      ?.filter((child): child is TreeNode => !child.leaf)
      .map(mapNode)
    return {
      key: stripRootPrefix(node.key as string),
      label: node.label,
      ...(children?.length ? { children } : {})
    }
  }

  let nodes = (tree.children ?? [])
    .filter((node): node is TreeNode => !node.leaf)
    .map(mapNode)

  // Skip single root node if it has children
  if (nodes.length === 1 && nodes[0].children?.length) {
    nodes = nodes[0].children
  }

  return nodes
})

function categoryBtnClass(id: string) {
  return cn(
    'cursor-pointer border-none bg-transparent rounded py-2.5 pr-3 text-left text-sm transition-colors',
    hideChevrons ? 'pl-3' : 'pl-9',
    selectedCategory.value === id
      ? CATEGORY_SELECTED_CLASS
      : CATEGORY_UNSELECTED_CLASS
  )
}

const selectedCollapsed = ref(false)

function selectCategory(categoryId: string) {
  if (selectedCategory.value === categoryId) {
    selectedCollapsed.value = !selectedCollapsed.value
  } else {
    selectedCollapsed.value = false
    selectedCategory.value = categoryId
  }
}
</script>

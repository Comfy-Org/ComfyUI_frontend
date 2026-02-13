<template>
  <div class="flex min-h-0 flex-col overflow-y-auto py-2.5">
    <!-- Preset categories -->
    <div class="flex flex-col px-1">
      <button
        v-for="preset in presetCategories"
        :key="preset.id"
        type="button"
        :data-testid="`category-${preset.id}`"
        :aria-current="selectedCategory === preset.id || undefined"
        :class="cn(categoryBtnClass(preset.id), preset.class)"
        @click="selectCategory(preset.id)"
      >
        {{ preset.label }}
      </button>
    </div>

    <!-- Category tree -->
    <div class="mt-3 flex flex-col px-1">
      <CategoryTreeNode
        v-for="category in categoryTree"
        :key="category.key"
        :node="category"
        :selected-category="selectedCategory"
        @select="selectCategory"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import CategoryTreeNode from '@/components/searchbox/v2/CategoryTreeNode.vue'
import type { CategoryNode } from '@/components/searchbox/v2/CategoryTreeNode.vue'
import { nodeOrganizationService } from '@/services/nodeOrganizationService'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import type { TreeNode } from '@/types/treeExplorerTypes'
import { cn } from '@/utils/tailwindUtil'

const selectedCategory = defineModel<string>('selectedCategory', {
  required: true
})

const { t } = useI18n()
const nodeDefStore = useNodeDefStore()

const presetCategories = computed(() => [
  { id: 'most-relevant', label: t('g.mostRelevant') },
  { id: 'favorites', label: t('g.favorites') },
  { id: 'essentials', label: t('g.essentials'), class: 'mt-3' },
  { id: 'custom', label: t('g.custom') }
])

const categoryTree = computed<CategoryNode[]>(() => {
  const tree = nodeOrganizationService.organizeNodes(
    nodeDefStore.visibleNodeDefs,
    { groupBy: 'category' }
  )

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

  return (tree.children ?? [])
    .filter((node): node is TreeNode => !node.leaf)
    .map(mapNode)
})

function categoryBtnClass(id: string, padding = 'px-3') {
  return cn(
    'cursor-pointer border-none bg-transparent rounded py-2.5 text-left text-sm transition-colors',
    padding,
    selectedCategory.value === id
      ? 'bg-highlight font-semibold text-foreground'
      : 'text-muted-foreground hover:bg-highlight hover:text-foreground'
  )
}

function selectCategory(categoryId: string) {
  selectedCategory.value = categoryId
}
</script>

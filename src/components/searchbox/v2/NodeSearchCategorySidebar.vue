<template>
  <RovingFocusGroup
    as="div"
    orientation="vertical"
    :loop="true"
    class="group/categories flex min-h-0 flex-col overflow-y-auto py-2.5 select-none"
  >
    <!-- Preset categories -->
    <div v-if="!hidePresets" class="flex flex-col px-3">
      <RovingFocusItem
        v-for="preset in topCategories"
        :key="preset.id"
        as-child
      >
        <Button
          type="button"
          :data-testid="`category-${preset.id}`"
          :aria-current="selectedCategory === preset.id || undefined"
          :class="categoryBtnClass(preset.id)"
          @click="selectCategory(preset.id)"
        >
          {{ preset.label }}
        </Button>
      </RovingFocusItem>
    </div>

    <!-- Category tree -->
    <div
      role="tree"
      :aria-label="t('g.category')"
      :class="
        cn(
          'flex flex-col px-3',
          !hidePresets && 'mt-2 border-t border-border-subtle pt-2'
        )
      "
    >
      <NodeSearchCategoryTreeNode
        v-for="category in categoryTree"
        :key="category.key"
        :node="category"
        :selected-category="selectedCategory"
        :expanded-category="expandedCategory"
        :hide-chevrons="hideChevrons"
        @select="selectCategory"
        @collapse="collapseCategory"
      />
    </div>
  </RovingFocusGroup>
</template>

<script lang="ts">
export const DEFAULT_CATEGORY = 'most-relevant'
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RovingFocusGroup, RovingFocusItem } from 'reka-ui'

import NodeSearchCategoryTreeNode, {
  CATEGORY_SELECTED_CLASS,
  CATEGORY_UNSELECTED_CLASS
} from '@/components/searchbox/v2/NodeSearchCategoryTreeNode.vue'
import Button from '@/components/ui/button/Button.vue'
import type { CategoryNode } from '@/components/searchbox/v2/NodeSearchCategoryTreeNode.vue'
import { nodeOrganizationService } from '@/services/nodeOrganizationService'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import type { TreeNode } from '@/types/treeExplorerTypes'
import { cn } from '@/utils/tailwindUtil'

const {
  hideChevrons = false,
  hidePresets = false,
  nodeDefs,
  rootLabel,
  rootKey
} = defineProps<{
  hideChevrons?: boolean
  hidePresets?: boolean
  nodeDefs?: ComfyNodeDefImpl[]
  rootLabel?: string
  rootKey?: string
}>()

const selectedCategory = defineModel<string>('selectedCategory', {
  required: true
})

const emit = defineEmits<{
  autoExpand: [key: string]
}>()

const { t } = useI18n()
const nodeDefStore = useNodeDefStore()

const topCategories = computed(() => [
  { id: DEFAULT_CATEGORY, label: t('g.mostRelevant') }
])

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

  const nodes = (tree.children ?? [])
    .filter((node): node is TreeNode => !node.leaf)
    .map(mapNode)

  if (rootLabel && nodes.length > 1) {
    const key = rootKey ?? rootLabel.toLowerCase()
    function prefixKeys(node: CategoryNode): CategoryNode {
      return {
        key: key + '/' + node.key,
        label: node.label,
        ...(node.children?.length
          ? { children: node.children.map(prefixKeys) }
          : {})
      }
    }
    return [{ key, label: rootLabel, children: nodes.map(prefixKeys) }]
  }

  return nodes
})

// Notify parent when there is only a single root category to auto-expand
watch(
  categoryTree,
  (nodes) => {
    if (nodes.length === 1 && nodes[0].children?.length) {
      const rootKey = nodes[0].key
      if (
        selectedCategory.value !== rootKey &&
        !selectedCategory.value.startsWith(rootKey + '/')
      ) {
        emit('autoExpand', rootKey)
      }
    }
  },
  { immediate: true }
)

function categoryBtnClass(id: string) {
  return cn(
    'h-auto justify-start bg-transparent py-2.5 pr-3 text-sm font-normal',
    hideChevrons ? 'pl-3' : 'pl-9',
    selectedCategory.value === id
      ? CATEGORY_SELECTED_CLASS
      : CATEGORY_UNSELECTED_CLASS
  )
}

const expandedCategory = ref(selectedCategory.value)
// Skips the watch when selectCategory/collapseCategory set selectedCategory,
// so their expandedCategory toggle isn't immediately undone.
let lastEmittedCategory = ''

watch(selectedCategory, (val) => {
  if (val !== lastEmittedCategory) {
    expandedCategory.value = val
  }
  lastEmittedCategory = ''
})

function parentCategory(key: string): string {
  const i = key.lastIndexOf('/')
  return i > 0 ? key.slice(0, i) : ''
}

function selectCategory(categoryId: string) {
  if (expandedCategory.value === categoryId) {
    expandedCategory.value = parentCategory(categoryId)
  } else {
    expandedCategory.value = categoryId
  }
  lastEmittedCategory = categoryId
  selectedCategory.value = categoryId
}

function collapseCategory(categoryId: string) {
  expandedCategory.value = parentCategory(categoryId)
  lastEmittedCategory = categoryId
  selectedCategory.value = categoryId
}
</script>

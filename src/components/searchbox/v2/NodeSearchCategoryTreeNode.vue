<template>
  <div
    :class="
      cn(
        isExpanded &&
          hasChildren &&
          'flex flex-col rounded-lg bg-secondary-background'
      )
    "
  >
    <button
      type="button"
      :data-testid="`category-${node.key}`"
      :aria-current="selectedCategory === node.key || undefined"
      :class="categoryButtonClass"
      :style="{ paddingLeft: paddingLeft }"
      @click="$emit('select', node.key)"
    >
      <i
        v-if="showChevrons && hasChildren"
        :class="
          cn(
            'pi pi-chevron-down shrink-0 text-[10px] transition-transform',
            !isExpanded && '-rotate-90'
          )
        "
      />
      {{ node.label }}
    </button>
    <template v-if="isExpanded && hasChildren">
      <NodeSearchCategoryTreeNode
        v-for="child in node.children"
        :key="child.key"
        :node="child"
        :depth="depth + 1"
        :selected-category="selectedCategory"
        :selected-collapsed="selectedCollapsed"
        :show-chevrons="showChevrons"
        @select="$emit('select', $event)"
      />
    </template>
  </div>
</template>

<script lang="ts">
export interface CategoryNode {
  key: string
  label: string
  children?: CategoryNode[]
}

export const CATEGORY_SELECTED_CLASS =
  'bg-secondary-background-hover font-semibold text-foreground'
export const CATEGORY_UNSELECTED_CLASS =
  'text-muted-foreground hover:bg-secondary-background-hover hover:text-foreground'
</script>

<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const {
  node,
  depth = 0,
  selectedCategory,
  selectedCollapsed = false,
  showChevrons = false
} = defineProps<{
  node: CategoryNode
  depth?: number
  selectedCategory: string
  selectedCollapsed?: boolean
  showChevrons?: boolean
}>()

defineEmits<{
  select: [key: string]
}>()

const hasChildren = computed(() => (node.children?.length ?? 0) > 0)

const isExpanded = computed(() => {
  if (selectedCategory === node.key) return !selectedCollapsed
  return selectedCategory.startsWith(node.key + '/')
})

const paddingLeft = computed(() => {
  if (hasChildren.value && showChevrons) return `${0.5 + depth * 1.25}rem`
  return `${0.75 + depth * 1.25}rem`
})

const categoryButtonClass = computed(() =>
  cn(
    'w-full cursor-pointer rounded border-none bg-transparent py-3 pr-3 text-left text-sm transition-colors flex items-center gap-2',
    selectedCategory === node.key
      ? CATEGORY_SELECTED_CLASS
      : CATEGORY_UNSELECTED_CLASS
  )
)
</script>

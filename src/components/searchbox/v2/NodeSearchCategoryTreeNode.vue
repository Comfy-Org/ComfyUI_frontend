<template>
  <div
    :class="
      cn(
        selectedCategory === node.key &&
          isExpanded &&
          node.children?.length &&
          'rounded bg-secondary-background'
      )
    "
  >
    <button
      type="button"
      :data-testid="`category-${node.key}`"
      :aria-current="selectedCategory === node.key || undefined"
      :style="{ paddingLeft: `${0.75 + depth * 1.25}rem` }"
      :class="
        cn(
          'flex w-full cursor-pointer items-center gap-2 rounded border-none bg-transparent py-2.5 pr-3 text-left text-sm transition-colors',
          selectedCategory === node.key
            ? CATEGORY_SELECTED_CLASS
            : CATEGORY_UNSELECTED_CLASS
        )
      "
      @click="$emit('select', node.key)"
    >
      <i
        v-if="!hideChevrons"
        :class="
          cn(
            'size-4 shrink-0 text-muted-foreground transition-[transform,opacity] duration-150',
            node.children?.length
              ? 'icon-[lucide--chevron-down] opacity-0 group-hover/categories:opacity-100'
              : '',
            node.children?.length && !isExpanded && '-rotate-90'
          )
        "
      />
      <span class="flex-1 truncate">{{ node.label }}</span>
    </button>
    <template v-if="isExpanded && node.children?.length">
      <NodeSearchCategoryTreeNode
        v-for="child in node.children"
        :key="child.key"
        :node="child"
        :depth="depth + 1"
        :selected-category="selectedCategory"
        :selected-collapsed="selectedCollapsed"
        :hide-chevrons="hideChevrons"
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
  hideChevrons = false
} = defineProps<{
  node: CategoryNode
  depth?: number
  selectedCategory: string
  selectedCollapsed?: boolean
  hideChevrons?: boolean
}>()

defineEmits<{
  select: [key: string]
}>()

const isExpanded = computed(() => {
  if (selectedCategory === node.key) return !selectedCollapsed
  return selectedCategory.startsWith(node.key + '/')
})
</script>

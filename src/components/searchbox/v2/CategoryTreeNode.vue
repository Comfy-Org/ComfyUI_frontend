<template>
  <button
    type="button"
    :data-testid="`category-${node.key}`"
    :aria-current="selectedCategory === node.key || undefined"
    :style="{ paddingLeft: `${0.75 + depth * 0.75}rem` }"
    :class="
      cn(
        'w-full cursor-pointer rounded border-none bg-transparent py-2.5 pr-3 text-left text-sm transition-colors',
        selectedCategory === node.key
          ? 'bg-highlight font-semibold text-foreground'
          : 'text-muted-foreground hover:bg-highlight hover:text-foreground'
      )
    "
    @click="$emit('select', node.key)"
  >
    {{ node.label }}
  </button>
  <template v-if="isExpanded && node.children?.length">
    <CategoryTreeNode
      v-for="child in node.children"
      :key="child.key"
      :node="child"
      :depth="depth + 1"
      :selected-category="selectedCategory"
      @select="$emit('select', $event)"
    />
  </template>
</template>

<script lang="ts">
export interface CategoryNode {
  key: string
  label: string
  children?: CategoryNode[]
}
</script>

<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const {
  node,
  depth = 0,
  selectedCategory
} = defineProps<{
  node: CategoryNode
  depth?: number
  selectedCategory: string
}>()

defineEmits<{
  select: [key: string]
}>()

const isExpanded = computed(
  () =>
    selectedCategory === node.key || selectedCategory.startsWith(node.key + '/')
)
</script>

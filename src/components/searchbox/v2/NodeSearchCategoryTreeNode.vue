<template>
  <div
    :class="
      cn(
        selectedCategory === node.key &&
          isExpanded &&
          node.children?.length &&
          'rounded-lg bg-secondary-background'
      )
    "
  >
    <RovingFocusItem as-child>
      <button
        ref="buttonEl"
        type="button"
        role="treeitem"
        :data-testid="`category-${node.key}`"
        :aria-current="selectedCategory === node.key || undefined"
        :aria-expanded="node.children?.length ? isExpanded : undefined"
        :style="{ paddingLeft: `${0.75 + depth * 1.25}rem` }"
        :class="
          cn(
            'flex w-full cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent py-2.5 pr-3 text-left font-inter text-sm transition-colors',
            selectedCategory === node.key
              ? CATEGORY_SELECTED_CLASS
              : CATEGORY_UNSELECTED_CLASS
          )
        "
        @click="$emit('select', node.key)"
        @keydown.right.prevent="handleRight"
        @keydown.left.prevent="handleLeft"
      >
        <i
          v-if="!hideChevrons"
          :class="
            cn(
              'size-4 shrink-0 text-muted-foreground transition-[transform,opacity] duration-150',
              node.children?.length
                ? 'icon-[lucide--chevron-down] opacity-0 group-focus-within/categories:opacity-100 group-hover/categories:opacity-100'
                : '',
              node.children?.length && !isExpanded && '-rotate-90'
            )
          "
        />
        <span class="flex-1 truncate">{{ node.label }}</span>
      </button>
    </RovingFocusItem>
    <div v-if="isExpanded && node.children?.length" role="group">
      <NodeSearchCategoryTreeNode
        v-for="child in node.children"
        :key="child.key"
        ref="childRefs"
        :node="child"
        :depth="depth + 1"
        :selected-category="selectedCategory"
        :selected-collapsed="selectedCollapsed"
        :hide-chevrons="hideChevrons"
        :focus-parent="() => buttonEl?.focus()"
        @select="$emit('select', $event)"
      />
    </div>
  </div>
</template>

<script lang="ts">
export interface CategoryNode {
  key: string
  label: string
  children?: CategoryNode[]
}

export const CATEGORY_SELECTED_CLASS =
  'bg-secondary-background-hover text-foreground'
export const CATEGORY_UNSELECTED_CLASS =
  'text-muted-foreground hover:bg-secondary-background-hover hover:text-foreground'
</script>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { RovingFocusItem } from 'reka-ui'

import { cn } from '@/utils/tailwindUtil'

const {
  node,
  depth = 0,
  selectedCategory,
  selectedCollapsed = false,
  hideChevrons = false,
  focusParent
} = defineProps<{
  node: CategoryNode
  depth?: number
  selectedCategory: string
  selectedCollapsed?: boolean
  hideChevrons?: boolean
  focusParent?: () => void
}>()

const emit = defineEmits<{
  select: [key: string]
}>()

const buttonEl = ref<HTMLButtonElement>()
const childRefs = ref<{ focus?: () => void }[]>([])

defineExpose({ focus: () => buttonEl.value?.focus() })

const isExpanded = computed(() => {
  if (selectedCategory === node.key) return !selectedCollapsed
  return selectedCategory.startsWith(node.key + '/')
})

function handleRight() {
  if (!node.children?.length) return
  if (!isExpanded.value) {
    emit('select', node.key)
    return
  }
  nextTick(() => {
    childRefs.value[0]?.focus?.()
  })
}

function handleLeft() {
  if (node.children?.length && isExpanded.value) {
    emit('select', node.key)
    return
  }
  focusParent?.()
}
</script>

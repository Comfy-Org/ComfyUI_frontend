<template>
  <RekaTreeItem
    ref="item"
    v-slot="{ isExpanded, handleToggle }"
    v-bind="restProps"
    :class="cn(treeItemClass, className)"
    :style="treeItemIndent(restProps.level)"
    @select="emits('select', $event)"
    @toggle="preventClickToggle"
  >
    <Button
      v-if="hasChildren"
      type="button"
      variant="muted-textonly"
      size="icon-sm"
      tabindex="-1"
      aria-hidden="true"
      class="shrink-0"
      @click.stop="handleToggle"
    >
      <i
        :class="
          cn(
            'icon-[lucide--chevron-right] shrink-0 transition-transform',
            isExpanded && 'rotate-90'
          )
        "
      />
    </Button>
    <span v-else class="size-5 shrink-0" />
    <div class="contents" @keydown="keepKeysInEditableContent">
      <slot :is-hovered />
    </div>
  </RekaTreeItem>
</template>

<script setup lang="ts" generic="T extends object">
import type { TreeItemEmits, TreeItemProps, TreeItemToggleEvent } from 'reka-ui'
import { TreeItem as RekaTreeItem, injectTreeRootContext } from 'reka-ui'
import { useElementHover } from '@vueuse/core'
import type { HTMLAttributes } from 'vue'
import { computed, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@comfyorg/design-system/button/Button'
import { treeItemClass, treeItemIndent } from './treeStyles'

const { class: className, ...restProps } = defineProps<
  Omit<TreeItemProps<T>, 'as' | 'asChild'> & {
    class?: HTMLAttributes['class']
  }
>()

const emits = defineEmits<TreeItemEmits<T>>()

const isHovered = useElementHover(useTemplateRef('item'))

const rootContext = injectTreeRootContext()
const hasChildren = computed(() => !!rootContext.getChildren(restProps.value))

const NAVIGATION_KEYS = new Set([
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'End',
  'Home'
])

function isShortcut(event: KeyboardEvent) {
  return (event.ctrlKey || event.metaKey) && !NAVIGATION_KEYS.has(event.key)
}

function keepKeysInEditableContent(event: KeyboardEvent) {
  if (
    event.target instanceof HTMLElement &&
    event.target.matches('input, textarea') &&
    !isShortcut(event)
  ) {
    event.stopPropagation()
  }
}

function preventClickToggle(event: TreeItemToggleEvent<T>) {
  if (!(event.detail.originalEvent instanceof KeyboardEvent)) {
    event.preventDefault()
  }
  emits('toggle', event)
}
</script>

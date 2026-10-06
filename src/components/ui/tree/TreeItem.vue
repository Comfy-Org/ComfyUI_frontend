<template>
  <RekaTreeItem
    v-slot="{ isExpanded, handleToggle }"
    v-bind="forwarded"
    :class="
      cn(
        'group/tree-node flex min-w-0 cursor-pointer items-center gap-1 rounded-sm py-(--tree-item-padding) pr-(--tree-item-padding) outline-none hover:bg-secondary-background-hover focus-visible:bg-secondary-background-hover data-selected:bg-secondary-background-selected',
        className
      )
    "
    :style="{
      paddingLeft: `calc(var(--tree-item-padding) + ${(restProps.level - 1) * 16}px)`
    }"
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
            'icon-[lucide--chevron-right] size-4 shrink-0 transition-transform',
            isExpanded && 'rotate-90'
          )
        "
      />
    </Button>
    <span v-else class="size-5 shrink-0" />
    <div class="contents" @keydown="keepKeysInEditableContent">
      <slot />
    </div>
  </RekaTreeItem>
</template>

<script setup lang="ts" generic="T extends object">
import type { TreeItemEmits, TreeItemProps, TreeItemToggleEvent } from 'reka-ui'
import {
  TreeItem as RekaTreeItem,
  injectTreeRootContext,
  useForwardProps
} from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'

const { class: className, ...restProps } = defineProps<
  Omit<TreeItemProps<T>, 'as' | 'asChild'> & {
    class?: HTMLAttributes['class']
  }
>()

const emits = defineEmits<TreeItemEmits<T>>()

const forwarded = useForwardProps(restProps)

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

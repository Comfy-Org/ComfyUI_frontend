<template>
  <RekaTreeItem
    v-slot="{ isExpanded, isSelected, handleToggle }"
    v-bind="forwarded"
    as-child
    @toggle="preventClickToggle"
  >
    <div
      v-bind="$attrs"
      :class="
        cn(
          'group/tree-node flex min-w-0 cursor-pointer items-center gap-1 rounded-sm py-(--tree-item-padding) pr-(--tree-item-padding) outline-none hover:bg-secondary-background-hover focus-visible:bg-secondary-background-hover',
          isSelected && 'bg-secondary-background-selected',
          className
        )
      "
      :style="{
        paddingLeft: `calc(var(--tree-item-padding) + ${(level - 1) * 16}px)`
      }"
    >
      <Button
        v-if="hasChildren"
        type="button"
        variant="muted-textonly"
        size="icon-sm"
        tabindex="-1"
        aria-hidden="true"
        class="shrink-0"
        :aria-label="isExpanded ? $t('g.collapse') : $t('g.expand')"
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
    </div>
  </RekaTreeItem>
</template>

<script setup lang="ts" generic="T extends object">
import type { TreeItemEmits, TreeItemProps, TreeItemToggleEvent } from 'reka-ui'
import { TreeItem as RekaTreeItem, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'

defineOptions({ inheritAttrs: false })

const {
  class: className,
  hasChildren = false,
  ...restProps
} = defineProps<
  Omit<TreeItemProps<T>, 'as' | 'asChild'> & {
    class?: HTMLAttributes['class']
    hasChildren?: boolean
  }
>()

const emits = defineEmits<TreeItemEmits<T>>()

const forwarded = useForwardPropsEmits(restProps, emits)

function keepKeysInEditableContent(event: KeyboardEvent) {
  const { target } = event
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.matches('input, textarea'))
  ) {
    event.stopPropagation()
  }
}

function preventClickToggle(event: TreeItemToggleEvent<T>) {
  if (!(event.detail.originalEvent instanceof KeyboardEvent)) {
    event.preventDefault()
  }
}
</script>

<script setup lang="ts">
import { ZIndex } from '@primeuix/utils/zindex'
import type { MenuItem } from 'primevue/menuitem'
import {
  DropdownMenuArrow,
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, ref, toValue } from 'vue'

import DropdownItem from '@/components/common/DropdownItem.vue'
import Button from '@/components/ui/button/Button.vue'
import { cn } from '@comfyorg/tailwind-utils'
import type { ButtonVariants } from '../ui/button/button.variants'

// Shared base for @primeuix's auto-incrementing 'modal' z-index counter.
const MODAL_BASE_Z_INDEX = 1700

defineOptions({
  inheritAttrs: false
})

const {
  itemClass: itemProp,
  contentClass: contentProp,
  modal = true
} = defineProps<{
  entries?: MenuItem[]
  icon?: string
  to?: string | HTMLElement
  itemClass?: string
  contentClass?: string
  buttonSize?: ButtonVariants['size']
  buttonClass?: string
  modal?: boolean
}>()

const itemClass = computed(() =>
  cn(
    'm-1 flex cursor-pointer items-center-safe gap-1 rounded-lg p-2 leading-none data-disabled:pointer-events-none data-disabled:text-muted-foreground data-highlighted:bg-secondary-background-hover',
    itemProp
  )
)

const contentClass = computed(() =>
  cn(
    'data-[side=top]:animate-slideDownAndFade data-[side=right]:animate-slideLeftAndFade data-[side=bottom]:animate-slideUpAndFade data-[side=left]:animate-slideRightAndFade z-1700 min-w-55 rounded-lg border border-border-subtle bg-base-background p-2 shadow-sm will-change-[opacity,transform]',
    contentProp
  )
)

// Body-portaled content keeps its static z-1700 unless a dialog that joined
// @primeuix's auto-incrementing 'modal' counter is open above it; then lift
// past that dialog so the menu isn't hidden behind it.
const open = ref(false)
const contentStyle = computed(() => {
  if (!open.value) return undefined
  const topZIndex = ZIndex.getCurrent('modal')
  return topZIndex >= MODAL_BASE_Z_INDEX ? { zIndex: topZIndex + 1 } : undefined
})
</script>

<template>
  <DropdownMenuRoot v-model:open="open" :modal>
    <DropdownMenuTrigger as-child>
      <slot name="button">
        <Button :size="buttonSize ?? 'icon'" :class="buttonClass">
          <i :class="icon ?? 'icon-[lucide--menu]'" />
        </Button>
      </slot>
    </DropdownMenuTrigger>

    <DropdownMenuPortal :to>
      <DropdownMenuContent
        side="bottom"
        :side-offset="5"
        :collision-padding="10"
        v-bind="$attrs"
        :class="contentClass"
        :style="contentStyle"
      >
        <slot :item-class>
          <DropdownItem
            v-for="(item, index) in entries ?? []"
            :key="toValue(item.label) ?? index"
            :item-class
            :content-class
            :content-style
            :item
          />
        </slot>
        <DropdownMenuArrow class="fill-base-background stroke-border-subtle" />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import type { MenuItem } from 'primevue/menuitem'
import {
  DropdownMenuArrow,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, toValue } from 'vue'

import DropdownItem from '@/components/common/DropdownItem.vue'
import Button from '@/components/ui/button/Button.vue'
import { cn } from '@/utils/tailwindUtil'
import type { ButtonVariants } from '../ui/button/button.variants'

defineOptions({
  inheritAttrs: false
})

const open = defineModel<boolean>('open', { default: false })

const {
  entries,
  icon,
  to,
  itemClass: itemProp,
  contentClass: contentProp,
  buttonSize,
  buttonClass,
  align,
  showArrow = true,
  side = 'bottom',
  sideOffset = 5,
  collisionPadding = 10,
  closeOnScroll = false
} = defineProps<{
  entries?: MenuItem[]
  icon?: string
  to?: string | HTMLElement
  itemClass?: string
  contentClass?: string
  buttonSize?: ButtonVariants['size']
  buttonClass?: string
  align?: 'start' | 'center' | 'end'
  showArrow?: boolean
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
  collisionPadding?: number
  closeOnScroll?: boolean
}>()

const itemClass = computed(() =>
  cn(
    'm-1 flex cursor-pointer items-center-safe gap-1 rounded-lg p-2 leading-none data-disabled:pointer-events-none data-disabled:text-muted-foreground data-highlighted:bg-secondary-background-hover',
    itemProp
  )
)

const contentClass = computed(() =>
  cn(
    'data-[side=top]:animate-slideDownAndFade data-[side=right]:animate-slideLeftAndFade data-[side=bottom]:animate-slideUpAndFade data-[side=left]:animate-slideRightAndFade z-1700 min-w-[220px] rounded-lg border border-border-subtle bg-base-background p-2 shadow-sm will-change-[opacity,transform]',
    contentProp
  )
)

function closeMenu() {
  open.value = false
}

useEventListener(
  window,
  'scroll',
  () => {
    if (closeOnScroll) {
      closeMenu()
    }
  },
  { capture: true, passive: true }
)
</script>

<template>
  <DropdownMenuRoot v-model:open="open">
    <DropdownMenuTrigger as-child>
      <slot name="button">
        <Button :size="buttonSize ?? 'icon'" :class="buttonClass">
          <i :class="icon ?? 'icon-[lucide--menu]'" />
        </Button>
      </slot>
    </DropdownMenuTrigger>

    <DropdownMenuPortal :to>
      <DropdownMenuContent
        :align
        :side
        :side-offset="sideOffset"
        :collision-padding="collisionPadding"
        v-bind="$attrs"
        :class="contentClass"
      >
        <slot
          name="content"
          :close="closeMenu"
          :item-class="itemClass"
          :item-component="DropdownMenuItem"
          :separator-component="DropdownMenuSeparator"
        >
          <slot
            :close="closeMenu"
            :item-class="itemClass"
            :item-component="DropdownMenuItem"
            :separator-component="DropdownMenuSeparator"
          >
            <DropdownItem
              v-for="(item, index) in entries ?? []"
              :key="toValue(item.label) ?? index"
              :item-class
              :content-class
              :item
            />
          </slot>
        </slot>
        <DropdownMenuArrow
          v-if="showArrow"
          class="fill-base-background stroke-border-subtle"
        />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

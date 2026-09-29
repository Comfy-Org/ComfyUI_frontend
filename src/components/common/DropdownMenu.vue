<script setup lang="ts">
import type { MenuItem } from 'primevue/menuitem'
import {
  DropdownMenuArrow,
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, toValue } from 'vue'

import DropdownItem from '@/components/common/DropdownItem.vue'
import Button from '@/components/ui/button/Button.vue'
import { useModalLiftedZIndex } from '@/composables/useModalLiftedZIndex'
import { cn } from '@comfyorg/tailwind-utils'
import type { ButtonVariants } from '@comfyorg/design-system/button.variants'

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
  modal?: boolean
  itemClass?: string
  contentClass?: string
  buttonSize?: ButtonVariants['size']
  buttonClass?: string
}>()

const itemClass = computed(() =>
  cn(
    'm-1 flex cursor-pointer items-center-safe gap-1 rounded-lg p-2 leading-none data-disabled:pointer-events-none data-disabled:text-muted-foreground data-highlighted:bg-secondary-background-hover',
    itemProp
  )
)

const contentClass = computed(() =>
  cn(
    'z-1700 max-h-(--reka-dropdown-menu-content-available-height) min-w-55 overflow-y-auto rounded-lg border border-border-subtle bg-base-background p-2 shadow-sm will-change-[opacity,transform] data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
    contentProp
  )
)

const separatorClass = 'm-1 h-px bg-border-subtle'
const collisionPadding = 10
const open = defineModel<boolean>('open', { default: false })
const contentStyle = useModalLiftedZIndex(open)
</script>

<template>
  <DropdownMenuRoot v-model:open="open" :modal>
    <slot name="trigger">
      <DropdownMenuTrigger as-child>
        <slot name="button">
          <Button :size="buttonSize ?? 'icon'" :class="buttonClass">
            <i :class="icon ?? 'icon-[lucide--menu]'" />
          </Button>
        </slot>
      </DropdownMenuTrigger>
    </slot>

    <DropdownMenuPortal :to>
      <DropdownMenuContent
        side="bottom"
        :side-offset="5"
        :collision-padding
        v-bind="$attrs"
        :class="contentClass"
        :style="contentStyle"
      >
        <slot
          :item-class
          :content-class
          :content-style
          :separator-class
          :collision-padding
        >
          <DropdownItem
            v-for="(item, index) in entries ?? []"
            :key="toValue(item.label) ?? index"
            :item-class
            :content-class
            :content-style
            :collision-padding
            :item
          />
        </slot>
        <DropdownMenuArrow class="fill-base-background stroke-border-subtle" />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

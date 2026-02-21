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
import { cn } from '@/utils/tailwindUtil'

defineOptions({
  inheritAttrs: false
})

const { itemClass: itemProp, contentClass: contentProp } = defineProps<{
  entries?: MenuItem[]
  icon?: string
  to?: string | HTMLElement
  itemClass?: string
  contentClass?: string
}>()

const itemClass = computed(() =>
  cn(
    'data-[highlighted]:bg-secondary-background-hover data-[disabled]:pointer-events-none data-[disabled]:text-muted-foreground flex p-2 leading-none rounded-lg gap-1 cursor-pointer m-1',
    itemProp
  )
)

const contentClass = computed(() =>
  cn(
    'z-1700 rounded-lg p-2 bg-base-background border border-border-subtle min-w-[220px] shadow-sm will-change-[opacity,transform] data-[side=top]:animate-slideDownAndFade data-[side=right]:animate-slideLeftAndFade data-[side=bottom]:animate-slideUpAndFade data-[side=left]:animate-slideRightAndFade',
    contentProp
  )
)
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <slot name="button">
        <Button size="icon">
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
      >
        <slot :item-class>
          <DropdownItem
            v-for="(item, index) in entries!"
            :key="toValue(item.label) ?? index"
            :item-class
            :content-class
            :item
          />
        </slot>
        <DropdownMenuArrow class="fill-base-background stroke-border-subtle" />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

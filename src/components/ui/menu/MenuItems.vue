<script setup lang="ts">
import { createReusableTemplate } from '@vueuse/core'
import {
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from 'reka-ui'
import { computed, toValue } from 'vue'
import type { Slot, StyleValue } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import MenuAction from './MenuAction.vue'
import MenuItemContent from './MenuItemContent.vue'
import { menuContentClass, menuItemClass } from './menuStyles'
import type { MenuItem } from './types'

defineOptions({ name: 'MenuItems' })

type ItemSlotProps = {
  item: MenuItem
  hasSubmenu: boolean
}

const [DefineItemContent, ReuseItemContent] =
  createReusableTemplate<ItemSlotProps>()

const {
  contentClass = menuContentClass,
  itemClass = menuItemClass,
  itemContent,
  items,
  separatorClass = 'my-1 h-px bg-border-subtle'
} = defineProps<{
  items: MenuItem[]
  contentClass?: string
  contentStyle?: StyleValue
  itemClass?: string
  itemContent?: Slot<ItemSlotProps>
  separatorClass?: string
}>()

const emit = defineEmits<{
  select: []
}>()

const visibleItems = computed(() =>
  items.filter((item) => toValue(item.visible) !== false)
)
</script>

<template>
  <DefineItemContent v-slot="{ item, hasSubmenu }">
    <component
      :is="itemContent"
      v-if="itemContent"
      v-bind="{ item, hasSubmenu }"
    />
    <slot v-else name="item" :item :has-submenu>
      <MenuItemContent :item :has-submenu />
    </slot>
  </DefineItemContent>
  <template
    v-for="(item, index) in visibleItems"
    :key="item.key ?? toValue(item.label) ?? index"
  >
    <DropdownMenuSeparator v-if="item.separator" :class="separatorClass" />
    <DropdownMenuSub v-else-if="item.items">
      <DropdownMenuSubTrigger
        :aria-label="toValue(item.label)"
        :disabled="toValue(item.disabled) || item.items.length === 0"
        :class="cn(itemClass, toValue(item.class))"
      >
        <ReuseItemContent :item :has-submenu="true" />
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent
          :class="
            cn(
              contentClass,
              'max-h-(--reka-dropdown-menu-content-available-height)'
            )
          "
          :style="contentStyle"
          :side-offset="2"
          :align-offset="-5"
        >
          <MenuItems
            :items="item.items"
            :content-class
            :content-style
            :item-class
            :item-content="itemContent ?? $slots.item"
            :separator-class
            @select="emit('select')"
          />
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
    <MenuAction v-else :item :item-class @select="emit('select')">
      <ReuseItemContent :item :has-submenu="false" />
    </MenuAction>
  </template>
</template>

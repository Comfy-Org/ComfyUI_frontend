<script setup lang="ts">
import { createReusableTemplate } from '@vueuse/core'
import { computed, toValue } from 'vue'
import type { Slot } from 'vue'

import MenuAction from './MenuAction.vue'
import MenuItemContent from './MenuItemContent.vue'
import MenuSeparator from './MenuSeparator.vue'
import MenuSubmenu from './MenuSubmenu.vue'
import type { MenuItem, MenuItemSlotProps } from './types'

defineOptions({ name: 'MenuItems' })

const [DefineItemContent, ReuseItemContent] =
  createReusableTemplate<MenuItemSlotProps>()

const { itemContent, items, ownerId } = defineProps<{
  items: MenuItem[]
  itemContent?: Slot<MenuItemSlotProps>
  ownerId?: string
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
    <MenuSeparator v-if="item.separator" />
    <MenuSubmenu
      v-else-if="item.items || item.radioGroup"
      :item
      :item-content="itemContent ?? $slots.item"
      :owner-id
      @select="emit('select')"
    >
      <ReuseItemContent :item :has-submenu="true" />
    </MenuSubmenu>
    <MenuAction
      v-else
      :item
      :allow-commandless="Boolean(itemContent ?? $slots.item)"
      @select="emit('select')"
    >
      <ReuseItemContent :item :has-submenu="false" />
    </MenuAction>
  </template>
</template>

<script setup lang="ts">
import { createReusableTemplate } from '@vueuse/core'
import { DropdownMenuPortal, DropdownMenuSub } from 'reka-ui'
import { computed, toValue } from 'vue'
import type { Slot } from 'vue'

import MenuAction from './MenuAction.vue'
import MenuItemContent from './MenuItemContent.vue'
import MenuRadioGroup from './MenuRadioGroup.vue'
import MenuSeparator from './MenuSeparator.vue'
import MenuSubContent from './MenuSubContent.vue'
import MenuSubTrigger from './MenuSubTrigger.vue'
import type { MenuItem } from './types'

defineOptions({ name: 'MenuItems' })

type ItemSlotProps = {
  item: MenuItem
  hasSubmenu: boolean
}

const [DefineItemContent, ReuseItemContent] =
  createReusableTemplate<ItemSlotProps>()

const { itemContent, items, ownerId } = defineProps<{
  items: MenuItem[]
  itemContent?: Slot<ItemSlotProps>
  ownerId?: string
}>()

const emit = defineEmits<{
  select: []
}>()

const visibleItems = computed(() =>
  items.filter((item) => toValue(item.visible) !== false)
)

function isSubmenuDisabled(item: MenuItem) {
  return (
    toValue(item.disabled) ||
    (item.items ?? item.radioGroup?.options)?.length === 0
  )
}
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
    <DropdownMenuSub
      v-else-if="item.items || item.radioGroup"
      v-slot="{ open }"
    >
      <MenuSubTrigger
        :aria-label="toValue(item.label)"
        :disabled="isSubmenuDisabled(item)"
        :class="toValue(item.class)"
      >
        <ReuseItemContent :item :has-submenu="true" />
      </MenuSubTrigger>
      <DropdownMenuPortal>
        <MenuSubContent
          :open
          :data-menu-owner="ownerId"
          :side-offset="2"
          :align-offset="-5"
        >
          <MenuItems
            v-if="item.items"
            :items="item.items"
            :item-content="itemContent ?? $slots.item"
            :owner-id
            @select="emit('select')"
          />
          <MenuRadioGroup
            v-else-if="item.radioGroup"
            :model-value="toValue(item.radioGroup.value)"
            :options="item.radioGroup.options"
          />
        </MenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
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

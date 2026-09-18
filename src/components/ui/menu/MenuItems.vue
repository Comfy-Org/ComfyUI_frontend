<script setup lang="ts">
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from 'reka-ui'
import { toValue } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import MenuItemContent from './MenuItemContent.vue'
import { menuContentClass, menuItemClass } from './menuStyles'
import type { MenuItem } from './types'

defineOptions({ name: 'MenuItems' })

defineProps<{
  items: MenuItem[]
}>()

const emit = defineEmits<{
  select: []
}>()

function select(item: MenuItem, event: Event) {
  if (!item.command) {
    event.preventDefault()
    return
  }
  if (item.checked !== undefined || item.comfyCommand?.active) {
    event.preventDefault()
    void item.command({ originalEvent: event, item })
    return
  }
  void item.command({ originalEvent: event, item })
  emit('select')
}
</script>

<template>
  <template
    v-for="(item, index) in items"
    :key="item.key ?? toValue(item.label) ?? index"
  >
    <DropdownMenuSeparator
      v-if="item.separator"
      class="my-1 h-px bg-border-subtle"
    />
    <DropdownMenuSub v-else-if="toValue(item.visible) !== false && item.items">
      <DropdownMenuSubTrigger
        :aria-label="toValue(item.label)"
        :disabled="toValue(item.disabled) || item.items.length === 0"
        :class="cn(menuItemClass, item.class)"
      >
        <slot name="item" :item :props="{ action: {} }" :has-submenu="true">
          <MenuItemContent :item :has-submenu="true" />
        </slot>
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent
          :class="
            cn(
              menuContentClass,
              'max-h-(--reka-dropdown-menu-content-available-height)'
            )
          "
          :side-offset="2"
          :align-offset="-5"
        >
          <MenuItems :items="item.items" @select="emit('select')" />
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
    <DropdownMenuItem
      v-else-if="toValue(item.visible) !== false && item.checked === undefined"
      :aria-label="toValue(item.label)"
      :disabled="toValue(item.disabled)"
      :class="cn(menuItemClass, item.class)"
      @select="select(item, $event)"
    >
      <slot name="item" :item :props="{ action: {} }" :has-submenu="false">
        <MenuItemContent :item :has-submenu="false" />
      </slot>
    </DropdownMenuItem>
    <DropdownMenuCheckboxItem
      v-else-if="toValue(item.visible) !== false"
      :aria-label="toValue(item.label)"
      :model-value="item.checked"
      :disabled="toValue(item.disabled)"
      :class="cn(menuItemClass, item.class)"
      @select="select(item, $event)"
    >
      <slot name="item" :item :props="{ action: {} }" :has-submenu="false">
        <MenuItemContent :item :has-submenu="false" />
      </slot>
    </DropdownMenuCheckboxItem>
  </template>
</template>

<script setup lang="ts">
import {
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from 'reka-ui'
import { toValue } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { menuContentClass, menuItemClass } from './menuStyles'
import type { MenuItem } from './types'

defineOptions({ name: 'MenuItems' })

defineProps<{
  items: MenuItem[]
}>()

function select(item: MenuItem, event: Event) {
  if (!item.command) {
    event.preventDefault()
    return
  }
  if (item.comfyCommand?.active) event.preventDefault()
  void item.command?.({ originalEvent: event, item })
}
</script>

<template>
  <template
    v-for="(item, index) in items"
    :key="item.key ?? item.label ?? index"
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
          <i v-if="item.icon" :class="cn(item.icon, 'size-4 shrink-0')" />
          <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
          <i class="ml-auto icon-[lucide--chevron-right] size-4" />
        </slot>
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent
          :class="menuContentClass"
          :side-offset="2"
          :align-offset="-5"
        >
          <MenuItems :items="item.items" />
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
    <DropdownMenuItem
      v-else-if="toValue(item.visible) !== false"
      :aria-label="toValue(item.label)"
      :disabled="toValue(item.disabled)"
      :class="cn(menuItemClass, item.class)"
      @select="select(item, $event)"
    >
      <slot name="item" :item :props="{ action: {} }" :has-submenu="false">
        <i v-if="item.icon" :class="cn(item.icon, 'size-4 shrink-0')" />
        <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
        <i
          v-if="item.checked || item.comfyCommand?.active"
          data-testid="menu-item-indicator"
          :class="
            cn(
              'ml-auto icon-[lucide--check] size-4',
              item.comfyCommand?.active &&
                !item.comfyCommand.active() &&
                'invisible'
            )
          "
        />
        <span
          v-if="item.comfyCommand?.keybinding"
          class="ml-auto rounded-sm border border-border-default bg-interface-menu-component-surface-hovered p-1 text-xs text-nowrap text-muted"
        >
          {{ item.comfyCommand.keybinding.combo.toString() }}
        </span>
      </slot>
    </DropdownMenuItem>
  </template>
</template>

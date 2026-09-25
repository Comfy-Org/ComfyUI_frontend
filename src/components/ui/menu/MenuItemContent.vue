<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { MenuItem } from './types'

const { hasSubmenu, item } = defineProps<{
  hasSubmenu: boolean
  item: MenuItem
}>()
</script>

<template>
  <i v-if="item.icon" :class="cn(item.icon, 'size-4 shrink-0')" />
  <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
  <i v-if="hasSubmenu" class="ml-auto icon-[lucide--chevron-right] size-4" />
  <i
    v-else-if="item.checked || item.comfyCommand?.active"
    data-testid="menu-item-indicator"
    :class="
      cn(
        'ml-auto icon-[lucide--check] size-4',
        item.comfyCommand?.active && !item.comfyCommand.active() && 'invisible'
      )
    "
  />
  <span
    v-if="!hasSubmenu && item.comfyCommand?.keybinding"
    class="ml-auto rounded-sm border border-border-default bg-secondary-background p-1 text-xs text-nowrap text-muted"
  >
    {{ item.comfyCommand.keybinding.combo.toString() }}
  </span>
</template>

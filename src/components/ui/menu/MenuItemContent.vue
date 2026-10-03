<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { toValue } from 'vue'

import type { MenuItem } from './types'

const { hasSubmenu, item } = defineProps<{
  hasSubmenu: boolean
  item: MenuItem
}>()
</script>

<template>
  <i v-if="item.icon" :class="cn(item.icon, 'size-4 shrink-0')" />
  <span class="min-w-0 flex-1 truncate">{{ toValue(item.label) }}</span>
  <i v-if="hasSubmenu" class="ml-auto icon-[lucide--chevron-right] size-4" />
  <i
    v-else-if="item.checked !== undefined"
    data-testid="menu-item-indicator"
    :class="
      cn(
        'ml-auto icon-[lucide--check] size-4',
        !toValue(item.checked) && 'invisible'
      )
    "
  />
  <span
    v-if="!hasSubmenu && toValue(item.shortcut)"
    class="ml-auto rounded-sm border border-border-default bg-secondary-background p-1 text-xs text-nowrap text-muted"
  >
    {{ toValue(item.shortcut) }}
  </span>
</template>

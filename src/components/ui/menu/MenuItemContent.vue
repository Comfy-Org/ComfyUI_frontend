<script setup lang="ts">
import Badge from '@/components/ui/badge/Badge.vue'
import { cn } from '@comfyorg/tailwind-utils'
import { toValue } from 'vue'

import OverlayIcon from '@/components/common/OverlayIcon.vue'
import Switch from '@/components/ui/switch/Switch.vue'

import type { MenuItem } from './types'

const { hasSubmenu, item } = defineProps<{
  hasSubmenu: boolean
  item: MenuItem
}>()
</script>

<template>
  <OverlayIcon v-if="item.overlayIcon" v-bind="item.overlayIcon" />
  <i v-else-if="item.icon" :class="cn(item.icon, 'size-4 shrink-0')" />
  <span class="min-w-0 flex-1">
    <span class="block truncate">{{ toValue(item.label) }}</span>
    <span
      v-if="item.description"
      class="block max-w-64 text-xs whitespace-normal text-muted-foreground"
      >{{ toValue(item.description) }}</span
    >
  </span>
  <i
    v-if="item.trailingIcon"
    :class="cn(item.trailingIcon, 'ml-auto size-4')"
  />
  <Badge
    v-if="item.badge"
    variant="pill"
    severity="default"
    class="ml-3 px-1.5 uppercase"
  >
    {{ item.badge }}
  </Badge>
  <i
    v-if="hasSubmenu"
    data-testid="menu-item-submenu-indicator"
    class="ml-auto icon-[lucide--chevron-right] size-4"
  />
  <Switch
    v-else-if="item.presentation === 'switch'"
    :model-value="toValue(item.checked)"
    class="pointer-events-none ml-4"
    aria-hidden="true"
    readonly
    tabindex="-1"
  />
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
    class="ml-auto rounded-sm border bg-secondary p-1 text-xs text-nowrap text-muted-foreground"
  >
    {{ toValue(item.shortcut) }}
  </span>
</template>

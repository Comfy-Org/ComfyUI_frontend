<template>
  <div
    class="flex cursor-pointer items-start gap-2 rounded-md px-4 py-3 text-sm transition-colors text-base-foreground"
    :class="
      active
        ? 'bg-interface-menu-component-surface-selected'
        : 'hover:bg-interface-menu-component-surface-hovered'
    "
    role="button"
    @click="onClick"
  >
    <div v-if="icon" class="py-0.5">
      <NavIcon :icon="icon" />
    </div>
    <i v-else class="text-neutral icon-[lucide--folder] text-xs shrink-0" />
    <span class="flex items-center break-all">
      <slot></slot>
    </span>
  </div>
</template>

<script setup lang="ts">
import type { NavItemData } from '@/types/navTypes'

import NavIcon from './NavIcon.vue'

const { icon, active, onClick } = defineProps<{
  icon: NavItemData['icon']
  active?: boolean
  onClick: () => void
}>()
</script>

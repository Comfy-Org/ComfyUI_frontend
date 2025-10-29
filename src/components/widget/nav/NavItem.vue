<template>
  <div
    class="flex cursor-pointer items-center gap-2 rounded-md px-4 py-3 text-sm transition-colors"
    :class="
      active
        ? 'bg-smoke-400 dark-theme:bg-charcoal-300 text-neutral'
        : 'text-neutral hover:bg-smoke-100 dark-theme:hover:bg-charcoal-300'
    "
    role="button"
    @click="onClick"
  >
    <NavIcon v-if="icon" :icon="icon" />
    <i v-else class="text-neutral icon-[lucide--folder] text-xs" />
    <span class="flex items-center">
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

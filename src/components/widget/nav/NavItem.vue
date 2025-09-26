<template>
  <div
    class="flex items-center gap-2 px-4 py-3 text-sm rounded-md transition-colors cursor-pointer"
    :class="
      active
        ? 'bg-white dark-theme:bg-charcoal-600 text-neutral'
        : 'text-neutral hover:bg-gray-100 dark-theme:hover:bg-charcoal-300'
    "
    role="button"
    @click="onClick"
  >
    <NavIcon v-if="icon" :icon="icon" />
    <i-lucide:folder v-else class="text-xs text-neutral" />
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

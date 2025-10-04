<template>
  <div :class="navItemClasses" role="button" @click="onClick">
    <NavIcon v-if="icon" :icon="icon" />
    <i-lucide:folder v-else class="text-xs text-neutral" />
    <span class="flex items-center">
      <slot></slot>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { NavItemData } from '@/types/navTypes'
import { cn } from '@/utils/tailwindUtil'

import NavIcon from './NavIcon.vue'

const { icon, active, onClick } = defineProps<{
  icon: NavItemData['icon']
  active?: boolean
  onClick: () => void
}>()

const navItemClasses = computed(() =>
  cn(
    'flex items-center gap-2 px-4 py-3 text-sm rounded-md transition-colors cursor-pointer text-neutral',
    {
      'bg-gray-100 dark-theme:bg-charcoal-300': active,
      'hover:bg-gray-100 dark-theme:hover:bg-charcoal-300': !active
    }
  )
)
</script>

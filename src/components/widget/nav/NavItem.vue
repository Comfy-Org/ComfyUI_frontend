<template>
  <div
    class="flex items-center gap-2 px-4 py-3 text-sm rounded-md transition-colors cursor-pointer"
    :class="
      active
        ? 'bg-neutral-100 dark-theme:bg-zinc-700 text-neutral'
        : 'text-neutral hover:bg-zinc-100 dark-theme:hover:bg-zinc-700/50'
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
import { NavItemData } from '@/types/navTypes'

import NavIcon from './NavIcon.vue'

const { icon, active, onClick } = defineProps<{
  icon: NavItemData['icon']
  active?: boolean
  onClick: () => void
}>()

// Icon map matching getCategoryIcon function exactly
const iconMap = {
  // Main categories
  list: ILucideList,
  'graduation-cap': ILucideGraduationCap,

  // Generation types
  image: ILucideImage,
  film: ILucideFilm,
  box: ILucideBox,
  'volume-2': ILucideVolume2,

  // API and models
  'hand-coins': ILucideHandCoins,

  // LLMs and AI
  'message-square-text': ILucideMessageSquareText,

  // Performance and hardware
  zap: ILucideZap,
  command: ILucideCommand,

  // Training
  dumbbell: ILucideDumbbell,

  // Extensions and tools
  puzzle: ILucidePuzzle,
  wrench: ILucideWrench,

  // Fallbacks for common patterns
  'maximize-2': ILucideMaximize2,
  'sliders-horizontal': ILucideSlidersHorizontal,
  'layout-grid': ILucideLayoutGrid,
  folder: ILucideFolder
}

const iconComponent = computed(() => {
  if (!icon) return ILucideFolder
  return iconMap[icon as keyof typeof iconMap] || ILucideFolder
})
</script>

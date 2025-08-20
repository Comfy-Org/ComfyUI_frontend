<template>
  <div
    class="flex items-center gap-2 px-4 py-2 text-xs rounded-md transition-colors cursor-pointer"
    :class="
      active
        ? 'bg-neutral-100 dark-theme:bg-zinc-700 text-neutral'
        : 'text-neutral hover:bg-zinc-100 hover:dark-theme:bg-zinc-700/50'
    "
    role="button"
    @click="onClick"
  >
    <component :is="iconComponent" class="text-xs text-neutral" />
    <span class="flex items-center">
      <slot></slot>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
// Import only the icons used in getCategoryIcon
import ILucideList from '~icons/lucide/list'
import ILucideGraduationCap from '~icons/lucide/graduation-cap'
import ILucideImage from '~icons/lucide/image'
import ILucideFilm from '~icons/lucide/film'
import ILucideBox from '~icons/lucide/box'
import ILucideVolume2 from '~icons/lucide/volume-2'
import ILucideHandCoins from '~icons/lucide/hand-coins'
import ILucideMessageSquareText from '~icons/lucide/message-square-text'
import ILucideZap from '~icons/lucide/zap'
import ILucideCommand from '~icons/lucide/command'
import ILucideDumbbell from '~icons/lucide/dumbbell'
import ILucidePuzzle from '~icons/lucide/puzzle'
import ILucideWrench from '~icons/lucide/wrench'
import ILucideMaximize2 from '~icons/lucide/maximize-2'
import ILucideSlidersHorizontal from '~icons/lucide/sliders-horizontal'
import ILucideLayoutGrid from '~icons/lucide/layout-grid'
import ILucideFolder from '~icons/lucide/folder'

const { icon, active, onClick } = defineProps<{
  icon?: string
  active?: boolean
  onClick: () => void
}>()

// Icon map matching getCategoryIcon function exactly
const iconMap = {
  // Main categories
  'list': ILucideList,
  'graduation-cap': ILucideGraduationCap,
  
  // Generation types
  'image': ILucideImage,
  'film': ILucideFilm,
  'box': ILucideBox,
  'volume-2': ILucideVolume2,
  
  // API and models
  'hand-coins': ILucideHandCoins,
  
  // LLMs and AI
  'message-square-text': ILucideMessageSquareText,
  
  // Performance and hardware
  'zap': ILucideZap,
  'command': ILucideCommand,
  
  // Training
  'dumbbell': ILucideDumbbell,
  
  // Extensions and tools
  'puzzle': ILucidePuzzle,
  'wrench': ILucideWrench,
  
  // Fallbacks for common patterns
  'maximize-2': ILucideMaximize2,
  'sliders-horizontal': ILucideSlidersHorizontal,
  'layout-grid': ILucideLayoutGrid,
  'folder': ILucideFolder
}

const iconComponent = computed(() => {
  if (!icon) return ILucideFolder
  return iconMap[icon as keyof typeof iconMap] || ILucideFolder
})
</script>

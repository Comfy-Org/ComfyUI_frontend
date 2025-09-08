<template>
  <div
    class="flex items-center gap-2 px-4 py-2 text-xs rounded-md transition-colors cursor-pointer"
    :class="
      active
        ? 'bg-neutral-100 dark-theme:bg-zinc-700 text-neutral'
        : 'text-neutral hover:bg-zinc-100 dark-theme:hover:bg-zinc-700/50'
    "
    role="button"
    @click="onClick"
  >
    <component :is="iconComponent" class="text-sm text-neutral" />
    <span class="flex items-center">
      <slot></slot>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ILucideBox from '~icons/lucide/box'
import ILucideCommand from '~icons/lucide/command'
import ILucideDumbbell from '~icons/lucide/dumbbell'
import ILucideFilm from '~icons/lucide/film'
import ILucideFolder from '~icons/lucide/folder'
import ILucideGraduationCap from '~icons/lucide/graduation-cap'
import ILucideHandCoins from '~icons/lucide/hand-coins'
import ILucideImage from '~icons/lucide/image'
import ILucideLayoutGrid from '~icons/lucide/layout-grid'
// Import only the icons used in getCategoryIcon
import ILucideList from '~icons/lucide/list'
import ILucideMaximize2 from '~icons/lucide/maximize-2'
import ILucideMessageSquareText from '~icons/lucide/message-square-text'
import ILucidePuzzle from '~icons/lucide/puzzle'
import ILucideSlidersHorizontal from '~icons/lucide/sliders-horizontal'
import ILucideVolume2 from '~icons/lucide/volume-2'
import ILucideWrench from '~icons/lucide/wrench'
import ILucideZap from '~icons/lucide/zap'

const { icon, active, onClick } = defineProps<{
  icon?: string
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

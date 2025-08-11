<template>
  <button :class="buttonStyle" role="button" @click="onClick">
    <slot v-if="iconPosition !== 'right'" name="icon"></slot>
    <span class="text-sm">{{ label }}</span>
    <slot v-if="iconPosition === 'right'" name="icon"></slot>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const {
  type = 'primary',
  iconPosition = 'left',
  label,
  onClick
} = defineProps<{
  type?: 'primary' | 'secondary' | 'transparent'
  iconPosition?: 'left' | 'right'
  label: string
  onClick: () => void
}>()

const buttonStyle = computed(() => {
  const baseClasses =
    'flex items-center gap-2 flex-shrink-0 outline-none border-none px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-200'

  switch (type) {
    case 'primary':
      return `${baseClasses} bg-neutral-900 text-white dark-theme:bg-white dark-theme:text-neutral-900`
    case 'secondary':
      return `${baseClasses} bg-white text-neutral dark-theme:bg-zinc-700 dark-theme:text-white`
    case 'transparent':
      return `${baseClasses} bg-transparent text-neutral-400 dark-theme:text-neutral-400`
    default:
      return `${baseClasses} bg-white text-neutral dark-theme:bg-zinc-700 dark-theme:text-white`
  }
})
</script>

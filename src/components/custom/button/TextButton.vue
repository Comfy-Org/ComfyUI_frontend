<template>
  <button :class="buttonStyle" role="button" @click="onClick">
    <span class="text-sm">{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const {
  type = 'primary',
  label,
  onClick
} = defineProps<{
  type?: 'primary' | 'secondary'
  label: string
  onClick: () => void
}>()

const buttonStyle = computed(() => {
  const baseClasses =
    'flex justify-center items-center flex-shrink-0 outline-none border-none px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-200'

  switch (type) {
    case 'primary':
      return `${baseClasses} bg-neutral-900 text-white dark-theme:bg-white dark-theme:text-neutral-900`
    case 'secondary':
      return `${baseClasses} bg-white text-neutral dark-theme:bg-zinc-700`
    default:
      return `${baseClasses} bg-white text-neutral dark-theme:bg-zinc-700`
  }
})
</script>

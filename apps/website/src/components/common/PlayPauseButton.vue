<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const { playing = false, size = 'md' } = defineProps<{
  playing?: boolean
  size?: 'sm' | 'md'
}>()

defineEmits<{ click: [] }>()
</script>

<template>
  <button
    type="button"
    :class="
      cn(
        'bg-primary-comfy-yellow flex shrink-0 cursor-pointer items-center justify-center rounded-xl',
        size === 'sm' ? 'size-8 lg:size-10' : 'size-12'
      )
    "
    @click="$emit('click')"
  >
    <svg
      v-if="playing"
      :class="cn(size === 'sm' ? 'size-3 lg:size-4' : 'size-4')"
      viewBox="0 0 24 24"
      fill="#211927"
    >
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
    <svg
      v-else
      :class="cn('ml-0.5', size === 'sm' ? 'size-3 lg:size-4' : 'size-4')"
      viewBox="0 0 24 24"
      fill="#211927"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  </button>
</template>

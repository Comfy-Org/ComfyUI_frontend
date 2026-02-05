<template>
  <span
    class="flex items-center gap-1 rounded-full border border-neutral-600 px-1.5 py-0.5 text-[10px] text-white"
  >
    <i v-if="icon" :class="cn(icon, 'size-2.5', iconClass)" />
    <slot>{{ text }}</slot>
  </span>
</template>

<script setup lang="ts">
import { cn } from '@/utils/tailwindUtil'

defineProps<{
  text?: string
  icon?: string
  iconClass?: string
}>()
</script>

<template>
  <div
    class="flex items-center gap-2 p-4 font-inter text-sm font-bold text-base-foreground"
  >
    <i v-if="icon" :class="cn(icon, 'size-4')" aria-hidden="true" />
    <span v-if="title" class="flex-auto">{{ title }}</span>
  </div>
</template>
<script setup lang="ts">
import { cn } from '@/utils/tailwindUtil'

defineProps<{
  title?: string
  icon?: string
}>()
</script>

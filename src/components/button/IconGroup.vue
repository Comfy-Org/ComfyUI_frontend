<template>
  <div :class="iconGroupClasses">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@/utils/tailwindUtil'

const iconGroupClasses = cn(
  'flex justify-center items-center shrink-0',
  'outline-hidden border-none p-0 rounded-lg',
  'bg-white dark-theme:bg-zinc-700',
  'text-neutral-950 dark-theme:text-white',
  'transition-all duration-200',
  'cursor-pointer'
)
</script>

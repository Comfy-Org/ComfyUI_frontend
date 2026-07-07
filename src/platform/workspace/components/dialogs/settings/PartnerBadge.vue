<template>
  <span
    class="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary-background-hover"
  >
    <i :class="cn(getProviderIcon(partner), 'size-3')" />
  </span>
</template>

<script setup lang="ts">
import { getProviderIcon } from '@/utils/categoryUtil'
import { cn } from '@comfyorg/tailwind-utils'

const { partner } = defineProps<{ partner: string }>()
</script>

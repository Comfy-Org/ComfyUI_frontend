<template>
  <i :class="cn(getProviderIcon(partner), 'size-5 shrink-0 rounded-full')" />
</template>

<script setup lang="ts">
import { getProviderIcon } from '@/utils/categoryUtil'
import { cn } from '@comfyorg/tailwind-utils'

const { partner } = defineProps<{ partner: string }>()
</script>

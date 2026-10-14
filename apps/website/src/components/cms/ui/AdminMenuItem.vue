<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { DropdownMenuItem } from 'reka-ui'
import type { Component } from 'vue'

/** One action in an AdminMenu. */
const { icon, danger = false } = defineProps<{
  icon?: Component
  danger?: boolean
}>()
const emit = defineEmits<{ select: [] }>()
</script>

<template>
  <DropdownMenuItem
    :class="
      cn(
        'flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 outline-none data-highlighted:bg-admin-hover [&_svg]:size-3.5',
        danger ? 'text-admin-danger-text' : 'text-admin-fg'
      )
    "
    @select="emit('select')"
  >
    <component :is="icon" v-if="icon" aria-hidden="true" />
    <slot />
  </DropdownMenuItem>
</template>

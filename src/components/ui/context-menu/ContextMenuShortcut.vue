<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { menuShortcutClasses } from '../menu.styles'

const { class: className } = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <span :class="cn(menuShortcutClasses, className)">
    <slot />
  </span>
</template>

<template>
  <thead
    :class="cn('[&_tr]:border-b [&_tr]:border-interface-stroke/60', className)"
  >
    <slot />
  </thead>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: className } = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

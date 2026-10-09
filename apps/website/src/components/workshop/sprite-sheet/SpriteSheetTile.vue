<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { CHECKER } from './checker'
</script>

<template>
  <span
    :class="
      cn(
        'relative block size-full overflow-hidden bg-primary-comfy-ink',
        CHECKER
      )
    "
  >
    <span class="absolute inset-0 block origin-[50%_30%] scale-[1.7]">
      <slot />
    </span>
  </span>
</template>

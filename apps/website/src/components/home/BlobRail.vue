<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const { side } = defineProps<{
  side: 'left' | 'right'
}>()
</script>

<template>
  <div
    class="pointer-events-none flex min-h-0 items-center overflow-clip lg:overflow-visible"
  >
    <div
      :class="
        cn(
          'aspect-2/3 w-40 lg:aspect-auto lg:h-[72vh] lg:max-h-240 lg:w-[115%]',
          side === 'left' ? 'ml-auto lg:-ml-[12%]' : 'mr-auto lg:-mr-[12%]'
        )
      "
    >
      <slot />
    </div>
  </div>
</template>
